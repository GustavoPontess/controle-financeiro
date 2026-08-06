using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.DTOs.Emprestimo;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;

namespace ControleFinanceiro.Api.Services;

public class EmprestimoService(
    AppDbContext context,
    NotificacaoService notificacaoService,
    FinancialEventLogService eventLog,
    TransacaoService transacaoService)
{
    private readonly AppDbContext _context = context;
    private readonly NotificacaoService _notificacaoService = notificacaoService;
    private readonly FinancialEventLogService _eventLog = eventLog;
    private readonly TransacaoService _transacaoService = transacaoService;

    public async Task<PagedResult<EmprestimoDto>> ListarAsync(Guid usuarioId, int page = 1, int pageSize = 25)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = VisivelPara(usuarioId)
            .OrderBy(e => e.Quitado)
            .ThenBy(e => e.DataVencimento)
            .ThenBy(e => e.DataInicio);

        var total = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var nomes = await ObterNomesAsync(items);

        return new PagedResult<EmprestimoDto>
        {
            Items = items.Select(e => ToDto(e, usuarioId, nomes)),
            Total = total,
            Page = page,
            PageSize = pageSize,
        };
    }

    /// <summary>
    /// KPIs agregados — a receber/a pagar (restante dos ativos), qtd ativos e total.
    /// Calculado no banco, exato pra qualquer volume. Tipo invertido pra quem vê como contraparte.
    /// </summary>
    public async Task<EmprestimoStatsDto> ObterStatsAsync(Guid usuarioId)
    {
        var query = VisivelPara(usuarioId);
        var ativos = query.Where(e => !e.Quitado);

        var totalAReceber = await ativos
            .Where(e => (e.CriadoPor == usuarioId && e.Tipo == TipoEmprestimo.Emprestei)
                     || (e.CriadoPor != usuarioId && e.Tipo == TipoEmprestimo.PeguiEmprestado))
            .SumAsync(e => (decimal?)(e.ValorTotal - e.ValorPago)) ?? 0m;
        var totalAPagar = await ativos
            .Where(e => (e.CriadoPor == usuarioId && e.Tipo == TipoEmprestimo.PeguiEmprestado)
                     || (e.CriadoPor != usuarioId && e.Tipo == TipoEmprestimo.Emprestei))
            .SumAsync(e => (decimal?)(e.ValorTotal - e.ValorPago)) ?? 0m;
        var qtdAtivos = await ativos.CountAsync();
        var qtdTotal = await query.CountAsync();

        return new EmprestimoStatsDto
        {
            TotalAReceber = totalAReceber,
            TotalAPagar = totalAPagar,
            Ativos = qtdAtivos,
            QtdTotal = qtdTotal,
        };
    }

    public async Task<EmprestimoDto?> BuscarPorIdAsync(Guid id, Guid usuarioId)
    {
        var e = await VisivelPara(usuarioId).FirstOrDefaultAsync(x => x.Id == id);
        return e is null ? null : await ToDtoAsync(e, usuarioId);
    }

    public async Task<EmprestimoDto> CriarAsync(CriarEmprestimoDto dto, Guid usuarioId)
    {
        if (dto.ValorTotal <= 0)
            throw new ArgumentException("Valor total do empréstimo deve ser positivo.");

        if (dto.DataVencimento.HasValue && dto.DataVencimento.Value.Date < dto.DataInicio.Date)
            throw new ArgumentException("Data de vencimento não pode ser anterior à data de início.");

        if (string.IsNullOrWhiteSpace(dto.IdempotencyKey))
            throw new ArgumentException("idempotencyKey é obrigatório.");

        if (dto.FormaPagamento == FormaPagamentoEmprestimo.Parcelado)
        {
            if (!dto.QuantidadeParcelas.HasValue || dto.QuantidadeParcelas.Value < 2 || dto.QuantidadeParcelas.Value > 36)
                throw new ArgumentException("Quantidade de parcelas deve ser entre 2 e 36.");
            if (!dto.PrimeiroVencimento.HasValue)
                throw new ArgumentException("Informe o vencimento da primeira parcela.");
        }

        var replay = await _eventLog.BuscarPorIdempotencyKeyAsync(usuarioId, dto.IdempotencyKey);
        if (replay != null && replay.Tipo == FinancialEventType.EmprestimoCriado)
        {
            var anterior = await _context.Emprestimos
                .Include(e => e.Parcelas)
                .FirstOrDefaultAsync(x => x.Id == replay.EntidadeId);
            if (anterior != null)
                return await ToDtoAsync(anterior, usuarioId);
        }

        var tipoTransacaoEsperado = dto.Tipo == TipoEmprestimo.Emprestei
            ? Domain.Enums.TipoTransacao.Despesa
            : Domain.Enums.TipoTransacao.Receita;

        Guid? transacaoId = null;
        if (dto.TransacaoExistenteId.HasValue)
        {
            // Já lançou esse dinheiro por fora (viu o Pix sair/entrar e registrou na hora) —
            // vincula em vez de criar outro (mesma trava anti-duplicação do resto da feature).
            var existente = await _context.Transacoes
                .FirstOrDefaultAsync(t => t.Id == dto.TransacaoExistenteId.Value && t.CriadoPor == usuarioId)
                ?? throw new KeyNotFoundException("Transação não encontrada.");

            if (existente.Tipo != tipoTransacaoEsperado)
                throw new ArgumentException(dto.Tipo == TipoEmprestimo.Emprestei
                    ? "A transação vinculada precisa ser uma despesa."
                    : "A transação vinculada precisa ser uma receita.");

            var jaVinculada = await _context.Emprestimos.AnyAsync(e => e.TransacaoId == existente.Id && e.Ativo);
            if (jaVinculada)
                throw new InvalidOperationException("Essa transação já está vinculada a outro empréstimo.");

            transacaoId = existente.Id;
        }
        else if (dto.ContaId.HasValue)
        {
            if (!dto.CategoriaId.HasValue)
                throw new ArgumentException("Informe a categoria do lançamento junto com a conta.");

            var transacao = await _transacaoService.CriarTransacaoAsync(new Domain.Entities.Transacao
            {
                Id = Guid.NewGuid(),
                Descricao = $"Empréstimo: {dto.Descricao}",
                Valor = dto.ValorTotal,
                Tipo = tipoTransacaoEsperado,
                ContaId = dto.ContaId,
                CategoriaId = dto.CategoriaId,
                Data = dto.DataInicio.ToUniversalTime(),
            }, usuarioId);
            transacaoId = transacao.Id;
        }

        var emprestimo = new Emprestimo
        {
            Id = Guid.NewGuid(),
            Descricao = dto.Descricao,
            Pessoa = dto.Pessoa,
            ValorTotal = dto.ValorTotal,
            ValorPago = 0,
            Tipo = dto.Tipo,
            DataInicio = dto.DataInicio.ToUniversalTime(),
            DataVencimento = dto.DataVencimento.HasValue ? dto.DataVencimento.Value.ToUniversalTime() : null,
            Quitado = false,
            Observacao = dto.Observacao,
            CriadoPor = usuarioId,
            TransacaoId = transacaoId,
            FormaPagamento = dto.FormaPagamento,
            TaxaJuroMensal = dto.FormaPagamento == FormaPagamentoEmprestimo.Parcelado ? dto.TaxaJuroMensal : null,
            PercentualMultaAtraso = dto.FormaPagamento == FormaPagamentoEmprestimo.Parcelado ? dto.PercentualMultaAtraso : null,
        };

        if (dto.FormaPagamento == FormaPagamentoEmprestimo.Parcelado)
        {
            foreach (var parcela in GerarParcelas(
                emprestimo.Id, dto.ValorTotal, dto.QuantidadeParcelas!.Value,
                dto.PrimeiroVencimento!.Value, dto.TaxaJuroMensal))
                emprestimo.Parcelas.Add(parcela);
        }

        _context.Emprestimos.Add(emprestimo);

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.EmprestimoCriado,
            entidade: "Emprestimo",
            entidadeId: emprestimo.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            valorDepois: emprestimo.ValorTotal,
            payload: new { idempotencyKey = dto.IdempotencyKey, emprestimo.Id, emprestimo.ValorTotal });

        await _context.SaveChangesAsync();
        return await ToDtoAsync(emprestimo, usuarioId);
    }

    public async Task<bool> RegistrarPagamentoAsync(Guid id, decimal valor, Guid usuarioId)
    {
        if (valor <= 0)
            throw new ArgumentException("Valor do pagamento deve ser positivo.");

        var e = await BuscarParaConfirmacaoAsync(id, usuarioId);
        if (e is null || e.Quitado) return false;

        e.ValorPago = Math.Min(e.ValorPago + valor, e.ValorTotal);
        if (e.ValorPago >= e.ValorTotal) e.Quitado = true;

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.EmprestimoPagamentoRegistrado,
            entidade: "Emprestimo",
            entidadeId: e.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            valorDepois: e.ValorPago,
            payload: new { e.Id, valor });

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> QuitarAsync(Guid id, Guid usuarioId)
    {
        var e = await BuscarParaConfirmacaoAsync(id, usuarioId);
        if (e is null) return false;

        var valorAntes = e.ValorPago;
        e.ValorPago = e.ValorTotal;
        e.Quitado = true;

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.EmprestimoQuitado,
            entidade: "Emprestimo",
            entidadeId: e.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            valorAntes: valorAntes,
            valorDepois: e.ValorTotal,
            payload: new { e.Id });

        await _context.SaveChangesAsync();
        return true;
    }

    /// <summary>Soft delete — nunca hard-delete (CLAUDE.md). Bloqueado se já vinculado:
    /// ninguém apaga sozinho um registro que a outra parte já confirmou fazer parte.</summary>
    public async Task<bool> DeletarAsync(Guid id, Guid usuarioId)
    {
        var e = await _context.Emprestimos
            .FirstOrDefaultAsync(x => x.Id == id && x.CriadoPor == usuarioId && x.Ativo);
        if (e is null) return false;

        if (e.StatusVinculo == StatusVinculoEmprestimo.Vinculado)
            throw new ForbiddenAccessException(
                "Não é possível apagar um empréstimo vinculado — quite-o em vez disso.");

        e.Ativo = false;
        await _context.SaveChangesAsync();
        return true;
    }

    // ── Vínculo bilateral (docs/features/emprestimo-compartilhado/spec.md) ─────────────

    /// <summary>
    /// Propõe vínculo por e-mail. Resposta sempre igual, exista ou não a conta (anti-enumeração,
    /// mesmo padrão do C1 de reset-password) — só dispara notificação in-app se a conta existir.
    /// Sem envio de e-mail automático (projeto não tem SMTP real, mesmo padrão do ConviteFamilia):
    /// o link volta na resposta pro credor copiar/compartilhar por fora.
    /// </summary>
    public async Task<EmprestimoConviteResultadoDto> VincularAsync(
        Guid id, VincularEmprestimoDto dto, Guid usuarioId)
    {
        if (string.IsNullOrWhiteSpace(dto.Email))
            throw new ArgumentException("E-mail é obrigatório.");

        var emprestimo = await _context.Emprestimos
            .FirstOrDefaultAsync(e => e.Id == id && e.CriadoPor == usuarioId && e.Ativo)
            ?? throw new KeyNotFoundException("Empréstimo não encontrado.");

        if (emprestimo.StatusVinculo == StatusVinculoEmprestimo.Vinculado)
            throw new InvalidOperationException("Este empréstimo já está vinculado.");
        if (emprestimo.StatusVinculo == StatusVinculoEmprestimo.PendenteAceite)
            throw new InvalidOperationException(
                "Já existe um convite pendente — aguarde a resposta ou aguarde expirar (7 dias) antes de reenviar.");

        var email = dto.Email.Trim().ToLowerInvariant();
        var tokenBruto = GerarTokenOpaco();

        emprestimo.EmailContraparte = email;
        emprestimo.ConviteTokenHash = OpaqueTokenHasher.Hash(tokenBruto);
        emprestimo.ConviteExpiraEm = DateTime.UtcNow.AddDays(7);
        emprestimo.StatusVinculo = StatusVinculoEmprestimo.PendenteAceite;
        emprestimo.VinculoRespondidoEm = null;
        emprestimo.ContraparteUsuarioId = null;

        await _context.SaveChangesAsync();

        var contraparte = await _context.Usuarios.FirstOrDefaultAsync(u => u.Email.ToLower() == email);
        if (contraparte is not null)
        {
            var credor = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId);
            await _notificacaoService.CriarAsync(
                contraparte.Id,
                TipoNotificacao.EmprestimoVinculo,
                "Convite de empréstimo compartilhado",
                $"{credor?.Nome ?? "Alguém"} quer vincular um empréstimo com você.",
                "/emprestimos");
        }

        return new EmprestimoConviteResultadoDto($"/convite/emprestimo/{tokenBruto}");
    }

    /// <summary>Convites pendentes pro usuário logado — filtra por e-mail, igual ConviteFamilia.</summary>
    public async Task<List<EmprestimoConvitePendenteDto>> ListarConvitesPendentesAsync(Guid usuarioId)
    {
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");
        var email = usuario.Email.Trim().ToLowerInvariant();
        var agora = DateTime.UtcNow;

        var pendentes = await _context.Emprestimos
            .Where(e => e.Ativo
                && e.StatusVinculo == StatusVinculoEmprestimo.PendenteAceite
                && e.EmailContraparte == email
                && e.ConviteExpiraEm > agora)
            .ToListAsync();

        var criadoPorIds = pendentes.Select(e => e.CriadoPor).Distinct().ToList();
        var nomes = await _context.Usuarios
            .Where(u => criadoPorIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Nome);

        return pendentes.Select(e =>
        {
            // Perspectiva de quem recebe o convite: o Tipo inverte.
            var tipoEfetivo = e.Tipo == TipoEmprestimo.Emprestei
                ? TipoEmprestimo.PeguiEmprestado
                : TipoEmprestimo.Emprestei;

            return new EmprestimoConvitePendenteDto(
                e.Id,
                e.Descricao,
                e.ValorTotal,
                nomes.GetValueOrDefault(e.CriadoPor, "—"),
                tipoEfetivo == TipoEmprestimo.Emprestei ? "Emprestei" : "Peguei emprestado");
        }).ToList();
    }

    /// <summary>Pré-visualização do convite pelo token (landing pública, autenticado) — mesmas
    /// checagens do aceite (token válido + e-mail bate), mas só leitura.</summary>
    public async Task<EmprestimoConvitePendenteDto> ObterConvitePorTokenAsync(string token, Guid usuarioId)
    {
        var emprestimo = await BuscarPorTokenAsync(token);
        await ExigirEmailDoConvidadoAsync(emprestimo, usuarioId);

        if (emprestimo.ConviteExpiraEm is null || emprestimo.ConviteExpiraEm <= DateTime.UtcNow)
            throw new InvalidOperationException("Convite expirado.");

        var criador = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == emprestimo.CriadoPor);
        var tipoEfetivo = emprestimo.Tipo == TipoEmprestimo.Emprestei
            ? TipoEmprestimo.PeguiEmprestado
            : TipoEmprestimo.Emprestei;

        return new EmprestimoConvitePendenteDto(
            emprestimo.Id,
            emprestimo.Descricao,
            emprestimo.ValorTotal,
            criador?.Nome ?? "—",
            tipoEfetivo == TipoEmprestimo.Emprestei ? "Emprestei" : "Peguei emprestado");
    }

    /// <summary>Aceite via token (fluxo da landing pública /convite/emprestimo/:token).</summary>
    public async Task AceitarVinculoAsync(string token, Guid usuarioId)
        => await AceitarInternoAsync(await BuscarPorTokenAsync(token), usuarioId);

    /// <summary>
    /// Aceite via id (lista "convites pendentes" in-app). Sem token — o token nunca fica
    /// recuperável depois de gerado (só o hash é persistido), então quem já está autenticado
    /// e com e-mail batendo (checado abaixo) não precisa reencontrar o link original.
    /// </summary>
    public async Task AceitarVinculoPorIdAsync(Guid id, Guid usuarioId)
    {
        var emprestimo = await _context.Emprestimos
            .FirstOrDefaultAsync(e => e.Id == id && e.Ativo
                && e.StatusVinculo == StatusVinculoEmprestimo.PendenteAceite)
            ?? throw new KeyNotFoundException("Convite não encontrado.");
        await AceitarInternoAsync(emprestimo, usuarioId);
    }

    public async Task RecusarVinculoAsync(string token, Guid usuarioId)
        => await RecusarInternoAsync(await BuscarPorTokenAsync(token), usuarioId);

    public async Task RecusarVinculoPorIdAsync(Guid id, Guid usuarioId)
    {
        var emprestimo = await _context.Emprestimos
            .FirstOrDefaultAsync(e => e.Id == id && e.Ativo
                && e.StatusVinculo == StatusVinculoEmprestimo.PendenteAceite)
            ?? throw new KeyNotFoundException("Convite não encontrado.");
        await RecusarInternoAsync(emprestimo, usuarioId);
    }

    private async Task AceitarInternoAsync(Emprestimo emprestimo, Guid usuarioId)
    {
        var usuario = await ExigirEmailDoConvidadoAsync(emprestimo, usuarioId);

        if (emprestimo.ConviteExpiraEm is null || emprestimo.ConviteExpiraEm <= DateTime.UtcNow)
            throw new InvalidOperationException("Convite expirado.");

        emprestimo.ContraparteUsuarioId = usuarioId;
        emprestimo.StatusVinculo = StatusVinculoEmprestimo.Vinculado;
        emprestimo.VinculoRespondidoEm = DateTime.UtcNow;
        emprestimo.ConviteTokenHash = null; // token de uso único

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.EmprestimoVinculado,
            entidade: "Emprestimo",
            entidadeId: emprestimo.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            payload: new { emprestimo.Id, contraparteUsuarioId = usuarioId });

        await _context.SaveChangesAsync();

        if (emprestimo.CriadoPor != usuarioId)
        {
            await _notificacaoService.CriarAsync(
                emprestimo.CriadoPor,
                TipoNotificacao.EmprestimoVinculo,
                "Vínculo de empréstimo aceito",
                $"{usuario.Nome} aceitou o vínculo do empréstimo \"{emprestimo.Descricao}\".",
                "/emprestimos");
        }
    }

    private async Task RecusarInternoAsync(Emprestimo emprestimo, Guid usuarioId)
    {
        await ExigirEmailDoConvidadoAsync(emprestimo, usuarioId);

        emprestimo.StatusVinculo = StatusVinculoEmprestimo.Recusado;
        emprestimo.VinculoRespondidoEm = DateTime.UtcNow;
        emprestimo.ConviteTokenHash = null;
        emprestimo.ContraparteUsuarioId = null;

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.EmprestimoVinculoRecusado,
            entidade: "Emprestimo",
            entidadeId: emprestimo.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            payload: new { emprestimo.Id });

        await _context.SaveChangesAsync();
    }

    // ── Pagamento com comprovante + aprovação (docs/features/emprestimo-compartilhado/pagamento-aprovacao.md) ──

    /// <summary>Devedor solicita pagamento anexando comprovante (Transacao real criada junto, na
    /// conta do próprio devedor). Não mexe em ValorPago ainda — só a aprovação do credor avança.</summary>
    public async Task<EmprestimoPagamentoSolicitacaoDto> SolicitarPagamentoAsync(
        Guid emprestimoId, SolicitarPagamentoEmprestimoDto dto, Guid usuarioId)
    {
        if (string.IsNullOrWhiteSpace(dto.IdempotencyKey))
            throw new ArgumentException("idempotencyKey é obrigatório.");

        var replay = await _eventLog.BuscarPorIdempotencyKeyAsync(usuarioId, dto.IdempotencyKey);
        if (replay != null && replay.Tipo == FinancialEventType.EmprestimoPagamentoSolicitado)
        {
            var anterior = await _context.EmprestimoPagamentoSolicitacoes
                .FirstOrDefaultAsync(x => x.Id == replay.EntidadeId);
            if (anterior != null) return await ToSolicitacaoDtoAsync(anterior);
        }

        var emprestimo = await _context.Emprestimos.FirstOrDefaultAsync(e => e.Id == emprestimoId && e.Ativo
            && (e.CriadoPor == usuarioId || e.ContraparteUsuarioId == usuarioId))
            ?? throw new KeyNotFoundException("Empréstimo não encontrado.");

        if (emprestimo.StatusVinculo != StatusVinculoEmprestimo.Vinculado)
            throw new InvalidOperationException("Só é possível solicitar pagamento em empréstimo vinculado.");

        if (EhCredor(emprestimo, usuarioId))
            throw new ForbiddenAccessException("Só o devedor solicita pagamento — o credor confirma.");

        EmprestimoParcela? parcela = null;
        if (dto.ParcelaId.HasValue)
        {
            parcela = await _context.EmprestimoParcelas
                .FirstOrDefaultAsync(p => p.Id == dto.ParcelaId.Value && p.EmprestimoId == emprestimo.Id)
                ?? throw new KeyNotFoundException("Parcela não encontrada.");

            if (parcela.Status != StatusParcelaEmprestimo.Pendente)
                throw new InvalidOperationException("Essa parcela já foi paga ou cancelada.");

            var jaSolicitadaParcela = await _context.EmprestimoPagamentoSolicitacoes.AnyAsync(s =>
                s.ParcelaId == parcela.Id && s.StatusAprovacao != StatusAprovacaoPagamentoEmprestimo.Rejeitada);
            if (jaSolicitadaParcela)
                throw new InvalidOperationException("Já existe uma solicitação de pagamento pendente ou aprovada pra essa parcela.");
        }

        Transacao transacao;
        decimal valor;

        if (dto.TransacaoExistenteId.HasValue)
        {
            // Devedor já lançou essa saída por fora (ex.: registrou o Pix na hora) — vincula em
            // vez de criar outra, mesmo raciocínio de não-duplicar do lado do credor na aprovação.
            transacao = await _context.Transacoes
                .FirstOrDefaultAsync(t => t.Id == dto.TransacaoExistenteId.Value && t.CriadoPor == usuarioId)
                ?? throw new KeyNotFoundException("Transação não encontrada.");

            if (transacao.Tipo != TipoTransacao.Despesa)
                throw new ArgumentException("A transação vinculada precisa ser uma despesa.");

            var jaVinculada = await _context.EmprestimoPagamentoSolicitacoes.AnyAsync(s =>
                s.TransacaoComprovanteId == transacao.Id
                && s.StatusAprovacao != StatusAprovacaoPagamentoEmprestimo.Rejeitada);
            if (jaVinculada)
                throw new InvalidOperationException("Essa transação já está vinculada a outra solicitação de pagamento.");

            valor = transacao.Valor;
        }
        else
        {
            if (dto.Valor <= 0)
                throw new ArgumentException("Valor do pagamento deve ser positivo.");
            if (!dto.ContaId.HasValue || !dto.CategoriaId.HasValue)
                throw new ArgumentException("Informe conta e categoria, ou vincule uma transação já lançada.");

            transacao = await _transacaoService.CriarTransacaoAsync(new Transacao
            {
                Id = Guid.NewGuid(),
                Descricao = $"Pagamento empréstimo: {emprestimo.Descricao}",
                Valor = dto.Valor,
                Tipo = TipoTransacao.Despesa, // é o devedor pagando — sai da conta dele
                ContaId = dto.ContaId,
                CategoriaId = dto.CategoriaId,
                Data = dto.Data.ToUniversalTime(),
            }, usuarioId);
            valor = dto.Valor;
        }

        var solicitacao = new EmprestimoPagamentoSolicitacao
        {
            Id = Guid.NewGuid(),
            EmprestimoId = emprestimo.Id,
            Valor = valor,
            TransacaoComprovanteId = transacao.Id,
            SolicitadoPor = usuarioId,
            StatusAprovacao = StatusAprovacaoPagamentoEmprestimo.Pendente,
            ParcelaId = parcela?.Id,
        };
        _context.EmprestimoPagamentoSolicitacoes.Add(solicitacao);

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.EmprestimoPagamentoSolicitado,
            entidade: "EmprestimoPagamentoSolicitacao",
            entidadeId: solicitacao.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            valorDepois: solicitacao.Valor,
            payload: new { idempotencyKey = dto.IdempotencyKey, solicitacao.Id, emprestimoId });

        await _context.SaveChangesAsync();

        var solicitante = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId);
        await _notificacaoService.CriarAsync(
            CredorUsuarioId(emprestimo),
            TipoNotificacao.EmprestimoPagamentoSolicitado,
            "Pagamento aguardando aprovação",
            $"{solicitante?.Nome ?? "Alguém"} marcou {solicitacao.Valor:C} como pago em \"{emprestimo.Descricao}\" — confirme o recebimento.",
            "/emprestimos");

        return await ToSolicitacaoDtoAsync(solicitacao);
    }

    /// <summary>Histórico de solicitações de um empréstimo — visível pros dois participantes.</summary>
    public async Task<List<EmprestimoPagamentoSolicitacaoDto>> ListarSolicitacoesAsync(Guid emprestimoId, Guid usuarioId)
    {
        var emprestimo = await _context.Emprestimos.FirstOrDefaultAsync(e => e.Id == emprestimoId && e.Ativo
            && (e.CriadoPor == usuarioId || e.ContraparteUsuarioId == usuarioId))
            ?? throw new KeyNotFoundException("Empréstimo não encontrado.");

        var solicitacoes = await _context.EmprestimoPagamentoSolicitacoes
            .Where(s => s.EmprestimoId == emprestimo.Id)
            .OrderByDescending(s => s.CriadoEm)
            .ToListAsync();

        return await ToSolicitacaoDtosAsync(solicitacoes);
    }

    /// <summary>Parcelas de um empréstimo Parcelado — visível pros dois participantes. Recalcula
    /// (e persiste) ValorComMulta de qualquer parcela recém-atrasada antes de retornar — snapshot
    /// congelado na primeira leitura após o vencimento, sem precisar de job novo.</summary>
    public async Task<List<EmprestimoParcelaDto>> ListarParcelasAsync(Guid emprestimoId, Guid usuarioId)
    {
        var emprestimo = await _context.Emprestimos.FirstOrDefaultAsync(e => e.Id == emprestimoId && e.Ativo
            && (e.CriadoPor == usuarioId || e.ContraparteUsuarioId == usuarioId))
            ?? throw new KeyNotFoundException("Empréstimo não encontrado.");

        var parcelas = await _context.EmprestimoParcelas
            .Where(p => p.EmprestimoId == emprestimo.Id)
            .OrderBy(p => p.Numero)
            .ToListAsync();

        var alterou = false;
        foreach (var p in parcelas)
            alterou |= AplicarMultaSeAtrasada(p, emprestimo);
        if (alterou)
            await _context.SaveChangesAsync();

        return parcelas.Select(ToParcelaDto).ToList();
    }

    /// <summary>Solicitações pendentes onde eu sou o credor (pra badge/lista, igual convites-pendentes).</summary>
    public async Task<List<EmprestimoPagamentoSolicitacaoDto>> ListarSolicitacoesPendentesAsync(Guid usuarioId)
    {
        var pendentes = await _context.EmprestimoPagamentoSolicitacoes
            .Include(s => s.Emprestimo)
            .Where(s => s.StatusAprovacao == StatusAprovacaoPagamentoEmprestimo.Pendente
                && s.Emprestimo.Ativo
                && ((s.Emprestimo.Tipo == TipoEmprestimo.Emprestei && s.Emprestimo.CriadoPor == usuarioId)
                 || (s.Emprestimo.Tipo == TipoEmprestimo.PeguiEmprestado && s.Emprestimo.ContraparteUsuarioId == usuarioId)))
            .OrderBy(s => s.CriadoEm)
            .ToListAsync();

        return await ToSolicitacaoDtosAsync(pendentes);
    }

    /// <summary>Credor aprova, informando pra qual conta dele foi o recebimento — cria a Transacao
    /// real de entrada (Receita) na conta do credor, depois avança ValorPago (mesmo clamp/Quitado
    /// de RegistrarPagamentoAsync). As duas pontas do dinheiro ficam registradas: saída no devedor
    /// (já criada na solicitação) + entrada no credor (aqui).</summary>
    public async Task<bool> AprovarPagamentoSolicitacaoAsync(Guid solicitacaoId, AprovarPagamentoEmprestimoDto dto, Guid usuarioId)
    {
        var solicitacao = await CarregarSolicitacaoParaAvaliarAsync(solicitacaoId, usuarioId);
        if (solicitacao is null) return false;

        var emprestimo = solicitacao.Emprestimo;

        // Aprovar sempre registra a entrada de verdade — vincular uma já lançada ou criar uma
        // nova, nunca pular (dinheiro recebido tem que aparecer na conta do credor também).
        if (dto.TransacaoExistenteId.HasValue)
        {
            var existente = await _context.Transacoes
                .FirstOrDefaultAsync(t => t.Id == dto.TransacaoExistenteId.Value && t.CriadoPor == usuarioId)
                ?? throw new KeyNotFoundException("Transação não encontrada.");

            if (existente.Tipo != TipoTransacao.Receita)
                throw new ArgumentException("A transação vinculada precisa ser uma receita.");

            var jaVinculada = await _context.EmprestimoPagamentoSolicitacoes
                .AnyAsync(s => s.TransacaoRecebimentoId == existente.Id);
            if (jaVinculada)
                throw new InvalidOperationException("Essa transação já está vinculada a outra solicitação de pagamento.");

            solicitacao.TransacaoRecebimentoId = existente.Id;
        }
        else if (dto.ContaId.HasValue)
        {
            if (!dto.CategoriaId.HasValue)
                throw new ArgumentException("Informe a categoria do lançamento junto com a conta.");

            var transacaoRecebimento = await _transacaoService.CriarTransacaoAsync(new Transacao
            {
                Id = Guid.NewGuid(),
                Descricao = $"Recebimento empréstimo: {emprestimo.Descricao}",
                Valor = solicitacao.Valor,
                Tipo = TipoTransacao.Receita, // credor recebendo — entra na conta dele
                ContaId = dto.ContaId,
                CategoriaId = dto.CategoriaId,
                Data = DateTime.UtcNow,
            }, usuarioId);
            solicitacao.TransacaoRecebimentoId = transacaoRecebimento.Id;
        }
        else
        {
            throw new ArgumentException(
                "Informe uma transação já lançada pra vincular, ou conta+categoria pra criar uma nova entrada.");
        }

        solicitacao.StatusAprovacao = StatusAprovacaoPagamentoEmprestimo.Aprovada;
        solicitacao.AprovadoPorUsuarioId = usuarioId;
        solicitacao.AprovadoEm = DateTime.UtcNow;

        if (solicitacao.ParcelaId.HasValue)
        {
            var parcela = await _context.EmprestimoParcelas
                .FirstOrDefaultAsync(p => p.Id == solicitacao.ParcelaId.Value);
            if (parcela != null)
            {
                parcela.Status = StatusParcelaEmprestimo.Paga;
                parcela.SolicitacaoPagamentoId = solicitacao.Id;
            }
        }

        emprestimo.ValorPago = Math.Min(emprestimo.ValorPago + solicitacao.Valor, emprestimo.ValorTotal);
        if (emprestimo.ValorPago >= emprestimo.ValorTotal) emprestimo.Quitado = true;

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.EmprestimoPagamentoAprovado,
            entidade: "EmprestimoPagamentoSolicitacao",
            entidadeId: solicitacao.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            valorDepois: emprestimo.ValorPago,
            payload: new { solicitacao.Id, emprestimoId = emprestimo.Id });

        await _context.SaveChangesAsync();

        await _notificacaoService.CriarAsync(
            solicitacao.SolicitadoPor,
            TipoNotificacao.EmprestimoPagamentoAvaliado,
            "Pagamento aprovado",
            $"Seu pagamento de {solicitacao.Valor:C} em \"{emprestimo.Descricao}\" foi confirmado.",
            "/emprestimos");

        return true;
    }

    /// <summary>Credor rejeita — nenhuma Transacao é criada, ValorPago não muda, solicitação fica
    /// no histórico como rejeitada.</summary>
    public async Task<bool> RejeitarPagamentoSolicitacaoAsync(Guid solicitacaoId, Guid usuarioId)
    {
        var solicitacao = await CarregarSolicitacaoParaAvaliarAsync(solicitacaoId, usuarioId);
        if (solicitacao is null) return false;

        solicitacao.StatusAprovacao = StatusAprovacaoPagamentoEmprestimo.Rejeitada;
        solicitacao.AprovadoPorUsuarioId = usuarioId;
        solicitacao.AprovadoEm = DateTime.UtcNow;

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.EmprestimoPagamentoRejeitado,
            entidade: "EmprestimoPagamentoSolicitacao",
            entidadeId: solicitacao.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            payload: new { solicitacao.Id, emprestimoId = solicitacao.EmprestimoId });

        await _context.SaveChangesAsync();

        await _notificacaoService.CriarAsync(
            solicitacao.SolicitadoPor,
            TipoNotificacao.EmprestimoPagamentoAvaliado,
            "Pagamento rejeitado",
            $"Seu pagamento de {solicitacao.Valor:C} em \"{solicitacao.Emprestimo.Descricao}\" foi rejeitado.",
            "/emprestimos");

        return true;
    }

    /// <summary>Devedor reenvia uma solicitação rejeitada — volta pra Pendente, mesma Transacao
    /// comprovante (não cria outra), credor notificado de novo. Cobre rejeição por engano ou
    /// desentendimento resolvido fora do app.</summary>
    public async Task<bool> ReenviarPagamentoSolicitacaoAsync(Guid solicitacaoId, Guid usuarioId)
    {
        var solicitacao = await _context.EmprestimoPagamentoSolicitacoes
            .Include(s => s.Emprestimo)
            .FirstOrDefaultAsync(s => s.Id == solicitacaoId);
        if (solicitacao is null) return false;

        var emprestimo = solicitacao.Emprestimo;
        if (emprestimo.CriadoPor != usuarioId && emprestimo.ContraparteUsuarioId != usuarioId)
            return false; // estranho ao registro — 404, não confirma existência

        if (solicitacao.SolicitadoPor != usuarioId)
            throw new ForbiddenAccessException("Só quem solicitou pode reenviar.");

        if (solicitacao.StatusAprovacao != StatusAprovacaoPagamentoEmprestimo.Rejeitada)
            throw new InvalidOperationException("Só solicitações rejeitadas podem ser reenviadas.");

        solicitacao.StatusAprovacao = StatusAprovacaoPagamentoEmprestimo.Pendente;
        solicitacao.AprovadoPorUsuarioId = null;
        solicitacao.AprovadoEm = null;

        await _context.SaveChangesAsync();

        var solicitante = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId);
        await _notificacaoService.CriarAsync(
            CredorUsuarioId(emprestimo),
            TipoNotificacao.EmprestimoPagamentoSolicitado,
            "Pagamento reenviado pra aprovação",
            $"{solicitante?.Nome ?? "Alguém"} reenviou {solicitacao.Valor:C} em \"{emprestimo.Descricao}\" — reavalie.",
            "/emprestimos");

        return true;
    }

    /// <summary>Carrega + valida autorização pra aprovar/rejeitar (BOLA-safe: estranho ao registro
    /// recebe null → 404; participante que não é credor recebe 403 com o motivo).</summary>
    private async Task<EmprestimoPagamentoSolicitacao?> CarregarSolicitacaoParaAvaliarAsync(Guid solicitacaoId, Guid usuarioId)
    {
        var solicitacao = await _context.EmprestimoPagamentoSolicitacoes
            .Include(s => s.Emprestimo)
            .FirstOrDefaultAsync(s => s.Id == solicitacaoId);
        if (solicitacao is null) return null;

        var emprestimo = solicitacao.Emprestimo;
        if (emprestimo.CriadoPor != usuarioId && emprestimo.ContraparteUsuarioId != usuarioId)
            return null; // estranho ao registro — 404, não confirma existência

        if (!EhCredor(emprestimo, usuarioId))
            throw new ForbiddenAccessException("Só o credor pode aprovar ou rejeitar solicitações de pagamento.");

        if (solicitacao.SolicitadoPor == usuarioId)
            throw new ForbiddenAccessException("Você não pode avaliar a própria solicitação.");

        if (solicitacao.StatusAprovacao != StatusAprovacaoPagamentoEmprestimo.Pendente)
            throw new InvalidOperationException("Só solicitações pendentes podem ser avaliadas.");

        return solicitacao;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private IQueryable<Emprestimo> VisivelPara(Guid usuarioId) => _context.Emprestimos
        .Include(e => e.Parcelas)
        .Where(e => e.Ativo && (e.CriadoPor == usuarioId
            || (e.ContraparteUsuarioId == usuarioId && e.StatusVinculo == StatusVinculoEmprestimo.Vinculado)));

    /// <summary>Carrega o empréstimo só se usuarioId for o credor daquele registro específico
    /// (BOLA-safe: checa o objeto, não só "é o CriadoPor" — OWASP API1:2023). Estranho ao
    /// registro (nem criador nem contraparte) recebe null (404) — não confirma existência.
    /// Participante que não é credor recebe 403 — explica por que não pode.</summary>
    private async Task<Emprestimo?> BuscarParaConfirmacaoAsync(Guid id, Guid usuarioId)
    {
        var e = await _context.Emprestimos.FirstOrDefaultAsync(x => x.Id == id && x.Ativo
            && (x.CriadoPor == usuarioId || x.ContraparteUsuarioId == usuarioId));
        if (e is null) return null;

        if (!EhCredor(e, usuarioId))
            throw new ForbiddenAccessException(
                "Só o credor deste empréstimo pode confirmar pagamento ou quitação.");

        return e;
    }

    private static bool EhCredor(Emprestimo e, Guid usuarioId)
    {
        if (e.StatusVinculo != StatusVinculoEmprestimo.Vinculado)
            return usuarioId == e.CriadoPor;

        return e.Tipo == TipoEmprestimo.Emprestei
            ? usuarioId == e.CriadoPor
            : usuarioId == e.ContraparteUsuarioId;
    }

    /// <summary>Id do usuário credor — só chamar quando Vinculado (ContraparteUsuarioId garantido).</summary>
    private static Guid CredorUsuarioId(Emprestimo e) =>
        e.Tipo == TipoEmprestimo.Emprestei ? e.CriadoPor : e.ContraparteUsuarioId!.Value;

    private async Task<EmprestimoPagamentoSolicitacaoDto> ToSolicitacaoDtoAsync(EmprestimoPagamentoSolicitacao s)
        => (await ToSolicitacaoDtosAsync([s]))[0];

    private async Task<List<EmprestimoPagamentoSolicitacaoDto>> ToSolicitacaoDtosAsync(List<EmprestimoPagamentoSolicitacao> items)
    {
        var solicitanteIds = items.Select(s => s.SolicitadoPor).Distinct().ToList();
        var nomes = await _context.Usuarios.Where(u => solicitanteIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Nome);

        var transacaoIds = items.Select(s => s.TransacaoComprovanteId)
            .Concat(items.Where(s => s.TransacaoRecebimentoId.HasValue).Select(s => s.TransacaoRecebimentoId!.Value))
            .Distinct()
            .ToList();
        var transacoes = await _context.Transacoes
            .Include(t => t.Conta)
            .Where(t => transacaoIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t);

        return items.Select(s =>
        {
            var comprovante = transacoes.GetValueOrDefault(s.TransacaoComprovanteId);
            var recebimento = s.TransacaoRecebimentoId.HasValue
                ? transacoes.GetValueOrDefault(s.TransacaoRecebimentoId.Value)
                : null;

            return new EmprestimoPagamentoSolicitacaoDto
            {
                Id = s.Id,
                EmprestimoId = s.EmprestimoId,
                Valor = s.Valor,
                StatusAprovacao = (int)s.StatusAprovacao,
                StatusAprovacaoDescricao = s.StatusAprovacao switch
                {
                    StatusAprovacaoPagamentoEmprestimo.Pendente => "Pendente",
                    StatusAprovacaoPagamentoEmprestimo.Aprovada => "Aprovada",
                    StatusAprovacaoPagamentoEmprestimo.Rejeitada => "Rejeitada",
                    _ => s.StatusAprovacao.ToString(),
                },
                SolicitadoPor = s.SolicitadoPor,
                SolicitadoPorNome = nomes.GetValueOrDefault(s.SolicitadoPor, "—"),
                CriadoEm = s.CriadoEm,
                AprovadoEm = s.AprovadoEm,
                TransacaoRecebimentoId = s.TransacaoRecebimentoId,
                ComprovanteData = comprovante?.Data ?? s.CriadoEm,
                ComprovanteContaNome = comprovante?.Conta?.Nome,
                RecebimentoData = recebimento?.Data,
                RecebimentoContaNome = recebimento?.Conta?.Nome,
            };
        }).ToList();
    }

    private async Task<Emprestimo> BuscarPorTokenAsync(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new KeyNotFoundException("Convite não encontrado.");

        var hash = OpaqueTokenHasher.Hash(token);
        var emprestimo = await _context.Emprestimos
            .FirstOrDefaultAsync(e => e.ConviteTokenHash == hash && e.Ativo)
            ?? throw new KeyNotFoundException("Convite não encontrado.");

        if (emprestimo.StatusVinculo != StatusVinculoEmprestimo.PendenteAceite)
            throw new InvalidOperationException("Este convite não está mais pendente.");

        return emprestimo;
    }

    private async Task<Usuario> ExigirEmailDoConvidadoAsync(Emprestimo emprestimo, Guid usuarioId)
    {
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");

        if (!string.Equals(usuario.Email.Trim(), emprestimo.EmailContraparte,
                StringComparison.OrdinalIgnoreCase))
            throw new ForbiddenAccessException("Este convite não é para o seu e-mail.");

        return usuario;
    }

    private async Task<EmprestimoDto> ToDtoAsync(Emprestimo e, Guid usuarioId)
    {
        var nomes = await ObterNomesAsync([e]);
        return ToDto(e, usuarioId, nomes);
    }

    private async Task<Dictionary<Guid, string>> ObterNomesAsync(List<Emprestimo> items)
    {
        var ids = items.Select(e => e.CriadoPor)
            .Concat(items.Where(e => e.ContraparteUsuarioId.HasValue).Select(e => e.ContraparteUsuarioId!.Value))
            .Distinct()
            .ToList();

        return await _context.Usuarios
            .Where(u => ids.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Nome);
    }

    /// <summary>Tudo relativo a quem está olhando (usuarioId), não ao CriadoPor — quem vê como
    /// contraparte enxerga Tipo/credor invertidos.</summary>
    private static EmprestimoDto ToDto(Emprestimo e, Guid usuarioId, IReadOnlyDictionary<Guid, string> nomes)
    {
        var restante = e.ValorTotal - e.ValorPago;
        var percentual = e.ValorTotal > 0 ? Math.Round(e.ValorPago / e.ValorTotal * 100, 1) : 0;
        var vencido = !e.Quitado && e.DataVencimento.HasValue && e.DataVencimento.Value.Date < DateTime.UtcNow.Date;

        var souCriador = usuarioId == e.CriadoPor;
        var vinculado = e.StatusVinculo == StatusVinculoEmprestimo.Vinculado;

        var tipoEfetivo = souCriador
            ? e.Tipo
            : (e.Tipo == TipoEmprestimo.Emprestei ? TipoEmprestimo.PeguiEmprestado : TipoEmprestimo.Emprestei);

        var souCredor = !vinculado
            ? souCriador
            : (e.Tipo == TipoEmprestimo.Emprestei ? usuarioId == e.CriadoPor : usuarioId == e.ContraparteUsuarioId);

        var pessoa = souCriador ? e.Pessoa : nomes.GetValueOrDefault(e.CriadoPor, e.Pessoa);
        var contraparteNome = souCriador
            ? (vinculado ? nomes.GetValueOrDefault(e.ContraparteUsuarioId ?? Guid.Empty) : e.Pessoa)
            : nomes.GetValueOrDefault(e.CriadoPor);

        return new EmprestimoDto
        {
            Id = e.Id,
            Descricao = e.Descricao,
            Pessoa = pessoa,
            ValorTotal = e.ValorTotal,
            ValorPago = e.ValorPago,
            ValorRestante = restante,
            PercentualPago = percentual,
            Tipo = (int)tipoEfetivo,
            TipoDescricao = tipoEfetivo == TipoEmprestimo.Emprestei ? "Emprestei" : "Peguei emprestado",
            DataInicio = e.DataInicio,
            DataVencimento = e.DataVencimento,
            Quitado = e.Quitado,
            Vencido = vencido,
            Observacao = e.Observacao,
            StatusVinculo = (int)e.StatusVinculo,
            ContraparteNome = contraparteNome,
            SouCredor = souCredor,
            TransacaoId = e.TransacaoId,
            FormaPagamento = (int)e.FormaPagamento,
            TaxaJuroMensal = e.TaxaJuroMensal,
            PercentualMultaAtraso = e.PercentualMultaAtraso,
            QuantidadeParcelas = e.FormaPagamento == FormaPagamentoEmprestimo.Parcelado && e.Parcelas.Count > 0
                ? e.Parcelas.Count
                : null,
        };
    }

    /// <summary>Gera as N parcelas na criação — valor igual dividido, ajuste de centavos na
    /// última (mesmo padrão do Parcelamento de cartão), vencimento mensal fixo a partir da
    /// primeira. ValorComJuros calculado por parcela se a taxa foi informada.</summary>
    private static List<EmprestimoParcela> GerarParcelas(
        Guid emprestimoId, decimal valorTotal, int quantidade, DateTime primeiroVencimento,
        decimal? taxaJuroMensal)
    {
        var valorParcela = Math.Round(valorTotal / quantidade, 2, MidpointRounding.ToEven);
        var parcelas = new List<EmprestimoParcela>();
        var somaParcelas = 0m;

        for (var i = 1; i <= quantidade; i++)
        {
            var valor = i == quantidade ? valorTotal - somaParcelas : valorParcela;
            somaParcelas += valor;

            parcelas.Add(new EmprestimoParcela
            {
                Id = Guid.NewGuid(),
                EmprestimoId = emprestimoId,
                Numero = i,
                QuantidadeTotal = quantidade,
                DataVencimento = primeiroVencimento.AddMonths(i - 1).ToUniversalTime(),
                Valor = valor,
                ValorComJuros = taxaJuroMensal.HasValue
                    ? Math.Round(valor * (1 + taxaJuroMensal.Value / 100), 2)
                    : null,
                Status = StatusParcelaEmprestimo.Pendente,
            });
        }

        return parcelas;
    }

    /// <summary>Snapshot único de multa na primeira leitura após o vencimento — não recalcula
    /// depois. Retorna true se alterou (pra saber se precisa SaveChanges).</summary>
    private static bool AplicarMultaSeAtrasada(EmprestimoParcela p, Emprestimo emprestimo)
    {
        if (p.Status != StatusParcelaEmprestimo.Pendente) return false;
        if (p.DataVencimento.Date >= DateTime.UtcNow.Date) return false;
        if (p.ValorComMulta.HasValue) return false;
        if (!emprestimo.PercentualMultaAtraso.HasValue) return false;

        p.ValorComMulta = Math.Round(p.Valor * (1 + emprestimo.PercentualMultaAtraso.Value / 100), 2);
        return true;
    }

    private static EmprestimoParcelaDto ToParcelaDto(EmprestimoParcela p)
    {
        var atrasada = p.Status == StatusParcelaEmprestimo.Pendente && p.DataVencimento.Date < DateTime.UtcNow.Date;
        return new EmprestimoParcelaDto
        {
            Id = p.Id,
            EmprestimoId = p.EmprestimoId,
            Numero = p.Numero,
            QuantidadeTotal = p.QuantidadeTotal,
            DataVencimento = p.DataVencimento,
            Valor = p.Valor,
            ValorComJuros = p.ValorComJuros,
            ValorComMulta = p.ValorComMulta,
            Status = (int)p.Status,
            StatusDescricao = p.Status switch
            {
                StatusParcelaEmprestimo.Pendente => atrasada ? "Atrasada" : "Pendente",
                StatusParcelaEmprestimo.Paga => "Paga",
                StatusParcelaEmprestimo.Cancelada => "Cancelada",
                _ => p.Status.ToString(),
            },
            Atrasada = atrasada,
            SolicitacaoPagamentoId = p.SolicitacaoPagamentoId,
        };
    }

    private static string GerarTokenOpaco()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
