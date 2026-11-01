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

    public async Task<PagedResult<EmprestimoDto>> ListarAsync(
        Guid usuarioId, int page = 1, int pageSize = 25, bool incluirArquivados = false,
        string? busca = null, string? direcao = null,
        string? situacao = null, string? forma = null,
        decimal? valorMin = null, decimal? valorMax = null,
        DateTime? vencDe = null, DateTime? vencAte = null)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = VisivelPara(usuarioId);
        if (!incluirArquivados)
        {
            // Arquivar é por-usuário — esconde só do lado de quem arquivou, sem afetar a visão
            // do outro participante nem apagar nada.
            query = query.Where(e =>
                !((e.CriadoPor == usuarioId && e.ArquivadoPorCriador)
                    || (e.ContraparteUsuarioId == usuarioId && e.ArquivadoPorContraparte)));
        }

        // Busca server-side (descrição, pessoa digitada, ou nome da contraparte vinculada).
        // ToLower().Contains() é portável (InMemory nos testes + lower()/LIKE no Postgres).
        // Limita o termo pra não virar vetor de custo; EF parametriza (sem SQL injection).
        if (!string.IsNullOrWhiteSpace(busca))
        {
            var termo = busca.Trim().ToLower();
            if (termo.Length > 100) termo = termo[..100];
            query = query.Where(e =>
                e.Descricao.ToLower().Contains(termo)
                || e.Pessoa.ToLower().Contains(termo)
                || (e.ContraparteUsuarioId != null
                    && _context.Usuarios.Any(u => u.Id == e.ContraparteUsuarioId && u.Nome.ToLower().Contains(termo))));
        }

        // Direção (a receber / a pagar) — mesmo predicado dos KPIs, pra bater com o hero.
        if (direcao == "receber")
            query = query.Where(e => (e.CriadoPor == usuarioId && e.Tipo == TipoEmprestimo.Emprestei)
                                  || (e.CriadoPor != usuarioId && e.Tipo == TipoEmprestimo.PeguiEmprestado));
        else if (direcao == "pagar")
            query = query.Where(e => (e.CriadoPor == usuarioId && e.Tipo == TipoEmprestimo.PeguiEmprestado)
                                  || (e.CriadoPor != usuarioId && e.Tipo == TipoEmprestimo.Emprestei));

        // Situação: ativos (em aberto) ou quitados. "Vencido" é derivado (parcela/à vista) e vira
        // badge na linha, não filtro — evita query pesada por parcela aqui.
        if (situacao == "ativo") query = query.Where(e => !e.Quitado);
        else if (situacao == "quitado") query = query.Where(e => e.Quitado);

        // Forma de pagamento.
        if (forma == "avista") query = query.Where(e => e.FormaPagamento == FormaPagamentoEmprestimo.AVista);
        else if (forma == "parcelado") query = query.Where(e => e.FormaPagamento == FormaPagamentoEmprestimo.Parcelado);

        // Faixa do valor restante (ValorTotal - ValorPago) — mesmo número da coluna Restante.
        if (valorMin.HasValue) query = query.Where(e => e.ValorTotal - e.ValorPago >= valorMin.Value);
        if (valorMax.HasValue) query = query.Where(e => e.ValorTotal - e.ValorPago <= valorMax.Value);

        // Período de vencimento — só alcança quem tem DataVencimento no nível do registro.
        if (vencDe.HasValue) query = query.Where(e => e.DataVencimento != null && e.DataVencimento >= vencDe.Value);
        if (vencAte.HasValue) query = query.Where(e => e.DataVencimento != null && e.DataVencimento <= vencAte.Value);

        query = query
            .OrderBy(e => e.Quitado)
            .ThenBy(e => e.DataVencimento)
            .ThenBy(e => e.DataInicio);

        var total = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var nomes = await ObterNomesAsync(items);
        var agregados = await ObterAgregadosSolicitacaoAsync(items.Select(e => e.Id).ToList());

        var alterouMulta = false;
        foreach (var e in items)
            alterouMulta |= AplicarMultaAVistaSeAtrasada(e);
        if (alterouMulta)
            await _context.SaveChangesAsync();

        return new PagedResult<EmprestimoDto>
        {
            Items = items.Select(e => ToDto(e, usuarioId, nomes, agregados)),
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

        var qtdAtivos = await ativos.CountAsync();
        var qtdTotal = await query.CountAsync();

        var hoje = HorarioBrasil.HojeData();
        // Parcelado precisa somar por parcela vencida (nem todo empréstimo tem DataVencimento no
        // nível do registro) — volume pequeno (empréstimos pessoais), avaliação em memória é ok.
        var aReceberAtivos = await ativos
            .Where(e => (e.CriadoPor == usuarioId && e.Tipo == TipoEmprestimo.Emprestei)
                     || (e.CriadoPor != usuarioId && e.Tipo == TipoEmprestimo.PeguiEmprestado))
            .ToListAsync();
        var aPagarAtivos = await ativos
            .Where(e => (e.CriadoPor == usuarioId && e.Tipo == TipoEmprestimo.PeguiEmprestado)
                     || (e.CriadoPor != usuarioId && e.Tipo == TipoEmprestimo.Emprestei))
            .ToListAsync();

        // Vencido = parcela pendente vencida (parcelado) ou registro vencido não quitado (à vista),
        // sempre no restante (com multa/juros quando houver). Mesma regra pros dois lados.
        decimal SomaVencido(List<Emprestimo> lista) => lista.Sum(e => e.FormaPagamento == FormaPagamentoEmprestimo.Parcelado
            ? e.Parcelas.Where(p => p.Status == StatusParcelaEmprestimo.Pendente && p.DataVencimento.Date < hoje)
                .Sum(RestanteDaParcela)
            : (e.DataVencimento.HasValue && e.DataVencimento.Value.Date < hoje ? RestanteAVista(e) : 0m));
        // A receber / a pagar: o que falta com os juros (RestanteComJuros), não só o capital.
        var totalAReceber = aReceberAtivos.Sum(RestanteComJuros);
        var totalAPagar = aPagarAtivos.Sum(RestanteComJuros);
        var totalAReceberVencido = SomaVencido(aReceberAtivos);
        var totalAPagarVencido = SomaVencido(aPagarAtivos);

        return new EmprestimoStatsDto
        {
            TotalAReceber = totalAReceber,
            TotalAPagar = totalAPagar,
            Ativos = qtdAtivos,
            QtdTotal = qtdTotal,
            TotalAReceberVencido = totalAReceberVencido,
            TotalAPagarVencido = totalAPagarVencido,
        };
    }

    public async Task<EmprestimoDto?> BuscarPorIdAsync(Guid id, Guid usuarioId)
    {
        var e = await VisivelPara(usuarioId).FirstOrDefaultAsync(x => x.Id == id);
        if (e is null) return null;
        if (AplicarMultaAVistaSeAtrasada(e)) await _context.SaveChangesAsync();
        return await ToDtoAsync(e, usuarioId);
    }

    public async Task<EmprestimoDto> CriarAsync(CriarEmprestimoDto dto, Guid usuarioId)
    {
        if (dto.ValorTotal <= 0)
            throw new ArgumentException("Valor total do empréstimo deve ser positivo.");

        if (dto.DataVencimento.HasValue && dto.DataVencimento.Value.Date < dto.DataInicio.Date)
            throw new ArgumentException("Data de vencimento não pode ser anterior à data de início.");

        if (string.IsNullOrWhiteSpace(dto.IdempotencyKey))
            throw new ArgumentException("idempotencyKey é obrigatório.");

        // Juros e multa em % (front e back): nunca negativo; juros até 100% ao mês, multa até 100%.
        if (dto.TaxaJuroMensal is < 0 or > 100)
            throw new ArgumentException("Juros: de 0 a 100% ao mês.");
        if (dto.PercentualMultaAtraso is < 0 or > 100)
            throw new ArgumentException("Multa: de 0 a 100%.");

        if (dto.FormaPagamento == FormaPagamentoEmprestimo.Parcelado)
        {
            if (!dto.QuantidadeParcelas.HasValue || dto.QuantidadeParcelas.Value < 2 || dto.QuantidadeParcelas.Value > 36)
                throw new ArgumentException("Quantidade de parcelas deve ser entre 2 e 36.");
            if (!dto.PrimeiroVencimento.HasValue)
                throw new ArgumentException("Informe o vencimento da primeira parcela.");
            if (dto.ValorParcela.HasValue)
            {
                if (dto.TaxaJuroMensal.HasValue)
                    throw new ArgumentException("Informe os juros ao mês ou o valor da parcela, não os dois.");
                if (dto.ValorParcela.Value * dto.QuantidadeParcelas.Value < dto.ValorTotal)
                    throw new ArgumentException("As parcelas somam menos do que o valor do empréstimo.");
            }
        }

        // Banco é opcional; se informado tem que existir e estar ativo (catálogo global).
        if (dto.BancoId.HasValue)
        {
            var bancoOk = await _context.Bancos.AnyAsync(b => b.Id == dto.BancoId.Value && b.Ativo);
            if (!bancoOk)
                throw new ArgumentException("Banco inválido ou inativo.");

            // Pessoa física não empresta pra banco (isso seria investimento, fora do escopo).
            // Empréstimo bancário é sempre "peguei emprestado". Regra: regras.md §2.2.
            if (dto.Tipo != TipoEmprestimo.PeguiEmprestado)
                throw new ArgumentException("Empréstimo com banco só pode ser do tipo 'peguei emprestado'.");
        }

        var replay = await _eventLog.BuscarPorIdempotencyKeyAsync(usuarioId, dto.IdempotencyKey);
        if (replay != null && replay.Tipo == FinancialEventType.EmprestimoCriado)
        {
            var anterior = await _context.Emprestimos
                .Include(e => e.Parcelas)
                .Include(e => e.Banco)
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

            existente.EhEmprestimo = true; // dinheiro de empréstimo: fora do resultado do mês
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
                EhEmprestimo = true, // vai e volta, como transferência: fora do resultado do mês
                ContaId = dto.ContaId,
                CategoriaId = dto.CategoriaId,
                Data = DateOnly.FromDateTime(dto.DataInicio), // o dia que a pessoa escolheu (sem converter pro fuso da máquina)
                Hora = null, // lançamento de empréstimo é datado (sem hora de relógio)
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
            BancoId = dto.BancoId,
            Origem = OrigemEmprestimo.Manual,
            TransacaoId = transacaoId,
            FormaPagamento = dto.FormaPagamento,
            TaxaJuroMensal = dto.TaxaJuroMensal,
            PercentualMultaAtraso = dto.PercentualMultaAtraso,
        };

        if (dto.FormaPagamento == FormaPagamentoEmprestimo.Parcelado && dto.ValorParcela.HasValue)
        {
            foreach (var parcela in GerarParcelasPrice(
                emprestimo.Id, dto.ValorTotal, dto.ValorParcela.Value, dto.QuantidadeParcelas!.Value, dto.PrimeiroVencimento!.Value))
                emprestimo.Parcelas.Add(parcela);
        }
        else if (dto.FormaPagamento == FormaPagamentoEmprestimo.Parcelado)
        {
            foreach (var parcela in GerarParcelas(
                emprestimo.Id, dto.ValorTotal, dto.QuantidadeParcelas!.Value,
                dto.PrimeiroVencimento!.Value, dto.TaxaJuroMensal))
                emprestimo.Parcelas.Add(parcela);
        }
        else if (dto.TaxaJuroMensal.HasValue)
        {
            // À vista com juros — markup fixo uma vez sobre o total, mesma regra "sem compor"
            // já decidida pra parcela (Gustavo, 2026-08-08: "mesma regra do Parcelado").
            emprestimo.ValorComJuros = Math.Round(dto.ValorTotal * (1 + dto.TaxaJuroMensal.Value / 100), 2);
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

        // Quitar na marra passa por cima de qualquer solicitação Pendente esquecida — sem isso,
        // ela fica presa pra sempre (badge "Aguardando aprovação" num empréstimo que já acabou,
        // achado do Gustavo: "isso que a gente excluiu... tem que sumir"). Rejeita automaticamente,
        // com motivo explícito, e avisa quem tinha solicitado.
        var pendentes = await _context.EmprestimoPagamentoSolicitacoes
            .Where(s => s.EmprestimoId == e.Id && s.StatusAprovacao == StatusAprovacaoPagamentoEmprestimo.Pendente)
            .ToListAsync();
        foreach (var sol in pendentes)
        {
            sol.StatusAprovacao = StatusAprovacaoPagamentoEmprestimo.Rejeitada;
            sol.AprovadoPorUsuarioId = usuarioId;
            sol.AprovadoEm = DateTime.UtcNow;
            sol.MotivoRejeicao = "Empréstimo quitado diretamente antes da aprovação.";

            _eventLog.Registrar(
                usuarioId: usuarioId,
                tipo: FinancialEventType.EmprestimoPagamentoRejeitado,
                entidade: "EmprestimoPagamentoSolicitacao",
                entidadeId: sol.Id,
                correlationId: Guid.NewGuid(),
                origemAcao: "API",
                payload: new { sol.Id, emprestimoId = e.Id, motivo = sol.MotivoRejeicao });
        }

        await _context.SaveChangesAsync();

        foreach (var sol in pendentes)
        {
            await _notificacaoService.CriarAsync(
                sol.SolicitadoPor,
                TipoNotificacao.EmprestimoPagamentoAvaliado,
                "Pagamento rejeitado",
                $"\"{e.Descricao}\" foi quitado diretamente: sua solicitação de {Reais.Formatar(sol.Valor)} não foi aprovada.",
                "/emprestimos");
        }

        return true;
    }

    /// <summary>Esconde da lista principal do lado de quem chamou, sem apagar nada nem afetar a
    /// visão do outro participante — decisão pessoal de organização (achado do Gustavo,
    /// 2026-08-13: "quando eu quito ele fica meio apagado mas não consigo excluir"; apagar quitado
    /// fica bloqueado de propósito pra proteger o histórico compartilhado, arquivar resolve a
    /// poluição visual sem esse risco). Só permitido pra empréstimo Quitado — arquivar um em
    /// andamento não faz sentido. Idempotente (já arquivado → no-op).</summary>
    public async Task<bool> ArquivarAsync(Guid id, Guid usuarioId)
    {
        var e = await VisivelPara(usuarioId).FirstOrDefaultAsync(x => x.Id == id);
        if (e is null) return false;

        if (!e.Quitado)
            throw new ArgumentException("Só dá pra arquivar um empréstimo quitado.");

        if (e.CriadoPor == usuarioId) e.ArquivadoPorCriador = true;
        else e.ArquivadoPorContraparte = true;

        await _context.SaveChangesAsync();
        return true;
    }

    /// <summary>Reverte ArquivarAsync — volta a aparecer na lista principal do lado de quem
    /// chamou. Idempotente.</summary>
    public async Task<bool> DesarquivarAsync(Guid id, Guid usuarioId)
    {
        var e = await VisivelPara(usuarioId).FirstOrDefaultAsync(x => x.Id == id);
        if (e is null) return false;

        if (e.CriadoPor == usuarioId) e.ArquivadoPorCriador = false;
        else e.ArquivadoPorContraparte = false;

        await _context.SaveChangesAsync();
        return true;
    }

    /// <summary>Soft delete — nunca hard-delete (CLAUDE.md). Vinculado só bloqueia se já tem
    /// atividade real (pagamento registrado por qualquer lado, aprovado ou não) — a outra parte
    /// já viu/interagiu com esse registro, apagar apagaria o rastro dela também. Sem atividade
    /// (aceite bilateral, mas ninguém pagou nada ainda) pode apagar — achado do Gustavo: "e se eu
    /// colocar valor errado como faz?" (2026-08-08).</summary>
    public async Task<bool> DeletarAsync(Guid id, Guid usuarioId)
    {
        var e = await _context.Emprestimos
            .Include(x => x.Parcelas)
            .FirstOrDefaultAsync(x => x.Id == id && x.CriadoPor == usuarioId && x.Ativo);
        if (e is null) return false;

        if (e.StatusVinculo == StatusVinculoEmprestimo.Vinculado)
        {
            var temAtividade = e.ValorPago > 0
                || e.Parcelas.Any(p => p.Status == StatusParcelaEmprestimo.Paga)
                || await _context.EmprestimoPagamentoSolicitacoes.AnyAsync(s => s.EmprestimoId == e.Id);
            if (temAtividade)
                throw new ForbiddenAccessException(
                    "Não é possível apagar um empréstimo vinculado com pagamento registrado. Quite em vez disso.");
        }

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
                "Já existe um convite pendente. Espere a resposta ou espere ele expirar (7 dias) antes de reenviar.");

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
                nomes.GetValueOrDefault(e.CriadoPor, "Alguém"),
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
            criador?.Nome ?? "Sem descrição",
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
    /// <summary>Registra pagamento — devedor OU credor podem chamar, mesmo formulário pros dois
    /// papéis (unificado em 2026-08-08, achado do Gustavo: dois caminhos diferentes pro mesmo
    /// conceito, dependendo do papel na ponta, quebrava usabilidade). Devedor: cria comprovante
    /// (Despesa), nasce Pendente, credor aprova depois. Credor: cria recebimento (Receita), nasce
    /// já Aprovada — confirmando o que ele mesmo recebeu não precisa de autoaprovação (mesmo
    /// padrão do Splitwise: settle-up sem confirmação obrigatória do outro lado, só notifica).</summary>
    public async Task<List<EmprestimoPagamentoSolicitacaoDto>> SolicitarPagamentoAsync(
        Guid emprestimoId, SolicitarPagamentoEmprestimoDto dto, Guid usuarioId)
    {
        if (string.IsNullOrWhiteSpace(dto.IdempotencyKey))
            throw new ArgumentException("idempotencyKey é obrigatório.");

        var replay = await _eventLog.BuscarPorIdempotencyKeyAsync(usuarioId, dto.IdempotencyKey);
        if (replay != null && (replay.Tipo == FinancialEventType.EmprestimoPagamentoSolicitado
            || replay.Tipo == FinancialEventType.EmprestimoPagamentoAprovado))
        {
            var anterior = await _context.EmprestimoPagamentoSolicitacoes
                .FirstOrDefaultAsync(x => x.Id == replay.EntidadeId);
            if (anterior != null) return [await ToSolicitacaoDtoAsync(anterior)];
        }

        var emprestimo = await _context.Emprestimos.FirstOrDefaultAsync(e => e.Id == emprestimoId && e.Ativo
            && (e.CriadoPor == usuarioId || e.ContraparteUsuarioId == usuarioId))
            ?? throw new KeyNotFoundException("Empréstimo não encontrado.");

        // Sem vínculo (ou convite ainda pendente), só o criador chega até aqui (ContraparteUsuarioId
        // só existe depois de aceito) — logo souCredor é sempre true nesse caso, mesmo raciocínio
        // de "registro solo, sem contraparte pra avisar" já usado no resto do módulo.
        var souCredor = EhCredor(emprestimo, usuarioId);
        // O lado do DINHEIRO é outro: quem emprestou recebe (receita), quem pegou devolve (despesa). Sem vínculo, o
        // criador controla tudo (souCredor) mesmo quando pegou emprestado, e o lançamento tem que ser a saída dele.
        // Antes o tipo seguia o souCredor: devolver um "Peguei" sem vínculo (empréstimo de banco, por exemplo) virava
        // RECEITA "Recebimento empréstimo" e o saldo subia em vez de descer (achado 2026-10-19).
        var euEmprestei = emprestimo.CriadoPor == usuarioId
            ? emprestimo.Tipo == TipoEmprestimo.Emprestei
            : emprestimo.Tipo == TipoEmprestimo.PeguiEmprestado;

        Transacao transacao;
        decimal valor;
        var tipoEsperado = euEmprestei ? TipoTransacao.Receita : TipoTransacao.Despesa;

        if (dto.TransacaoExistenteId.HasValue)
        {
            // Já lançou essa saída/entrada por fora — vincula em vez de criar outra (mesmo
            // raciocínio nos 3 pontos de risco do módulo: criar empréstimo, solicitar, aprovar).
            transacao = await _context.Transacoes
                .FirstOrDefaultAsync(t => t.Id == dto.TransacaoExistenteId.Value && t.CriadoPor == usuarioId)
                ?? throw new KeyNotFoundException("Transação não encontrada.");

            if (transacao.Tipo != tipoEsperado)
                throw new ArgumentException(euEmprestei
                    ? "A transação vinculada precisa ser uma receita."
                    : "A transação vinculada precisa ser uma despesa.");

            var jaVinculada = souCredor
                ? await _context.EmprestimoPagamentoSolicitacoes.AnyAsync(s => s.TransacaoRecebimentoId == transacao.Id)
                : await _context.EmprestimoPagamentoSolicitacoes.AnyAsync(s =>
                    s.TransacaoComprovanteId == transacao.Id && s.StatusAprovacao != StatusAprovacaoPagamentoEmprestimo.Rejeitada);
            if (jaVinculada)
                throw new InvalidOperationException("Essa transação já está vinculada a outra solicitação de pagamento.");

            transacao.EhEmprestimo = true; // dinheiro de empréstimo: fora do resultado do mês
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
                Descricao = euEmprestei
                    ? $"Recebimento empréstimo: {emprestimo.Descricao}"
                    : $"Pagamento empréstimo: {emprestimo.Descricao}",
                Valor = dto.Valor,
                Tipo = tipoEsperado,
                EhEmprestimo = true, // vai e volta, como transferência: fora do resultado do mês
                ContaId = dto.ContaId,
                CategoriaId = dto.CategoriaId,
                Data = DateOnly.FromDateTime(dto.Data), // o dia que a pessoa escolheu (sem converter pro fuso da máquina)
                Hora = null, // pagamento/recebimento de empréstimo é datado (sem hora de relógio)
            }, usuarioId);
            valor = dto.Valor;
        }

        var solicitacoesCriadas = new List<EmprestimoPagamentoSolicitacao>();

        if (emprestimo.FormaPagamento == FormaPagamentoEmprestimo.Parcelado)
        {
            // Sem escolha manual de parcela — aplica o valor em sequência nas parcelas pendentes
            // mais antigas (mesmo princípio de amortização bancária: excedente abate as parcelas
            // seguintes). Se não fechar uma parcela inteira, aplica como adiantamento parcial nela
            // (mesma lógica de pagar uma fatura de cartão antes de fechar — abate o que falta, sem
            // sumir com o resto) em vez de descartar a sobra. Exclui parcela com solicitação ainda
            // Pendente (não confirmada) — evita reclamar a mesma parcela duas vezes enquanto uma
            // está esperando o credor decidir; solicitação já Aprovada não bloqueia (parcial já
            // aplicado, parcela continua Pendente até fechar, pode receber outro pagamento).
            var parcelaIdsComSolicitacaoAtiva = await _context.EmprestimoPagamentoSolicitacoes
                .Where(s => s.EmprestimoId == emprestimo.Id && s.ParcelaId.HasValue
                    && s.StatusAprovacao == StatusAprovacaoPagamentoEmprestimo.Pendente)
                .Select(s => s.ParcelaId!.Value)
                .ToListAsync();

            var parcelasPendentes = await _context.EmprestimoParcelas
                .Where(p => p.EmprestimoId == emprestimo.Id && p.Status == StatusParcelaEmprestimo.Pendente
                    && !parcelaIdsComSolicitacaoAtiva.Contains(p.Id))
                .OrderBy(p => p.Numero)
                .ToListAsync();

            var restante = valor;
            foreach (var p in parcelasPendentes)
            {
                if (restante <= 0) break;

                var valorTotalDevido = p.ValorComMulta ?? p.ValorComJuros ?? p.Valor;
                var valorDevido = valorTotalDevido - p.ValorPago;
                var valorAplicado = Math.Min(restante, valorDevido);
                var juros = JurosNaParcela(p, valorAplicado); // antes de somar no ValorPago da parcela

                var sol = new EmprestimoPagamentoSolicitacao
                {
                    Id = Guid.NewGuid(), EmprestimoId = emprestimo.Id, Valor = valorAplicado,
                    SolicitadoPor = usuarioId, ParcelaId = p.Id, ValorJuros = juros > 0 ? juros : null,
                };
                if (souCredor)
                {
                    sol.TransacaoRecebimentoId = transacao.Id;
                    sol.StatusAprovacao = StatusAprovacaoPagamentoEmprestimo.Aprovada;
                    sol.AprovadoPorUsuarioId = usuarioId;
                    sol.AprovadoEm = DateTime.UtcNow;
                    p.ValorPago += valorAplicado;
                    if (p.ValorPago >= valorTotalDevido) p.Status = StatusParcelaEmprestimo.Paga;
                    p.SolicitacaoPagamentoId = sol.Id;
                    // O pago do empréstimo é o CAPITAL devolvido (o saldo devedor é ValorTotal − ValorPago): os juros da
                    // parcela não abatem o emprestado. Antes somava os juros e o empréstimo "quitava" com parcela pendente.
                    emprestimo.ValorPago = Math.Min(emprestimo.ValorPago + valorAplicado - juros, emprestimo.ValorTotal);
                    emprestimo.JurosPagos += juros;
                }
                else
                {
                    sol.TransacaoComprovanteId = transacao.Id;
                    sol.StatusAprovacao = StatusAprovacaoPagamentoEmprestimo.Pendente;
                }
                _context.EmprestimoPagamentoSolicitacoes.Add(sol);
                solicitacoesCriadas.Add(sol);
                restante -= valorAplicado;
            }

            if (solicitacoesCriadas.Count == 0)
                throw new ArgumentException("Não há parcela pendente pra aplicar esse pagamento.");

            if (restante > 0)
                throw new ArgumentException("Esse valor é maior que o total das parcelas pendentes.");

            if (emprestimo.ValorPago >= emprestimo.ValorTotal) emprestimo.Quitado = true;
        }
        else
        {
            var juros = JurosAVista(emprestimo, valor);
            var sol = new EmprestimoPagamentoSolicitacao
            {
                Id = Guid.NewGuid(), EmprestimoId = emprestimo.Id, Valor = valor, SolicitadoPor = usuarioId,
                ValorJuros = juros > 0 ? juros : null,
            };
            if (souCredor)
            {
                sol.TransacaoRecebimentoId = transacao.Id;
                sol.StatusAprovacao = StatusAprovacaoPagamentoEmprestimo.Aprovada;
                sol.AprovadoPorUsuarioId = usuarioId;
                sol.AprovadoEm = DateTime.UtcNow;
                emprestimo.ValorPago = Math.Min(emprestimo.ValorPago + valor - juros, emprestimo.ValorTotal); // só o capital
                emprestimo.JurosPagos += juros;
                if (emprestimo.ValorPago >= emprestimo.ValorTotal) emprestimo.Quitado = true;
            }
            else
            {
                sol.TransacaoComprovanteId = transacao.Id;
                sol.StatusAprovacao = StatusAprovacaoPagamentoEmprestimo.Pendente;
            }
            _context.EmprestimoPagamentoSolicitacoes.Add(sol);
            solicitacoesCriadas.Add(sol);
        }

        // O lançamento é um só (valor inteiro no saldo); os juros das parcelas que ele pagou são ganho de quem recebe e
        // gasto de quem paga (Transacao.ValorJuros).
        var jurosDoLancamento = solicitacoesCriadas.Sum(s => s.ValorJuros ?? 0m);
        transacao.ValorJuros = jurosDoLancamento > 0 ? jurosDoLancamento : null;

        foreach (var sol in solicitacoesCriadas)
        {
            _eventLog.Registrar(
                usuarioId: usuarioId,
                tipo: souCredor ? FinancialEventType.EmprestimoPagamentoAprovado : FinancialEventType.EmprestimoPagamentoSolicitado,
                entidade: "EmprestimoPagamentoSolicitacao",
                entidadeId: sol.Id,
                correlationId: Guid.NewGuid(),
                origemAcao: "API",
                valorDepois: souCredor ? emprestimo.ValorPago : sol.Valor,
                payload: new { idempotencyKey = dto.IdempotencyKey, sol.Id, emprestimoId });
        }

        await _context.SaveChangesAsync();

        var solicitante = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId);
        var valorTotalAplicado = solicitacoesCriadas.Sum(s => s.Valor);
        var quantasParcelas = solicitacoesCriadas.Count(s => s.ParcelaId.HasValue);
        var sufixoParcelas = quantasParcelas > 1 ? $" ({quantasParcelas} parcelas)" : "";
        if (souCredor)
        {
            // Só notifica se tiver alguém do outro lado — registro solo (sem vínculo ou convite
            // ainda pendente) não tem devedor real pra avisar.
            if (emprestimo.StatusVinculo == StatusVinculoEmprestimo.Vinculado)
            {
                await _notificacaoService.CriarAsync(
                    DevedorUsuarioId(emprestimo),
                    TipoNotificacao.EmprestimoPagamentoAvaliado,
                    "Pagamento registrado",
                    $"{solicitante?.Nome ?? "Alguém"} confirmou o recebimento de {Reais.Formatar(valorTotalAplicado)}{sufixoParcelas} em \"{emprestimo.Descricao}\".",
                    "/emprestimos");
            }
        }
        else
        {
            await _notificacaoService.CriarAsync(
                CredorUsuarioId(emprestimo),
                TipoNotificacao.EmprestimoPagamentoSolicitado,
                "Pagamento aguardando aprovação",
                $"{solicitante?.Nome ?? "Alguém"} marcou {Reais.Formatar(valorTotalAplicado)}{sufixoParcelas} como pago em \"{emprestimo.Descricao}\". Confirme o recebimento.",
                "/emprestimos");
        }

        return await ToSolicitacaoDtosAsync(solicitacoesCriadas);
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

        var parcelaIds = parcelas.Select(p => p.Id).ToList();
        var pendentesPorParcela = await _context.EmprestimoPagamentoSolicitacoes
            .Where(s => s.ParcelaId.HasValue && parcelaIds.Contains(s.ParcelaId.Value)
                && s.StatusAprovacao == StatusAprovacaoPagamentoEmprestimo.Pendente)
            .ToDictionaryAsync(s => s.ParcelaId!.Value, s => s.Id);

        return parcelas
            .Select(p => ToParcelaDto(p, pendentesPorParcela.TryGetValue(p.Id, out var solId) ? solId : null))
            .ToList();
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

        // Juros deste pagamento, refeitos agora (a parcela pode ter recebido outro pagamento ou multa desde o pedido).
        var parcela = solicitacao.ParcelaId.HasValue
            ? await _context.EmprestimoParcelas.FirstOrDefaultAsync(p => p.Id == solicitacao.ParcelaId.Value)
            : null;
        var juros = solicitacao.ParcelaId.HasValue
            ? (parcela != null ? JurosNaParcela(parcela, solicitacao.Valor) : 0m)
            : JurosAVista(emprestimo, solicitacao.Valor);
        solicitacao.ValorJuros = juros > 0 ? juros : null;

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

            existente.EhEmprestimo = true; // dinheiro de empréstimo: fora do resultado do mês (menos os juros)
            existente.ValorJuros = solicitacao.ValorJuros;
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
                EhEmprestimo = true, // vai e volta, como transferência: fora do resultado do mês (menos os juros)
                ValorJuros = solicitacao.ValorJuros,
                ContaId = dto.ContaId,
                CategoriaId = dto.CategoriaId,
                Data = HorarioBrasil.Hoje(),
                Hora = null, // recebimento de empréstimo é datado (sem hora de relógio)
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

        await AtualizarJurosDoComprovanteAsync(solicitacao);

        if (solicitacao.ParcelaId.HasValue)
        {
            if (parcela != null)
            {
                // Pode ser adiantamento parcial (valor da solicitação menor que o devido da
                // parcela) — só fecha (Paga) quando o acumulado cobrir tudo, mesma lógica do
                // caminho credor em SolicitarPagamentoAsync.
                parcela.ValorPago += solicitacao.Valor;
                var valorDevido = parcela.ValorComMulta ?? parcela.ValorComJuros ?? parcela.Valor;
                if (parcela.ValorPago >= valorDevido) parcela.Status = StatusParcelaEmprestimo.Paga;
                parcela.SolicitacaoPagamentoId = solicitacao.Id;
            }
        }

        emprestimo.ValorPago = Math.Min(emprestimo.ValorPago + solicitacao.Valor - juros, emprestimo.ValorTotal); // só o capital
        emprestimo.JurosPagos += juros;
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
            $"Seu pagamento de {Reais.Formatar(solicitacao.Valor)} em \"{emprestimo.Descricao}\" foi confirmado.",
            "/emprestimos");

        return true;
    }

    /// <summary>Credor rejeita — nenhuma Transacao é criada, ValorPago não muda, solicitação fica
    /// no histórico como rejeitada.</summary>
    public async Task<bool> RejeitarPagamentoSolicitacaoAsync(Guid solicitacaoId, RejeitarPagamentoEmprestimoDto dto, Guid usuarioId)
    {
        var solicitacao = await CarregarSolicitacaoParaAvaliarAsync(solicitacaoId, usuarioId);
        if (solicitacao is null) return false;

        var motivo = string.IsNullOrWhiteSpace(dto.Motivo) ? null : dto.Motivo.Trim();

        solicitacao.StatusAprovacao = StatusAprovacaoPagamentoEmprestimo.Rejeitada;
        solicitacao.AprovadoPorUsuarioId = usuarioId;
        solicitacao.AprovadoEm = DateTime.UtcNow;
        solicitacao.MotivoRejeicao = motivo;
        await AtualizarJurosDoComprovanteAsync(solicitacao); // recusado não é pagamento: os juros saem

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.EmprestimoPagamentoRejeitado,
            entidade: "EmprestimoPagamentoSolicitacao",
            entidadeId: solicitacao.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            payload: new { solicitacao.Id, emprestimoId = solicitacao.EmprestimoId, motivo });

        await _context.SaveChangesAsync();

        var mensagem = $"Seu pagamento de {Reais.Formatar(solicitacao.Valor)} em \"{solicitacao.Emprestimo.Descricao}\" foi rejeitado."
            + (motivo != null ? $" Motivo: {motivo}" : "");
        await _notificacaoService.CriarAsync(
            solicitacao.SolicitadoPor,
            TipoNotificacao.EmprestimoPagamentoAvaliado,
            "Pagamento rejeitado",
            mensagem,
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
        await AtualizarJurosDoComprovanteAsync(solicitacao);

        await _context.SaveChangesAsync();

        var solicitante = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId);
        await _notificacaoService.CriarAsync(
            CredorUsuarioId(emprestimo),
            TipoNotificacao.EmprestimoPagamentoSolicitado,
            "Pagamento reenviado pra aprovação",
            $"{solicitante?.Nome ?? "Alguém"} reenviou {Reais.Formatar(solicitacao.Valor)} em \"{emprestimo.Descricao}\". Reavalie.",
            "/emprestimos");

        return true;
    }

    // ── Unificar/consolidar (docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md § "Unificar/consolidar") ──

    /// <summary>Contrapartes com 2+ empréstimos ativos (vinculados, não quitados) onde o usuário
    /// logado é o credor — candidatas a consolidação. Front usa isso pra oferecer "Consolidar"
    /// sem exigir seleção manual às cegas pela lista inteira.</summary>
    public async Task<List<EmprestimoConsolidacaoCandidatoDto>> ListarCandidatosConsolidacaoAsync(Guid usuarioId)
    {
        var elegiveis = await _context.Emprestimos
            .Where(e => e.Ativo && !e.Quitado && e.StatusVinculo == StatusVinculoEmprestimo.Vinculado
                && (e.CriadoPor == usuarioId || e.ContraparteUsuarioId == usuarioId))
            .ToListAsync();
        elegiveis = elegiveis.Where(e => EhCredor(e, usuarioId)).ToList();

        var grupos = elegiveis
            .GroupBy(e => e.CriadoPor == usuarioId ? e.ContraparteUsuarioId!.Value : e.CriadoPor)
            .Where(g => g.Count() >= 2)
            .ToList();

        var contraparteIds = grupos.Select(g => g.Key).ToList();
        var nomes = await _context.Usuarios
            .Where(u => contraparteIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Nome);

        return grupos.Select(g => new EmprestimoConsolidacaoCandidatoDto
        {
            ContraparteUsuarioId = g.Key,
            ContraparteNome = nomes.GetValueOrDefault(g.Key, "Alguém"),
            Itens = g.Select(e => new EmprestimoConsolidacaoItemDto
            {
                EmprestimoOriginalId = e.Id,
                Descricao = e.Descricao,
                ValorRestanteSnapshot = e.ValorTotal - e.ValorPago,
            }).ToList(),
        }).ToList();
    }

    /// <summary>Propõe juntar 2+ empréstimos ativos que o credor tem com a mesma contraparte
    /// vinculada num plano novo renegociado. Nada muda nos originais até o devedor aceitar —
    /// mesmo padrão do vínculo bilateral (propõe → outro lado decide).</summary>
    public async Task<EmprestimoConsolidacaoPropostaDto> ProporConsolidacaoAsync(ProporConsolidacaoDto dto, Guid usuarioId)
    {
        var ids = dto.EmprestimoIds.Distinct().ToList();
        if (ids.Count < 2)
            throw new ArgumentException("Selecione pelo menos 2 empréstimos pra consolidar.");

        if (string.IsNullOrWhiteSpace(dto.Descricao))
            throw new ArgumentException("Descrição é obrigatória.");

        if (dto.FormaPagamento == FormaPagamentoEmprestimo.Parcelado)
        {
            if (!dto.QuantidadeParcelas.HasValue || dto.QuantidadeParcelas.Value < 2 || dto.QuantidadeParcelas.Value > 36)
                throw new ArgumentException("Quantidade de parcelas deve ser entre 2 e 36.");
            if (!dto.PrimeiroVencimento.HasValue)
                throw new ArgumentException("Informe o vencimento da primeira parcela.");
        }

        var emprestimos = await _context.Emprestimos.Where(e => ids.Contains(e.Id) && e.Ativo).ToListAsync();
        if (emprestimos.Count != ids.Count)
            throw new KeyNotFoundException("Um ou mais empréstimos não foram encontrados.");

        foreach (var e in emprestimos)
        {
            if (!EhCredor(e, usuarioId))
                throw new ForbiddenAccessException("Só o credor de um empréstimo pode incluí-lo numa consolidação.");
            if (e.StatusVinculo != StatusVinculoEmprestimo.Vinculado)
                throw new ArgumentException("Só empréstimos vinculados (aceitos pelos dois lados) podem ser consolidados.");
            if (e.Quitado)
                throw new ArgumentException("Empréstimo já quitado não entra numa consolidação.");
        }

        var contraparteIds = emprestimos.Select(e => e.CriadoPor == usuarioId ? e.ContraparteUsuarioId!.Value : e.CriadoPor).Distinct().ToList();
        if (contraparteIds.Count > 1)
            throw new ArgumentException("Todos os empréstimos precisam ser da mesma pessoa vinculada.");
        var devedorUsuarioId = contraparteIds[0];

        var jaEmConsolidacaoPendente = await _context.EmprestimoConsolidacaoItens
            .Where(i => ids.Contains(i.EmprestimoOriginalId) && i.Proposta.Status == StatusConsolidacaoEmprestimo.Pendente)
            .AnyAsync();
        if (jaEmConsolidacaoPendente)
            throw new InvalidOperationException("Já existe uma consolidação pendente envolvendo um desses empréstimos.");

        var proposta = new EmprestimoConsolidacaoProposta
        {
            Id = Guid.NewGuid(),
            CredorUsuarioId = usuarioId,
            DevedorUsuarioId = devedorUsuarioId,
            Descricao = dto.Descricao,
            FormaPagamento = dto.FormaPagamento,
            QuantidadeParcelas = dto.QuantidadeParcelas,
            PrimeiroVencimento = dto.PrimeiroVencimento,
            DataVencimento = dto.DataVencimento,
            TaxaJuroMensal = dto.TaxaJuroMensal,
            PercentualMultaAtraso = dto.PercentualMultaAtraso,
            ValorTotalProposto = emprestimos.Sum(e => e.ValorTotal - e.ValorPago),
            Status = StatusConsolidacaoEmprestimo.Pendente,
        };
        foreach (var e in emprestimos)
        {
            proposta.Itens.Add(new EmprestimoConsolidacaoItem
            {
                Id = Guid.NewGuid(),
                PropostaId = proposta.Id,
                EmprestimoOriginalId = e.Id,
                ValorRestanteSnapshot = e.ValorTotal - e.ValorPago,
            });
        }

        _context.EmprestimoConsolidacaoPropostas.Add(proposta);

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.EmprestimoConsolidacaoProposta,
            entidade: "EmprestimoConsolidacaoProposta",
            entidadeId: proposta.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            valorDepois: proposta.ValorTotalProposto,
            payload: new { proposta.Id, emprestimoIds = ids, proposta.ValorTotalProposto });

        await _context.SaveChangesAsync();

        var credor = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId);
        await _notificacaoService.CriarAsync(
            devedorUsuarioId,
            TipoNotificacao.EmprestimoConsolidacaoProposta,
            "Proposta de consolidação de empréstimos",
            $"{credor?.Nome ?? "Alguém"} quer juntar {emprestimos.Count} empréstimos num plano novo de {Reais.Formatar(proposta.ValorTotalProposto)}. Revise e responda.",
            "/emprestimos");

        return await ToConsolidacaoDtoAsync(proposta, usuarioId);
    }

    /// <summary>Consolidações onde o usuário logado é credor (propôs) ou devedor (precisa
    /// responder) — mais recente primeiro.</summary>
    public async Task<List<EmprestimoConsolidacaoPropostaDto>> ListarConsolidacoesAsync(Guid usuarioId)
    {
        var propostas = await _context.EmprestimoConsolidacaoPropostas
            .Include(p => p.Itens).ThenInclude(i => i.EmprestimoOriginal)
            .Where(p => p.CredorUsuarioId == usuarioId || p.DevedorUsuarioId == usuarioId)
            .OrderByDescending(p => p.CriadoEm)
            .ToListAsync();

        var nomeIds = propostas.Select(p => p.CredorUsuarioId).Concat(propostas.Select(p => p.DevedorUsuarioId)).Distinct().ToList();
        var nomes = await _context.Usuarios.Where(u => nomeIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Nome);

        return propostas.Select(p => ToConsolidacaoDto(p, usuarioId, nomes)).ToList();
    }

    /// <summary>Devedor aceita — cria o Emprestimo novo (soma o restante real dos originais,
    /// recalculado agora, não confiado no snapshot da proposta), marca os originais Quitado +
    /// ConsolidadoNoEmprestimoId + arquivado dos dois lados (registro superado, não precisa mais
    /// poluir a lista principal de ninguém). Toda a operação sob o mesmo correlationId de
    /// auditoria — dá pra reconstruir a cadeia completa (proposta → originais fechados → novo
    /// criado) no FinancialEventLog.</summary>
    public async Task<EmprestimoDto> AceitarConsolidacaoAsync(Guid id, Guid usuarioId)
    {
        var proposta = await CarregarConsolidacaoParaResponderAsync(id, usuarioId, exigirDevedor: true);

        var originais = await _context.Emprestimos
            .Where(e => proposta.Itens.Select(i => i.EmprestimoOriginalId).Contains(e.Id))
            .ToListAsync();

        if (originais.Any(e => !e.Ativo || e.Quitado || e.StatusVinculo != StatusVinculoEmprestimo.Vinculado))
            throw new InvalidOperationException(
                "Um dos empréstimos incluídos mudou de estado desde a proposta. Peça uma nova consolidação.");

        var valorTotal = originais.Sum(e => e.ValorTotal - e.ValorPago);
        if (valorTotal <= 0)
            throw new InvalidOperationException("Os empréstimos incluídos já não têm saldo restante pra consolidar.");

        var devedor = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == proposta.DevedorUsuarioId);

        var novo = new Emprestimo
        {
            Id = Guid.NewGuid(),
            Descricao = proposta.Descricao,
            Pessoa = devedor?.Nome ?? "Sem descrição",
            ValorTotal = valorTotal,
            ValorPago = 0,
            Tipo = TipoEmprestimo.Emprestei,
            DataInicio = DateTime.UtcNow,
            DataVencimento = proposta.DataVencimento?.ToUniversalTime(),
            Quitado = false,
            Observacao = $"Consolidação de {originais.Count} empréstimos: "
                + string.Join(", ", originais.Select(e => e.Descricao)),
            CriadoPor = proposta.CredorUsuarioId,
            ContraparteUsuarioId = proposta.DevedorUsuarioId,
            StatusVinculo = StatusVinculoEmprestimo.Vinculado,
            VinculoRespondidoEm = DateTime.UtcNow,
            FormaPagamento = proposta.FormaPagamento,
            TaxaJuroMensal = proposta.TaxaJuroMensal,
            PercentualMultaAtraso = proposta.PercentualMultaAtraso,
        };

        if (proposta.FormaPagamento == FormaPagamentoEmprestimo.Parcelado)
        {
            foreach (var parcela in GerarParcelas(
                novo.Id, valorTotal, proposta.QuantidadeParcelas!.Value,
                proposta.PrimeiroVencimento!.Value, proposta.TaxaJuroMensal))
                novo.Parcelas.Add(parcela);
        }
        else if (proposta.TaxaJuroMensal.HasValue)
        {
            novo.ValorComJuros = Math.Round(valorTotal * (1 + proposta.TaxaJuroMensal.Value / 100), 2);
        }

        _context.Emprestimos.Add(novo);

        var correlationId = Guid.NewGuid();

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.EmprestimoConsolidacaoAceita,
            entidade: "EmprestimoConsolidacaoProposta",
            entidadeId: proposta.Id,
            correlationId: correlationId,
            origemAcao: "API",
            valorDepois: valorTotal,
            payload: new { proposta.Id, novoEmprestimoId = novo.Id });

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.EmprestimoCriado,
            entidade: "Emprestimo",
            entidadeId: novo.Id,
            correlationId: correlationId,
            origemAcao: "API",
            valorDepois: novo.ValorTotal,
            payload: new { novo.Id, origem = "Consolidacao", consolidacaoPropostaId = proposta.Id });

        foreach (var original in originais)
        {
            var valorAntes = original.ValorPago;
            original.ValorPago = original.ValorTotal;
            original.Quitado = true;
            original.ConsolidadoNoEmprestimoId = novo.Id;
            original.ArquivadoPorCriador = true;
            original.ArquivadoPorContraparte = true;

            _eventLog.Registrar(
                usuarioId: usuarioId,
                tipo: FinancialEventType.EmprestimoQuitado,
                entidade: "Emprestimo",
                entidadeId: original.Id,
                correlationId: correlationId,
                origemAcao: "API",
                valorAntes: valorAntes,
                valorDepois: original.ValorTotal,
                payload: new { original.Id, motivo = "Consolidacao", novoEmprestimoId = novo.Id });
        }

        proposta.Status = StatusConsolidacaoEmprestimo.Aceita;
        proposta.RespondidoEm = DateTime.UtcNow;
        proposta.EmprestimoConsolidadoId = novo.Id;

        await _context.SaveChangesAsync();

        await _notificacaoService.CriarAsync(
            proposta.CredorUsuarioId,
            TipoNotificacao.EmprestimoConsolidacaoRespondida,
            "Consolidação aceita",
            $"{devedor?.Nome ?? "Alguém"} aceitou a consolidação: \"{novo.Descricao}\" agora é um empréstimo só, {Reais.Formatar(novo.ValorTotal)}.",
            "/emprestimos");

        return await ToDtoAsync(novo, usuarioId);
    }

    /// <summary>Devedor recusa — nenhum empréstimo original é tocado. Motivo opcional, mesmo
    /// padrão de RejeitarPagamentoSolicitacaoAsync.</summary>
    public async Task RecusarConsolidacaoAsync(Guid id, RecusarConsolidacaoDto dto, Guid usuarioId)
    {
        var proposta = await CarregarConsolidacaoParaResponderAsync(id, usuarioId, exigirDevedor: true);

        var motivo = string.IsNullOrWhiteSpace(dto.Motivo) ? null : dto.Motivo.Trim();

        proposta.Status = StatusConsolidacaoEmprestimo.Recusada;
        proposta.RespondidoEm = DateTime.UtcNow;
        proposta.MotivoRecusa = motivo;

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.EmprestimoConsolidacaoRecusada,
            entidade: "EmprestimoConsolidacaoProposta",
            entidadeId: proposta.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            payload: new { proposta.Id, motivo });

        await _context.SaveChangesAsync();

        var devedor = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId);
        var mensagem = $"{devedor?.Nome ?? "Alguém"} recusou a proposta de consolidação \"{proposta.Descricao}\"."
            + (motivo != null ? $" Motivo: {motivo}" : "");
        await _notificacaoService.CriarAsync(
            proposta.CredorUsuarioId,
            TipoNotificacao.EmprestimoConsolidacaoRespondida,
            "Consolidação recusada",
            mensagem,
            "/emprestimos");
    }

    /// <summary>Credor desiste antes do devedor responder.</summary>
    public async Task CancelarConsolidacaoAsync(Guid id, Guid usuarioId)
    {
        var proposta = await CarregarConsolidacaoParaResponderAsync(id, usuarioId, exigirDevedor: false);

        proposta.Status = StatusConsolidacaoEmprestimo.Cancelada;
        proposta.RespondidoEm = DateTime.UtcNow;

        _eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.EmprestimoConsolidacaoCancelada,
            entidade: "EmprestimoConsolidacaoProposta",
            entidadeId: proposta.Id,
            correlationId: Guid.NewGuid(),
            origemAcao: "API",
            payload: new { proposta.Id });

        await _context.SaveChangesAsync();

        await _notificacaoService.CriarAsync(
            proposta.DevedorUsuarioId,
            TipoNotificacao.EmprestimoConsolidacaoRespondida,
            "Consolidação cancelada",
            $"A proposta de consolidação \"{proposta.Descricao}\" foi cancelada pelo credor.",
            "/emprestimos");
    }

    /// <summary>Carrega + valida autorização pra responder uma consolidação (BOLA-safe: estranho
    /// ao registro recebe 404; participante no papel errado recebe 403). exigirDevedor=true pra
    /// aceitar/recusar (só o devedor decide); false pra cancelar (só o credor, quem propôs).</summary>
    private async Task<EmprestimoConsolidacaoProposta> CarregarConsolidacaoParaResponderAsync(Guid id, Guid usuarioId, bool exigirDevedor)
    {
        var proposta = await _context.EmprestimoConsolidacaoPropostas
            .Include(p => p.Itens)
            .FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new KeyNotFoundException("Proposta de consolidação não encontrada.");

        var participante = usuarioId == proposta.CredorUsuarioId || usuarioId == proposta.DevedorUsuarioId;
        if (!participante)
            throw new KeyNotFoundException("Proposta de consolidação não encontrada.");

        if (exigirDevedor && usuarioId != proposta.DevedorUsuarioId)
            throw new ForbiddenAccessException("Só o devedor pode aceitar ou recusar essa consolidação.");
        if (!exigirDevedor && usuarioId != proposta.CredorUsuarioId)
            throw new ForbiddenAccessException("Só quem propôs a consolidação pode cancelá-la.");

        if (proposta.Status != StatusConsolidacaoEmprestimo.Pendente)
            throw new InvalidOperationException("Essa consolidação não está mais pendente.");

        return proposta;
    }

    private async Task<EmprestimoConsolidacaoPropostaDto> ToConsolidacaoDtoAsync(EmprestimoConsolidacaoProposta p, Guid usuarioId)
    {
        await _context.Entry(p).Collection(x => x.Itens).Query().Include(i => i.EmprestimoOriginal).LoadAsync();
        var nomeIds = new[] { p.CredorUsuarioId, p.DevedorUsuarioId };
        var nomes = await _context.Usuarios.Where(u => nomeIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Nome);
        return ToConsolidacaoDto(p, usuarioId, nomes);
    }

    private static EmprestimoConsolidacaoPropostaDto ToConsolidacaoDto(
        EmprestimoConsolidacaoProposta p, Guid usuarioId, IReadOnlyDictionary<Guid, string> nomes)
    {
        return new EmprestimoConsolidacaoPropostaDto
        {
            Id = p.Id,
            CredorUsuarioId = p.CredorUsuarioId,
            CredorNome = nomes.GetValueOrDefault(p.CredorUsuarioId, "Alguém"),
            DevedorUsuarioId = p.DevedorUsuarioId,
            DevedorNome = nomes.GetValueOrDefault(p.DevedorUsuarioId, "Alguém"),
            Descricao = p.Descricao,
            FormaPagamento = (int)p.FormaPagamento,
            QuantidadeParcelas = p.QuantidadeParcelas,
            PrimeiroVencimento = p.PrimeiroVencimento,
            DataVencimento = p.DataVencimento,
            TaxaJuroMensal = p.TaxaJuroMensal,
            PercentualMultaAtraso = p.PercentualMultaAtraso,
            ValorTotalProposto = p.ValorTotalProposto,
            Status = (int)p.Status,
            StatusDescricao = p.Status switch
            {
                StatusConsolidacaoEmprestimo.Pendente => "Pendente",
                StatusConsolidacaoEmprestimo.Aceita => "Aceita",
                StatusConsolidacaoEmprestimo.Recusada => "Recusada",
                StatusConsolidacaoEmprestimo.Cancelada => "Cancelada",
                _ => p.Status.ToString(),
            },
            CriadoEm = p.CriadoEm,
            RespondidoEm = p.RespondidoEm,
            MotivoRecusa = p.MotivoRecusa,
            EmprestimoConsolidadoId = p.EmprestimoConsolidadoId,
            SouCredor = usuarioId == p.CredorUsuarioId,
            Itens = p.Itens.Select(i => new EmprestimoConsolidacaoItemDto
            {
                EmprestimoOriginalId = i.EmprestimoOriginalId,
                Descricao = i.EmprestimoOriginal?.Descricao ?? "Sem descrição",
                ValorRestanteSnapshot = i.ValorRestanteSnapshot,
            }).ToList(),
        };
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
        .Include(e => e.Banco)
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

    /// <summary>Id do usuário devedor — só chamar quando Vinculado (ContraparteUsuarioId garantido).</summary>
    private static Guid DevedorUsuarioId(Emprestimo e) =>
        e.Tipo == TipoEmprestimo.Emprestei ? e.ContraparteUsuarioId!.Value : e.CriadoPor;

    private async Task<EmprestimoPagamentoSolicitacaoDto> ToSolicitacaoDtoAsync(EmprestimoPagamentoSolicitacao s)
        => (await ToSolicitacaoDtosAsync([s]))[0];

    private async Task<List<EmprestimoPagamentoSolicitacaoDto>> ToSolicitacaoDtosAsync(List<EmprestimoPagamentoSolicitacao> items)
    {
        var solicitanteIds = items.Select(s => s.SolicitadoPor).Distinct().ToList();
        var nomes = await _context.Usuarios.Where(u => solicitanteIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Nome);

        var transacaoIds = items.Where(s => s.TransacaoComprovanteId.HasValue).Select(s => s.TransacaoComprovanteId!.Value)
            .Concat(items.Where(s => s.TransacaoRecebimentoId.HasValue).Select(s => s.TransacaoRecebimentoId!.Value))
            .Distinct()
            .ToList();
        var transacoes = await _context.Transacoes
            .Include(t => t.Conta)
            .Where(t => transacaoIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t);

        return items.Select(s =>
        {
            var comprovante = s.TransacaoComprovanteId.HasValue
                ? transacoes.GetValueOrDefault(s.TransacaoComprovanteId.Value)
                : null;
            var recebimento = s.TransacaoRecebimentoId.HasValue
                ? transacoes.GetValueOrDefault(s.TransacaoRecebimentoId.Value)
                : null;

            return new EmprestimoPagamentoSolicitacaoDto
            {
                Id = s.Id,
                EmprestimoId = s.EmprestimoId,
                ParcelaId = s.ParcelaId,
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
                SolicitadoPorNome = nomes.GetValueOrDefault(s.SolicitadoPor, "Alguém"),
                CriadoEm = s.CriadoEm,
                AprovadoEm = s.AprovadoEm,
                TransacaoRecebimentoId = s.TransacaoRecebimentoId,
                ComprovanteData = comprovante != null ? comprovante.Data.ToDateTime(comprovante.Hora ?? TimeOnly.MinValue) : s.CriadoEm,
                ComprovanteContaNome = comprovante?.Conta?.Nome,
                RecebimentoData = recebimento != null ? recebimento.Data.ToDateTime(recebimento.Hora ?? TimeOnly.MinValue) : null,
                RecebimentoContaNome = recebimento?.Conta?.Nome,
                MotivoRejeicao = s.MotivoRejeicao,
                // Só o caminho credor-registra-e-já-aprova produz aprovador == solicitante — o
                // fluxo normal (devedor solicita) proíbe autoaprovação (ver CarregarSolicitacaoParaAvaliarAsync).
                RegistradoPeloCredor = s.AprovadoPorUsuarioId.HasValue && s.AprovadoPorUsuarioId == s.SolicitadoPor,
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
        var agregados = await ObterAgregadosSolicitacaoAsync([e.Id]);
        // Empréstimo recém-criado não vem por VisivelPara (sem Include do Banco) — carrega aqui.
        if (e.BancoId.HasValue && e.Banco is null)
            e.Banco = await _context.Bancos.FirstOrDefaultAsync(b => b.Id == e.BancoId.Value);
        return ToDto(e, usuarioId, nomes, agregados);
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

    /// <summary>Soma de solicitações Pendentes e Rejeitadas por empréstimo — informativo pro front
    /// (barra de progresso com 3 cores), nunca conta em ValorPago/PercentualPago. Só a aprovação
    /// muda o saldo real (nenhuma ação de uma parte altera o registro por conta própria).</summary>
    private async Task<Dictionary<Guid, (decimal Pendente, decimal Recusado)>> ObterAgregadosSolicitacaoAsync(List<Guid> emprestimoIds)
    {
        var grupos = await _context.EmprestimoPagamentoSolicitacoes
            .Where(s => emprestimoIds.Contains(s.EmprestimoId)
                && (s.StatusAprovacao == StatusAprovacaoPagamentoEmprestimo.Pendente
                 || s.StatusAprovacao == StatusAprovacaoPagamentoEmprestimo.Rejeitada))
            .GroupBy(s => new { s.EmprestimoId, s.StatusAprovacao })
            .Select(g => new { g.Key.EmprestimoId, g.Key.StatusAprovacao, Total = g.Sum(x => x.Valor) })
            .ToListAsync();

        var resultado = emprestimoIds.ToDictionary(id => id, _ => (Pendente: 0m, Recusado: 0m));
        foreach (var g in grupos)
        {
            var atual = resultado[g.EmprestimoId];
            resultado[g.EmprestimoId] = g.StatusAprovacao == StatusAprovacaoPagamentoEmprestimo.Pendente
                ? (g.Total, atual.Recusado)
                : (atual.Pendente, g.Total);
        }
        return resultado;
    }

    /// <summary>Tudo relativo a quem está olhando (usuarioId), não ao CriadoPor — quem vê como
    /// contraparte enxerga Tipo/credor invertidos.</summary>
    private static EmprestimoDto ToDto(
        Emprestimo e, Guid usuarioId, IReadOnlyDictionary<Guid, string> nomes,
        IReadOnlyDictionary<Guid, (decimal Pendente, decimal Recusado)> agregados)
    {
        // "Já devolvi" = tudo o que foi pago (capital + juros); "falta" = o que ainda vai ser pago, com os juros.
        var pago = e.ValorPago + e.JurosPagos;
        var restante = RestanteComJuros(e);
        var percentual = pago + restante > 0 ? Math.Round(pago / (pago + restante) * 100, 1) : 0;
        var vencido = !e.Quitado && e.DataVencimento.HasValue && e.DataVencimento.Value.Date < HorarioBrasil.HojeData();

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

        var (valorPendente, valorRecusado) = agregados.TryGetValue(e.Id, out var agg) ? agg : (0m, 0m);

        return new EmprestimoDto
        {
            Id = e.Id,
            Descricao = e.Descricao,
            Pessoa = pessoa,
            ValorTotal = e.ValorTotal,
            ValorPago = pago,
            ValorRestante = restante,
            PercentualPago = percentual,
            ValorPendente = valorPendente,
            ValorRecusado = valorRecusado,
            Tipo = (int)tipoEfetivo,
            TipoDescricao = tipoEfetivo == TipoEmprestimo.Emprestei ? "Emprestei" : "Peguei emprestado",
            DataInicio = e.DataInicio,
            DataVencimento = e.DataVencimento,
            Quitado = e.Quitado,
            Vencido = vencido,
            Observacao = e.Observacao,
            BancoId = e.BancoId,
            BancoNome = e.Banco?.Nome,
            BancoLogoUrl = e.Banco?.LogoUrl,
            BancoCor = e.Banco?.Cor,
            Origem = (int)e.Origem,
            StatusVinculo = (int)e.StatusVinculo,
            ContraparteNome = contraparteNome,
            SouCredor = souCredor,
            TransacaoId = e.TransacaoId,
            FormaPagamento = (int)e.FormaPagamento,
            TaxaJuroMensal = e.TaxaJuroMensal,
            PercentualMultaAtraso = e.PercentualMultaAtraso,
            ValorComJuros = e.ValorComJuros,
            ValorComMulta = e.ValorComMulta,
            QuantidadeParcelas = e.FormaPagamento == FormaPagamentoEmprestimo.Parcelado && e.Parcelas.Count > 0
                ? e.Parcelas.Count
                : null,
            Arquivado = souCriador ? e.ArquivadoPorCriador : e.ArquivadoPorContraparte,
            ConsolidadoNoEmprestimoId = e.ConsolidadoNoEmprestimoId,
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

    // ── Juros de cada pagamento (2026-11-01) ──────────────────────────────────────────────────────────────────────
    // Imputação do Código Civil (art. 354): o pagamento cobre primeiro os juros/multa, depois o capital. Encargos de
    // uma parcela = devido − valor dela; o que a parcela já recebeu cobriu primeiro os encargos.

    private static decimal JurosNaParcela(EmprestimoParcela p, decimal valorAplicado)
    {
        var devido = p.ValorComMulta ?? p.ValorComJuros ?? p.Valor;
        return RegrasFinanceiras.JurosDoPagamento(p.Valor, devido, Math.Min(p.ValorPago, devido - p.Valor), valorAplicado);
    }

    private static decimal JurosAVista(Emprestimo e, decimal valor) =>
        RegrasFinanceiras.JurosDoPagamento(e.ValorTotal, e.ValorComMulta ?? e.ValorComJuros ?? e.ValorTotal, e.JurosPagos, valor);

    /// <summary>
    /// O lançamento do devedor (comprovante) pode pagar várias parcelas: os juros dele são os das solicitações não
    /// recusadas. A que está sendo avaliada entra pelo estado novo (ainda não gravado).
    /// </summary>
    private async Task AtualizarJurosDoComprovanteAsync(EmprestimoPagamentoSolicitacao avaliada)
    {
        if (avaliada.TransacaoComprovanteId is not { } id) return;
        var comprovante = await _context.Transacoes.FirstOrDefaultAsync(t => t.Id == id);
        if (comprovante is null) return;
        var dasOutras = await _context.EmprestimoPagamentoSolicitacoes
            .Where(s => s.TransacaoComprovanteId == id && s.Id != avaliada.Id && s.StatusAprovacao != StatusAprovacaoPagamentoEmprestimo.Rejeitada)
            .SumAsync(s => s.ValorJuros ?? 0m);
        var total = dasOutras + (avaliada.StatusAprovacao == StatusAprovacaoPagamentoEmprestimo.Rejeitada ? 0m : avaliada.ValorJuros ?? 0m);
        comprovante.ValorJuros = total > 0 ? total : null;
    }

    // ── Empréstimo de banco: Tabela Price pela taxa efetiva (2026-11-01) ─────────────────────────────────────────────

    /// <summary>
    /// Taxa efetiva mensal (a TIR do empréstimo, a mesma conta do CET): a taxa que iguala o valor recebido ao valor
    /// presente das parcelas, recebido = parcela × (1 − (1+i)^−n) / i. Como parte do recebido, já embute IOF e
    /// tarifas. Newton-Raphson; parcelas que somam exatamente o recebido dão zero.
    /// </summary>
    public static decimal TaxaEfetivaMensal(decimal recebido, decimal parcela, int parcelas)
    {
        if (parcela * parcelas <= recebido) return 0m;
        double pv = (double)recebido, pmt = (double)parcela, i = 0.01;
        for (var passo = 0; passo < 200; passo++)
        {
            var desconto = Math.Pow(1 + i, -parcelas);
            var f = pmt * (1 - desconto) / i - pv;
            var df = pmt * (parcelas * desconto / (1 + i) * i - (1 - desconto)) / (i * i);
            var proximo = i - f / df;
            if (proximo <= 0) proximo = i / 2;
            if (Math.Abs(proximo - i) < 1e-12) { i = proximo; break; }
            i = proximo;
        }
        return (decimal)i;
    }

    /// <summary>
    /// Parcelas pela Tabela Price (sistema francês, o dos empréstimos pessoais no Brasil): parcela fixa; em cada uma,
    /// juros = saldo devedor × taxa efetiva e o resto amortiza. <c>Valor</c> = amortização (o capital) e
    /// <c>ValorComJuros</c> = a parcela, então o pagamento separa os juros sozinho (<see cref="JurosNaParcela"/>). A
    /// última fecha os centavos do saldo.
    /// </summary>
    private static List<EmprestimoParcela> GerarParcelasPrice(
        Guid emprestimoId, decimal recebido, decimal valorParcela, int quantidade, DateTime primeiroVencimento)
    {
        var taxa = TaxaEfetivaMensal(recebido, valorParcela, quantidade);
        var saldo = recebido;
        var parcelas = new List<EmprestimoParcela>();
        for (var i = 1; i <= quantidade; i++)
        {
            var juros = Math.Round(saldo * taxa, 2, MidpointRounding.ToEven);
            var amortizacao = i == quantidade ? saldo : Math.Min(saldo, valorParcela - juros);
            saldo -= amortizacao;
            parcelas.Add(new EmprestimoParcela
            {
                Id = Guid.NewGuid(),
                EmprestimoId = emprestimoId,
                Numero = i,
                QuantidadeTotal = quantidade,
                DataVencimento = primeiroVencimento.AddMonths(i - 1).ToUniversalTime(),
                Valor = amortizacao,
                ValorComJuros = amortizacao + juros,
                Status = StatusParcelaEmprestimo.Pendente,
            });
        }
        return parcelas;
    }

    /// <summary>O que falta de uma parcela (com multa, se já tiver o snapshot; senão com juros; senão o valor). Regra
    /// única: o vencido do topo e os próximos 30 dias (<see cref="ProximosEmprestimosService"/>) usam esta.</summary>
    public static decimal RestanteDaParcela(EmprestimoParcela p) => (p.ValorComMulta ?? p.ValorComJuros ?? p.Valor) - p.ValorPago;

    /// <summary>O que falta de um empréstimo à vista: o devido (com juros/multa) menos o capital e os juros já pagos.</summary>
    public static decimal RestanteAVista(Emprestimo e) =>
        Math.Max(0m, (e.ValorComMulta ?? e.ValorComJuros ?? e.ValorTotal) - e.ValorPago - e.JurosPagos);

    /// <summary>
    /// Quanto falta de verdade, com os juros (o "Falta devolver/voltar" e o topo da tela): parcelado, o que falta das
    /// parcelas pendentes; à vista, <see cref="RestanteAVista"/>. Antes era só o capital (ValorTotal − ValorPago), e um
    /// empréstimo com juros mostrava menos do que a pessoa ainda ia pagar. Parcelado sem as parcelas carregadas cai no capital.
    /// </summary>
    public static decimal RestanteComJuros(Emprestimo e)
    {
        if (e.Quitado) return 0m;
        if (e.FormaPagamento == FormaPagamentoEmprestimo.Parcelado)
            return e.Parcelas.Count > 0
                ? e.Parcelas.Where(p => p.Status == StatusParcelaEmprestimo.Pendente).Sum(RestanteDaParcela)
                : e.ValorTotal - e.ValorPago;
        return RestanteAVista(e);
    }

    /// <summary>Snapshot único de multa na primeira leitura após o vencimento — não recalcula
    /// depois. Retorna true se alterou (pra saber se precisa SaveChanges).</summary>
    private static bool AplicarMultaSeAtrasada(EmprestimoParcela p, Emprestimo emprestimo)
    {
        if (p.Status != StatusParcelaEmprestimo.Pendente) return false;
        if (p.DataVencimento.Date >= HorarioBrasil.HojeData()) return false;
        if (p.ValorComMulta.HasValue) return false;
        if (!emprestimo.PercentualMultaAtraso.HasValue) return false;

        // Multa sobre a PARCELA devida (com os juros dela), como diz a regra ("% sobre a parcela quando atrasa"). Antes era
        // sobre o valor sem juros e substituía a parcela: atrasar podia sair mais barato que pagar em dia (achado 2026-11-01).
        p.ValorComMulta = Math.Round((p.ValorComJuros ?? p.Valor) * (1 + emprestimo.PercentualMultaAtraso.Value / 100), 2);
        return true;
    }

    /// <summary>Mesmo snapshot-único-na-1ª-leitura do AplicarMultaSeAtrasada, só que pro
    /// Emprestimo À vista direto (não tem parcela pra pendurar isso).</summary>
    private static bool AplicarMultaAVistaSeAtrasada(Emprestimo e)
    {
        if (e.FormaPagamento != FormaPagamentoEmprestimo.AVista) return false;
        if (e.Quitado) return false;
        if (e.ValorComMulta.HasValue) return false;
        if (!e.PercentualMultaAtraso.HasValue) return false;
        if (!e.DataVencimento.HasValue || e.DataVencimento.Value.Date >= HorarioBrasil.HojeData()) return false;

        e.ValorComMulta = Math.Round((e.ValorComJuros ?? e.ValorTotal) * (1 + e.PercentualMultaAtraso.Value / 100), 2); // sobre o devido, como a parcela
        return true;
    }

    private static EmprestimoParcelaDto ToParcelaDto(EmprestimoParcela p, Guid? solicitacaoPendenteId = null)
    {
        var atrasada = p.Status == StatusParcelaEmprestimo.Pendente && p.DataVencimento.Date < HorarioBrasil.HojeData();
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
            ValorPago = p.ValorPago,
            StatusDescricao = p.Status switch
            {
                StatusParcelaEmprestimo.Pendente => atrasada ? "Atrasada" : "Pendente",
                StatusParcelaEmprestimo.Paga => "Paga",
                StatusParcelaEmprestimo.Cancelada => "Cancelada",
                _ => p.Status.ToString(),
            },
            Atrasada = atrasada,
            SolicitacaoPagamentoId = p.SolicitacaoPagamentoId,
            SolicitacaoPendenteId = solicitacaoPendenteId,
        };
    }

    private static string GerarTokenOpaco()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
