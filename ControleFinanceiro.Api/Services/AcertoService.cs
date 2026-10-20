using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Dinheiro entre vocês (passo 3 do espaço da família, docs/features/familia/espaco-da-familia.md §4.3; decisão do
/// Gustavo 2026-10-19, como o pagamento de empréstimo): só quem passou ou quem recebeu registra. Quem passou registra
/// → fica esperando quem recebeu confirmar (só aí entra no equilíbrio); quem recebeu registra → já vale. Cada um lança
/// o SEU lado numa conta sua (saída de quem passou, entrada de quem recebeu), fora do resultado (<c>EhAcerto</c>): o
/// gasto foi a parte de cada um nas despesas. Sem conta continua possível (o Pix foi por fora).
/// </summary>
public class AcertoService
{
    public const string OperacaoRegistrar = "RegistrarAcerto";

    private readonly AppDbContext _context;
    private readonly NotificacaoService _notificacaoService;
    private readonly FinancialEventLogService _eventLog;

    public AcertoService(
        AppDbContext context,
        NotificacaoService notificacaoService,
        FinancialEventLogService eventLog)
    {
        _context = context;
        _notificacaoService = notificacaoService;
        _eventLog = eventLog;
    }

    /// <summary>Registra que o dinheiro passou: com conta, o lançamento de quem registra nasce junto.</summary>
    public async Task<AcertoContasDto> RegistrarAsync(
        Guid familiaId, Guid usuarioId, RegistrarAcertoDto dto)
    {
        await ExigirEscritaAsync(familiaId, usuarioId);

        // Idempotência (RegistroIdempotencia, gravado no MESMO SaveChanges): um retry não duplica o acerto nem o
        // lançamento; a mesma chave com outros dados → 409.
        if (string.IsNullOrWhiteSpace(dto.IdempotencyKey))
            throw new InvalidOperationException("idempotencyKey é obrigatório.");
        Idempotencia.ExigirTamanho(dto.IdempotencyKey);
        var replay = await ReplayAsync(familiaId, usuarioId, dto);
        if (replay != null) return replay;

        if (dto.DeUsuarioId == dto.ParaUsuarioId)
            throw new ArgumentException("O pagador e o recebedor devem ser pessoas diferentes.");
        if (dto.Valor <= 0)
            throw new ArgumentException("O valor do acerto deve ser positivo.");

        await ExigirParticipanteMembroAsync(familiaId, dto.DeUsuarioId);
        await ExigirParticipanteMembroAsync(familiaId, dto.ParaUsuarioId);
        // O fato é de quem passou ou de quem recebeu: um terceiro não registra nem escolhe conta por eles.
        if (usuarioId != dto.DeUsuarioId && usuarioId != dto.ParaUsuarioId)
            throw new ArgumentException("Quem registra é quem passou ou quem recebeu o dinheiro.");

        var data = ValidarData(dto.Data);
        var agora = DateTime.UtcNow;
        var recebi = usuarioId == dto.ParaUsuarioId;
        var acerto = new AcertoContas
        {
            Id = Guid.NewGuid(),
            FamiliaId = familiaId,
            DeUsuarioId = dto.DeUsuarioId,
            ParaUsuarioId = dto.ParaUsuarioId,
            Valor = dto.Valor,
            Mes = dto.Mes ?? agora.Month,
            Ano = dto.Ano ?? agora.Year,
            Observacao = dto.Observacao,
            CriadoPor = usuarioId,
            Data = data,
            // Quem recebeu é quem atesta: registrado por ele, já vale.
            ConfirmadoEm = recebi ? agora : null,
        };
        _context.AcertosContas.Add(acerto);
        if (dto.ContaId is { } contaId)
            await LancarLadoAsync(acerto, usuarioId, contaId, data);

        _context.RegistrosIdempotencia.Add(Idempotencia.Novo(usuarioId, OperacaoRegistrar, dto.IdempotencyKey, acerto.Id));
        // FinancialEventLog: AcertoRegistrado — auditoria append-only, na mesma SaveChanges do acerto.
        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.AcertoRegistrado,
            entidade: "AcertoContas",
            entidadeId: acerto.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            valorAntes: null,
            valorDepois: acerto.Valor,
            payload: new
            {
                idempotencyKey = dto.IdempotencyKey,
                familiaId,
                deUsuarioId = acerto.DeUsuarioId,
                paraUsuarioId = acerto.ParaUsuarioId,
                valor = acerto.Valor,
                mes = acerto.Mes,
                ano = acerto.Ano,
                confirmado = acerto.ConfirmadoEm != null,
                transacaoId = acerto.TransacaoSaidaId ?? acerto.TransacaoEntradaId,
            });

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (Idempotencia.EhViolacaoDeUnicidade(ex))
        {
            // Corrida com a mesma chave: a outra gravou primeiro.
            _context.ChangeTracker.Clear();
            return await ReplayAsync(familiaId, usuarioId, dto)
                ?? throw new InvalidOperationException(Idempotencia.MensagemChaveConsumida);
        }

        var resultado = await MapToDtoAsync(acerto, usuarioId);
        var outro = recebi ? acerto.DeUsuarioId : acerto.ParaUsuarioId;
        await _notificacaoService.CriarAsync(
            outro,
            TipoNotificacao.AcertoContas,
            "Dinheiro entre vocês",
            recebi
                ? $"{PrimeiroNome(resultado.ParaNome)} registrou que recebeu {Reais.Formatar(acerto.Valor)} de você."
                : $"{PrimeiroNome(resultado.DeNome)} passou {Reais.Formatar(acerto.Valor)} pra você. Confirme em qual conta entrou.",
            LinkEntreVoces(familiaId));
        return resultado;
    }

    /// <summary>Quem recebeu confirma: entra no equilíbrio e, com conta, nasce a entrada dele.</summary>
    public async Task<AcertoContasDto> ConfirmarAsync(Guid familiaId, Guid acertoId, Guid usuarioId, ContaDoAcertoDto dto)
    {
        await ExigirEscritaAsync(familiaId, usuarioId);
        var acerto = await BuscarAtivoAsync(familiaId, acertoId);
        if (usuarioId != acerto.ParaUsuarioId)
            throw new ForbiddenAccessException("Só quem recebeu o dinheiro confirma.");
        if (acerto.ConfirmadoEm != null)
            throw new InvalidOperationException("Esse dinheiro já foi confirmado.");

        acerto.ConfirmadoEm = DateTime.UtcNow;
        if (dto.ContaId is { } contaId)
            await LancarLadoAsync(acerto, usuarioId, contaId, ValidarData(dto.Data ?? acerto.Data));
        RegistrarConfirmacao(acerto, usuarioId, familiaId);
        await _context.SaveChangesAsync(); // xmin: duas confirmações ao mesmo tempo → a segunda dá 409

        var resultado = await MapToDtoAsync(acerto, usuarioId);
        await _notificacaoService.CriarAsync(
            acerto.DeUsuarioId,
            TipoNotificacao.AcertoContas,
            "Dinheiro entre vocês",
            $"{PrimeiroNome(resultado.ParaNome)} confirmou os {Reais.Formatar(acerto.Valor)} que você passou.",
            LinkEntreVoces(familiaId));
        return resultado;
    }

    /// <summary>Lança o SEU lado depois (registrou sem conta, ou o outro registrou): a saída de quem passou ou a
    /// entrada de quem recebeu (esta só depois de confirmar).</summary>
    public async Task<AcertoContasDto> LancarNaMinhaContaAsync(Guid familiaId, Guid acertoId, Guid usuarioId, ContaDoAcertoDto dto)
    {
        await ExigirEscritaAsync(familiaId, usuarioId);
        var acerto = await BuscarAtivoAsync(familiaId, acertoId);
        if (usuarioId != acerto.DeUsuarioId && usuarioId != acerto.ParaUsuarioId)
            throw new ForbiddenAccessException("Só quem passou ou quem recebeu lança esse dinheiro na conta.");
        var contaId = dto.ContaId ?? throw new ArgumentException("Escolha a conta.");
        if (usuarioId == acerto.ParaUsuarioId && acerto.ConfirmadoEm == null)
            throw new InvalidOperationException("Confirme primeiro que o dinheiro entrou.");
        if ((usuarioId == acerto.DeUsuarioId ? acerto.TransacaoSaidaId : acerto.TransacaoEntradaId) != null)
            throw new InvalidOperationException("Esse dinheiro já está lançado na sua conta.");

        await LancarLadoAsync(acerto, usuarioId, contaId, ValidarData(dto.Data ?? acerto.Data));
        RegistrarConfirmacao(acerto, usuarioId, familiaId);
        await _context.SaveChangesAsync(); // xmin: lançar duas vezes ao mesmo tempo → a segunda dá 409
        return await MapToDtoAsync(acerto, usuarioId);
    }

    /// <summary>Lista os acertos ativos da família (opcionalmente filtrados por mês/ano).</summary>
    public async Task<List<AcertoContasDto>> ListarAsync(
        Guid familiaId, Guid usuarioId, int? mes, int? ano, Guid? deUsuarioId = null)
    {
        await ExigirMembroAsync(familiaId, usuarioId);

        var query = _context.AcertosContas
            .Where(a => a.FamiliaId == familiaId && a.Ativo);

        if (mes is not null)
            query = query.Where(a => a.Mes == mes);
        if (ano is not null)
            query = query.Where(a => a.Ano == ano);
        // Filtro "quem pagou" das Transações da família: no acerto, é quem passou o dinheiro.
        if (deUsuarioId is { } de)
            query = query.Where(a => a.DeUsuarioId == de);

        var acertos = await query
            .OrderByDescending(a => a.CriadoEm)
            .Select(a => new
            {
                a.Id, a.DeUsuarioId, DeNome = a.DeUsuario!.Nome,
                a.ParaUsuarioId, ParaNome = a.ParaUsuario!.Nome,
                a.Valor, a.Mes, a.Ano, a.Observacao, a.CriadoEm, a.Data, a.ConfirmadoEm,
                a.TransacaoSaidaId, a.TransacaoEntradaId,
            })
            .ToListAsync();

        return acertos
            .Select(a => new AcertoContasDto(
                a.Id, a.DeUsuarioId, a.DeNome, a.ParaUsuarioId, a.ParaNome,
                a.Valor, a.Mes, a.Ano, a.Observacao, a.CriadoEm, a.Data, a.ConfirmadoEm,
                MinhaTransacao(usuarioId, a.DeUsuarioId, a.ParaUsuarioId, a.TransacaoSaidaId, a.TransacaoEntradaId)))
            .ToList();
    }

    /// <summary>Desfaz o acerto (soft delete — preserva o histórico) e cancela os lançamentos dele nas contas.
    /// Também é o "Não recebi" de quem recebeu.</summary>
    public async Task CancelarAsync(Guid familiaId, Guid acertoId, Guid usuarioId)
    {
        await ExigirEscritaAsync(familiaId, usuarioId);

        var acerto = await _context.AcertosContas
            .FirstOrDefaultAsync(a => a.Id == acertoId && a.FamiliaId == familiaId && a.Ativo)
            ?? throw new KeyNotFoundException("Acerto não encontrado.");

        // Authz: só quem registrou o acerto ou as duas partes (pagador/recebedor)
        // podem cancelá-lo. Um terceiro membro da família não mexe no acerto alheio.
        var podeCancelar = usuarioId == acerto.CriadoPor
            || usuarioId == acerto.DeUsuarioId
            || usuarioId == acerto.ParaUsuarioId;
        if (!podeCancelar)
            throw new ForbiddenAccessException(
                "Só quem registrou o acerto ou as partes envolvidas podem cancelá-lo.");

        acerto.Ativo = false;
        var ids = new[] { acerto.TransacaoSaidaId, acerto.TransacaoEntradaId }.OfType<Guid>().ToList();
        if (ids.Count > 0)
        {
            var agora = DateTime.UtcNow;
            foreach (var t in await _context.Transacoes.Where(t => ids.Contains(t.Id) && t.Ativo).ToListAsync())
            {
                t.Ativo = false;
                t.CanceladoEm = agora;
            }
        }

        // FinancialEventLog: AcertoCancelado — auditoria da reversão de balanço.
        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.AcertoCancelado,
            entidade: "AcertoContas",
            entidadeId: acerto.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            valorAntes: acerto.Valor,
            valorDepois: 0m,
            payload: new
            {
                familiaId,
                deUsuarioId = acerto.DeUsuarioId,
                paraUsuarioId = acerto.ParaUsuarioId,
                valor = acerto.Valor,
                transacoesCanceladas = ids,
            });

        await _context.SaveChangesAsync();
    }

    // ── peças ──

    /// <summary>O lançamento do lado de quem pede: saída (passou) ou entrada (recebeu), na conta dele, fora do
    /// resultado. "Acerto com Gabriel · Casa Pontes".</summary>
    private async Task LancarLadoAsync(AcertoContas acerto, Guid usuarioId, Guid contaId, DateOnly data)
    {
        await DonoRecursos.ExigirContaAbertaAsync(_context, contaId, usuarioId);
        var passei = usuarioId == acerto.DeUsuarioId;
        var outroId = passei ? acerto.ParaUsuarioId : acerto.DeUsuarioId;
        var outro = await _context.Usuarios.Where(u => u.Id == outroId).Select(u => u.Nome).FirstOrDefaultAsync() ?? "";
        var familia = await _context.Familias.Where(f => f.Id == acerto.FamiliaId).Select(f => f.Nome).FirstOrDefaultAsync() ?? "família";
        var descricao = $"Acerto com {PrimeiroNome(outro)} · {familia}";
        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = descricao.Length > 400 ? descricao[..400] : descricao,
            Valor = acerto.Valor,
            Tipo = passei ? TipoTransacao.Despesa : TipoTransacao.Receita,
            ContaId = contaId,
            CriadoPor = usuarioId,
            Data = data,
            Hora = null, // datado, sem hora de relógio
            StatusTransacao = StatusTransacao.Executado,
            EhAcerto = true, // dinheiro entre vocês: mexe no saldo, fora do resultado
        };
        _context.Transacoes.Add(transacao);
        if (passei) acerto.TransacaoSaidaId = transacao.Id;
        else acerto.TransacaoEntradaId = transacao.Id;
    }

    private void RegistrarConfirmacao(AcertoContas acerto, Guid usuarioId, Guid familiaId) =>
        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.AcertoConfirmado,
            entidade: "AcertoContas",
            entidadeId: acerto.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            valorAntes: null,
            valorDepois: acerto.Valor,
            payload: new
            {
                familiaId,
                confirmado = acerto.ConfirmadoEm != null,
                transacaoSaidaId = acerto.TransacaoSaidaId,
                transacaoEntradaId = acerto.TransacaoEntradaId,
            });

    private async Task<AcertoContasDto?> ReplayAsync(Guid familiaId, Guid usuarioId, RegistrarAcertoDto dto)
    {
        var registro = await Idempotencia.BuscarAsync(_context, usuarioId, OperacaoRegistrar, dto.IdempotencyKey);
        if (registro is null) return null;
        var anterior = await _context.AcertosContas.FirstOrDefaultAsync(a => a.Id == registro.ReferenciaId)
            ?? throw new InvalidOperationException(Idempotencia.MensagemChaveConsumida);
        if (anterior.FamiliaId != familiaId || anterior.DeUsuarioId != dto.DeUsuarioId
            || anterior.ParaUsuarioId != dto.ParaUsuarioId || anterior.Valor != dto.Valor)
            throw new InvalidOperationException(Idempotencia.MensagemChaveComOutrosDados);
        return await MapToDtoAsync(anterior, usuarioId);
    }

    private async Task<AcertoContas> BuscarAtivoAsync(Guid familiaId, Guid acertoId) =>
        await _context.AcertosContas.FirstOrDefaultAsync(a => a.Id == acertoId && a.FamiliaId == familiaId && a.Ativo)
        ?? throw new KeyNotFoundException("Acerto não encontrado.");

    /// <summary>O dia em que o dinheiro passou: o da tela, nunca no futuro (sem ele, hoje).</summary>
    private static DateOnly ValidarData(DateOnly? data)
    {
        // A data da tela é a do aparelho (Brasil, atrás do UTC): nunca passa do dia UTC de hoje.
        var hoje = DateOnly.FromDateTime(DateTime.UtcNow);
        var d = data ?? hoje;
        if (d > hoje)
            throw new ArgumentException("O dia em que o dinheiro passou não pode ser no futuro.");
        return d;
    }

    private static Guid? MinhaTransacao(Guid usuarioId, Guid de, Guid para, Guid? saida, Guid? entrada) =>
        usuarioId == de ? saida : usuarioId == para ? entrada : null;

    private static string PrimeiroNome(string nome) =>
        nome.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? nome;

    private static string LinkEntreVoces(Guid familiaId) => $"/familias/{familiaId}/entre-voces";

    private async Task<AcertoContasDto> MapToDtoAsync(AcertoContas acerto, Guid usuarioId)
    {
        var nomes = await _context.Usuarios
            .Where(u => u.Id == acerto.DeUsuarioId || u.Id == acerto.ParaUsuarioId)
            .ToDictionaryAsync(u => u.Id, u => u.Nome);

        return new AcertoContasDto(
            acerto.Id,
            acerto.DeUsuarioId, nomes.GetValueOrDefault(acerto.DeUsuarioId, "—"),
            acerto.ParaUsuarioId, nomes.GetValueOrDefault(acerto.ParaUsuarioId, "—"),
            acerto.Valor, acerto.Mes, acerto.Ano, acerto.Observacao, acerto.CriadoEm,
            acerto.Data, acerto.ConfirmadoEm,
            MinhaTransacao(usuarioId, acerto.DeUsuarioId, acerto.ParaUsuarioId, acerto.TransacaoSaidaId, acerto.TransacaoEntradaId));
    }

    // Leitura: qualquer membro. Escrita: bloqueia Dependente (2.3).
    private Task ExigirMembroAsync(Guid familiaId, Guid usuarioId)
        => FamiliaPermissoes.ExigirMembroAsync(_context, familiaId, usuarioId);

    private Task ExigirEscritaAsync(Guid familiaId, Guid usuarioId)
        => FamiliaPermissoes.ExigirLancarAsync(_context, familiaId, usuarioId);

    /// <summary>Quem passa e quem recebe têm que lançar na família (quem "só vê" não entra na divisão, então não
    /// passa nem recebe dinheiro pra equilibrar). Erro de input, não 404.</summary>
    private async Task ExigirParticipanteMembroAsync(Guid familiaId, Guid usuarioId)
    {
        if (!await FamiliaPermissoes.LancaNaFamiliaAsync(_context, familiaId, usuarioId))
            throw new ArgumentException("Pagador e recebedor devem ser membros ativos da família que dividem as despesas.");
    }
}
