using Microsoft.EntityFrameworkCore;
using Npgsql;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Reconciliacao;
using ControleFinanceiro.Api.Infrastructure;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Reconciliação (marco de saldo). "Nesta conta, nesta data+hora, o saldo REAL era X." Ancora a
/// confiança no saldo. Ver docs/features/reconciliacao/spec.md.
///
/// O saldo NÃO é recalculado por aqui — continua sendo a soma (<see cref="RegrasFinanceiras"/>). Quando
/// o declarado não bate com o calculado, quem fecha a diferença é um lançamento de ajuste
/// (<c>Transacao.EhAjusteReconciliacao</c>), pra a soma continuar correta. O marco é a trilha de
/// conferência. Baseline sempre ajusta (assume o declarado); verificação só ajusta se o usuário pedir.
///
/// Isolamento por <c>usuarioId</c> em toda query (multi-tenancy manual). Escrita idempotente pelo
/// header Idempotency-Key (mesmo padrão de <c>FaturaService.PagarFaturaAsync</c> — índice único no
/// <see cref="RegistroIdempotencia"/>, gravado no MESMO SaveChanges).
/// </summary>
public class ReconciliacaoService(AppDbContext context, FinancialEventLogService eventLog)
{
    private readonly AppDbContext _context = context;
    private readonly FinancialEventLogService _eventLog = eventLog;

    private const string OperacaoCriarMarco = "CriarMarcoReconciliacao";

    /// <summary>Teto de sanidade pro saldo declarado (aceita negativo — conta no vermelho).</summary>
    private const decimal SaldoMaximo = 1_000_000_000m;

    /// <summary>
    /// Saldo calculado da conta ATÉ (inclusive) uma data+hora: soma o que compõe o saldo real
    /// (<see cref="RegrasFinanceiras.CompoeSaldoReal"/>) com <c>Data ≤ dataHora</c>. Inclui ajustes
    /// anteriores (eles corrigem o saldo). Filtra pelo dono da conta — defesa em profundidade.
    /// </summary>
    public async Task<decimal> CalcularSaldoAteAsync(Guid usuarioId, Guid contaId, DateTime dataHora)
    {
        await DonoRecursos.ExigirContaAsync(_context, contaId, usuarioId);

        var linha = await _context.Transacoes
            .Where(RegrasFinanceiras.CompoeSaldoReal)
            .Where(t => t.ContaId == contaId
                        && t.Conta!.UsuarioIdProprietario == usuarioId
                        && t.Data <= dataHora)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Receitas = g.Sum(t => t.Tipo == TipoTransacao.Receita ? t.Valor : 0m),
                Despesas = g.Sum(t => t.Tipo == TipoTransacao.Despesa ? t.Valor : 0m),
            })
            .FirstOrDefaultAsync();

        return (linha?.Receitas ?? 0m) - (linha?.Despesas ?? 0m);
    }

    /// <summary>Marcos ativos de uma conta, do mais recente pro mais antigo. Isolado por usuário.</summary>
    public async Task<List<ReconciliacaoSaldoDto>> ListarAsync(Guid usuarioId, Guid contaId)
    {
        await DonoRecursos.ExigirContaAsync(_context, contaId, usuarioId);

        var marcos = await _context.ReconciliacoesSaldo
            .Where(r => r.ContaId == contaId && r.UsuarioId == usuarioId && r.Ativo)
            .OrderByDescending(r => r.DataHora)
            .ThenByDescending(r => r.CriadoEm)
            .ToListAsync();
        var dtos = marcos.Select(ToDto).ToList();

        // Saldo inicial da conta = o baseline. Se ainda não há um marco baseline real, expõe o saldo
        // inicial como um marco DERIVADO (não removível) — pra o calendário/"confere até" refletirem o
        // ponto de partida que o usuário já definiu ao criar a conta.
        if (!dtos.Any(d => d.Tipo == (int)TipoMarcoReconciliacao.Baseline))
        {
            var inicial = await _context.Transacoes
                .Where(t => t.ContaId == contaId && t.EhSaldoInicial && t.Ativo
                            && t.StatusTransacao == StatusTransacao.Executado
                            && t.Conta!.UsuarioIdProprietario == usuarioId)
                .OrderBy(t => t.Data)
                .FirstOrDefaultAsync();
            if (inicial != null)
                dtos.Add(new ReconciliacaoSaldoDto
                {
                    Id = inicial.Id,
                    ContaId = contaId,
                    DataHora = inicial.Data,
                    SaldoDeclarado = inicial.Valor,
                    SaldoCalculado = inicial.Valor,
                    Diferenca = 0m,
                    Tipo = (int)TipoMarcoReconciliacao.Baseline,
                    TemAjuste = false,
                    Derivado = true,
                    Observacao = "Saldo inicial da conta",
                    CriadoEm = inicial.CriadoEm,
                });
        }

        return dtos.OrderByDescending(d => d.DataHora).ToList();
    }

    /// <summary>
    /// Cria um marco. Calcula o saldo até a data, mede a diferença e — em baseline, ou em verificação
    /// com <c>Resolucao = "ajustar"</c> — cria um lançamento de ajuste pra fechar. Idempotente.
    /// </summary>
    public async Task<ReconciliacaoSaldoDto> CriarMarcoAsync(Guid usuarioId, CriarMarcoReconciliacaoDto dto, string idempotencyKey)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey))
            throw new ArgumentException("O header Idempotency-Key é obrigatório para registrar um marco.");
        if (idempotencyKey.Length > RegistroIdempotencia.ChaveMaxLength)
            throw new ArgumentException($"O header Idempotency-Key aceita no máximo {RegistroIdempotencia.ChaveMaxLength} caracteres.");
        if (!Enum.IsDefined(typeof(TipoMarcoReconciliacao), dto.Tipo))
            throw new ArgumentException("Tipo de marco inválido.");
        if (Math.Abs(dto.SaldoDeclarado) > SaldoMaximo)
            throw new ArgumentException("Saldo declarado fora da faixa aceita.");
        // Marco é sobre o passado/presente. Tolera 1 dia pra folga de fuso.
        if (dto.DataHora > DateTime.UtcNow.AddDays(1))
            throw new ArgumentException("A data do marco não pode ser futura.");
        var observacao = string.IsNullOrWhiteSpace(dto.Observacao) ? null : dto.Observacao.Trim();
        if (observacao?.Length > 400)
            throw new ArgumentException("Observação aceita no máximo 400 caracteres.");

        // Dono da conta (404 pra conta alheia ou inexistente — não confirma existência).
        await DonoRecursos.ExigirContaAsync(_context, dto.ContaId, usuarioId);

        // Replay: mesma chave já gravou um marco → devolve o mesmo (não cria de novo). Mesma chave
        // com dados diferentes → 409 (contrato de idempotência do CLAUDE.md).
        var jaExiste = await _context.RegistrosIdempotencia
            .FirstOrDefaultAsync(r => r.UsuarioId == usuarioId && r.Operacao == OperacaoCriarMarco && r.Chave == idempotencyKey);
        if (jaExiste != null)
        {
            var original = await _context.ReconciliacoesSaldo
                .FirstOrDefaultAsync(r => r.Id == jaExiste.ReferenciaId && r.UsuarioId == usuarioId);
            if (original != null) return ReplayOuConflito(original, dto);
        }

        var tipo = (TipoMarcoReconciliacao)dto.Tipo;
        var calculado = await CalcularSaldoAteAsync(usuarioId, dto.ContaId, dto.DataHora);
        var diferenca = dto.SaldoDeclarado - calculado;
        var correlationId = Guid.NewGuid();

        // Ajuste: baseline sempre fecha a diferença; verificação só quando o usuário pede "ajustar".
        var deveAjustar = diferenca != 0m && (tipo == TipoMarcoReconciliacao.Baseline || dto.Resolucao == "ajustar");
        Guid? ajusteId = null;
        if (deveAjustar)
        {
            var ajuste = new Transacao
            {
                Id = Guid.NewGuid(),
                Descricao = "Ajuste de reconciliação",
                Valor = Math.Abs(diferenca),
                // Falta dinheiro (declarado > calculado) → entra como Receita; sobra → Despesa.
                Tipo = diferenca > 0 ? TipoTransacao.Receita : TipoTransacao.Despesa,
                ContaId = dto.ContaId,
                CategoriaId = null,
                Data = dto.DataHora,
                StatusTransacao = StatusTransacao.Executado,
                EhAjusteReconciliacao = true,
                CriadoPor = usuarioId,
            };
            _context.Transacoes.Add(ajuste);
            ajusteId = ajuste.Id;

            _eventLog.Registrar(
                usuarioId: usuarioId,
                tipo: FinancialEventType.TransacaoCriada,
                entidade: "Transacao",
                entidadeId: ajuste.Id,
                correlationId: correlationId,
                origemAcao: "ReconciliacaoAjuste",
                valorAntes: calculado,
                valorDepois: dto.SaldoDeclarado,
                payload: new { contaId = dto.ContaId, diferenca, tipoLancamento = ajuste.Tipo.ToString() });
        }

        var marco = new ReconciliacaoSaldo
        {
            Id = Guid.NewGuid(),
            ContaId = dto.ContaId,
            UsuarioId = usuarioId,
            DataHora = dto.DataHora,
            SaldoDeclarado = dto.SaldoDeclarado,
            SaldoCalculado = calculado,
            Diferenca = diferenca,
            Tipo = tipo,
            AjusteTransacaoId = ajusteId,
            Observacao = observacao,
            CriadoEm = DateTime.UtcNow,
            Ativo = true,
        };
        _context.ReconciliacoesSaldo.Add(marco);

        // Chave no MESMO SaveChanges do marco: 2 requisições concorrentes → o índice único estoura na
        // 2ª e ela vira replay. Tentativa que falha antes daqui não gasta a chave.
        _context.RegistrosIdempotencia.Add(new RegistroIdempotencia
        {
            Id = Guid.NewGuid(),
            UsuarioId = usuarioId,
            Operacao = OperacaoCriarMarco,
            Chave = idempotencyKey,
            ReferenciaId = marco.Id,
            CriadoEm = DateTime.UtcNow,
        });

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.ReconciliacaoRegistrada,
            entidade: "ReconciliacaoSaldo",
            entidadeId: marco.Id,
            correlationId: correlationId,
            origemAcao: "API",
            valorAntes: calculado,
            valorDepois: dto.SaldoDeclarado,
            payload: new { tipo = tipo.ToString(), diferenca, ajusteTransacaoId = ajusteId });

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex is DbUpdateConcurrencyException || EhViolacaoDeUnicidade(ex))
        {
            // Corrida: outra requisição com a MESMA chave gravou primeiro. O índice único estoura e o
            // SaveChanges (atômico) faz rollback total — nada duplicado. Devolve o marco vencedor como
            // replay (ou 409 se os dados divergem), em vez de 500.
            foreach (var entry in _context.ChangeTracker.Entries().ToList())
                entry.State = EntityState.Detached;
            var registro = await _context.RegistrosIdempotencia.AsNoTracking()
                .FirstOrDefaultAsync(r => r.UsuarioId == usuarioId && r.Operacao == OperacaoCriarMarco && r.Chave == idempotencyKey);
            var vencedor = registro == null ? null
                : await _context.ReconciliacoesSaldo.AsNoTracking()
                    .FirstOrDefaultAsync(r => r.Id == registro.ReferenciaId && r.UsuarioId == usuarioId);
            if (vencedor == null) throw;
            return ReplayOuConflito(vencedor, dto);
        }
        return ToDto(marco);
    }

    /// <summary>Replay: mesma chave + mesmos dados devolve o original; dados diferentes → 409.</summary>
    private static ReconciliacaoSaldoDto ReplayOuConflito(ReconciliacaoSaldo original, CriarMarcoReconciliacaoDto dto)
    {
        var mesmos = original.ContaId == dto.ContaId
            && original.SaldoDeclarado == dto.SaldoDeclarado
            && original.DataHora == dto.DataHora
            && (int)original.Tipo == dto.Tipo;
        if (!mesmos)
            throw new InvalidOperationException("Idempotency-Key já usada com outros dados.");
        return ToDto(original);
    }

    /// <summary>Violação de índice único no Postgres (SqlState 23505) dentro do DbUpdateException.</summary>
    private static bool EhViolacaoDeUnicidade(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    /// <summary>
    /// Remove (soft delete) um marco. Se ele tinha ajuste, o lançamento de ajuste também é cancelado
    /// (soft delete) — desfazer a conferência desfaz a correção que ela criou. Isolado por usuário.
    /// </summary>
    public async Task RemoverAsync(Guid usuarioId, Guid marcoId)
    {
        var marco = await _context.ReconciliacoesSaldo
            .FirstOrDefaultAsync(r => r.Id == marcoId && r.UsuarioId == usuarioId && r.Ativo)
            ?? throw new KeyNotFoundException("Marco de reconciliação não encontrado.");

        marco.Ativo = false;
        var correlationId = Guid.NewGuid();

        if (marco.AjusteTransacaoId.HasValue)
        {
            var ajuste = await _context.Transacoes
                .FirstOrDefaultAsync(t => t.Id == marco.AjusteTransacaoId.Value && t.CriadoPor == usuarioId && t.Ativo);
            if (ajuste != null)
            {
                ajuste.Ativo = false;
                ajuste.CanceladoEm = DateTime.UtcNow;
                ajuste.MotivoCancelamento = "Marco de reconciliação removido";
                // Cancelar o ajuste MEXE no saldo → auditoria com o valor revertido (CLAUDE.md).
                _eventLog.Registrar(
                    usuarioId: usuarioId,
                    tipo: FinancialEventType.TransacaoCancelada,
                    entidade: "Transacao",
                    entidadeId: ajuste.Id,
                    correlationId: correlationId,
                    origemAcao: "ReconciliacaoRemocao",
                    valorAntes: ajuste.Valor,
                    valorDepois: 0m,
                    payload: new { marcoId = marco.Id, tipoLancamento = ajuste.Tipo.ToString() });
            }
        }

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.ReconciliacaoRemovida,
            entidade: "ReconciliacaoSaldo",
            entidadeId: marco.Id,
            correlationId: correlationId,
            origemAcao: "API",
            // Remover o marco desfaz o ajuste → o saldo "volta" do declarado pro calculado de então.
            valorAntes: marco.SaldoDeclarado,
            valorDepois: marco.SaldoCalculado,
            payload: new { ajusteTransacaoId = marco.AjusteTransacaoId });

        await _context.SaveChangesAsync();
    }

    private static ReconciliacaoSaldoDto ToDto(ReconciliacaoSaldo r) => new()
    {
        Id = r.Id,
        ContaId = r.ContaId,
        DataHora = r.DataHora,
        SaldoDeclarado = r.SaldoDeclarado,
        SaldoCalculado = r.SaldoCalculado,
        Diferenca = r.Diferenca,
        Tipo = (int)r.Tipo,
        TemAjuste = r.AjusteTransacaoId.HasValue,
        Observacao = r.Observacao,
        CriadoEm = r.CriadoEm,
    };
}
