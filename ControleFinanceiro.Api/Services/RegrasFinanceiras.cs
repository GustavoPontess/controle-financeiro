using System.Linq.Expressions;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Fonte ÚNICA das regras de dinheiro que antes estavam copiadas (e divergiam) entre services,
/// controller e jobs: <b>saldo de conta</b>, <b>total/restante de fatura</b>, o <b>estado de
/// pagamento</b> da fatura quando o total cai sem pagamento (cancelamento, fechamento) e o <b>limite
/// usado/disponível do cartão</b>.
/// Cada cópia tinha uma variação: o total da fatura somava parcela cancelada em 3 lugares (e o
/// cálculo de limite não), o resumo por conta somava previsão, o saldo carregava o histórico inteiro
/// em memória. Quem precisa dessas contas chama daqui — mesmo molde de <see cref="DonoRecursos"/>:
/// estática, sem estado, sem DI.
/// </summary>
public static class RegrasFinanceiras
{
    // ── Saldo de conta ────────────────────────────────────────────────────────

    /// <summary>
    /// O que compõe o saldo REAL de uma conta: lançamento vivo (<c>Ativo</c>) e efetivado
    /// (<c>Executado</c>). Fica de fora a cancelada (soft delete) e a previsão (recorrente futura /
    /// lançamento não efetivado). Transferência, saldo inicial e pagamento de fatura ENTRAM: não são
    /// receita/despesa de P&amp;L, mas movem dinheiro da conta.
    /// <c>Expression</c> (não <c>Func</c>) pra virar WHERE no SQL.
    /// </summary>
    public static readonly Expression<Func<Transacao, bool>> CompoeSaldoReal =
        t => t.Ativo && t.StatusTransacao == StatusTransacao.Executado;

    // ── Resultado (P&L) ───────────────────────────────────────────────────────

    /// <summary>
    /// O que entra no RESULTADO — receita/despesa de verdade (Entrou/Saiu, relatórios, dashboard,
    /// orçamento). Fica de fora o que só move dinheiro sem ser ganho nem gasto: transferência entre
    /// contas, pagamento de fatura (o gasto é a compra no cartão), saldo inicial, ajuste de reconciliação
    /// (corrige o saldo) e as pernas do Pix no Crédito (o cartão põe na conta e o Pix tira; o gasto é do
    /// cartão). Tudo isso CONTINUA no saldo (<see cref="CompoeSaldoReal"/>). Não filtra Ativo/Status —
    /// cada chamador combina com o recorte dele. Antes a lista estava copiada em cada service, e nenhuma
    /// cópia tirava o ajuste de reconciliação.
    /// </summary>
    public static readonly Expression<Func<Transacao, bool>> EntraNoResultado =
        t => !t.EhTransferencia && !t.EhPagamentoFatura && !t.EhSaldoInicial
             && !t.EhAjusteReconciliacao && !t.EhPixNoCredito;

    /// <summary><see cref="EntraNoResultado"/> pra lista já carregada em memória.</summary>
    public static readonly Func<Transacao, bool> EntraNoResultadoEmMemoria = EntraNoResultado.Compile();

    /// <summary>Entradas e saídas que formam o saldo real de uma conta.</summary>
    public readonly record struct MovimentoConta(decimal Receitas, decimal Despesas)
    {
        public decimal Saldo => Receitas - Despesas;
    }

    /// <summary>
    /// Consulta do saldo real por conta: GROUP BY ContaId + SUM no banco. Separada do método async
    /// só pra dar pra inspecionar o SQL gerado (teste garante que a agregação acontece no banco, não
    /// em memória). Filtra pelo DONO da conta além dos ids: defesa em profundidade — id de conta alheia
    /// que escapar de um chamador soma zero em vez de expor o saldo de outro usuário.
    /// </summary>
    public static IQueryable<SaldoContaLinha> ConsultaSaldosDasContas(
        AppDbContext context, IEnumerable<Guid> contaIds, Guid usuarioId)
    {
        // Array (não IEnumerable qualquer) → o Npgsql traduz o Contains como "= ANY(@ids)".
        var ids = contaIds.Distinct().ToArray();
        return context.Transacoes
            .Where(CompoeSaldoReal)
            .Where(t => t.ContaId != null
                        && ids.Contains(t.ContaId.Value)
                        && t.Conta!.UsuarioIdProprietario == usuarioId)
            .GroupBy(t => t.ContaId!.Value)
            .Select(g => new SaldoContaLinha(
                g.Key,
                g.Sum(t => t.Tipo == TipoTransacao.Receita ? t.Valor : 0m),
                g.Sum(t => t.Tipo == TipoTransacao.Despesa ? t.Valor : 0m)));
    }

    /// <summary>Linha agregada da consulta de saldo (uma por conta com lançamento).</summary>
    public sealed record SaldoContaLinha(Guid ContaId, decimal Receitas, decimal Despesas);

    /// <summary>
    /// Saldo real de várias contas numa ida ao banco. Toda conta pedida vem no dicionário: a que não
    /// tem lançamento (não aparece no GROUP BY) volta com saldo zero.
    /// </summary>
    public static async Task<Dictionary<Guid, MovimentoConta>> SaldosDasContasAsync(
        AppDbContext context, IEnumerable<Guid> contaIds, Guid usuarioId)
    {
        var ids = contaIds.Distinct().ToList();
        var resultado = ids.ToDictionary(id => id, _ => new MovimentoConta(0m, 0m));
        if (ids.Count == 0) return resultado;

        var linhas = await ConsultaSaldosDasContas(context, ids, usuarioId).ToListAsync();
        foreach (var l in linhas)
            resultado[l.ContaId] = new MovimentoConta(l.Receitas, l.Despesas);
        return resultado;
    }

    /// <summary>Saldo real de UMA conta (mesma regra/consulta de <see cref="SaldosDasContasAsync"/>).</summary>
    public static async Task<MovimentoConta> SaldoDaContaAsync(AppDbContext context, Guid contaId, Guid usuarioId) =>
        (await SaldosDasContasAsync(context, new[] { contaId }, usuarioId))[contaId];

    /// <summary>
    /// Saldo real de TODAS as contas do usuário no fim de cada mês do ano (índice 0 = janeiro): tudo que
    /// entrou/saiu antes do ano + o acumulado mês a mês. Mesma regra do saldo da conta
    /// (<see cref="CompoeSaldoReal"/>, inclui saldo inicial, transferência e pagamento de fatura), agregada
    /// no banco. Compra no cartão não entra (não sai da conta até a fatura ser paga).
    /// </summary>
    public static async Task<decimal[]> SaldosNoFimDeCadaMesAsync(AppDbContext context, Guid usuarioId, int ano)
    {
        var inicioDoAno = new DateOnly(ano, 1, 1);
        var fimDoAno = new DateOnly(ano, 12, 31);
        var daConta = context.Transacoes
            .Where(CompoeSaldoReal)
            .Where(t => t.ContaId != null && t.Conta!.UsuarioIdProprietario == usuarioId);

        var antesDoAno = await daConta
            .Where(t => t.Data < inicioDoAno)
            .SumAsync(t => t.Tipo == TipoTransacao.Receita ? t.Valor : -t.Valor);
        var porMes = await daConta
            .Where(t => t.Data >= inicioDoAno && t.Data <= fimDoAno)
            .GroupBy(t => t.Data.Month)
            .Select(g => new { Mes = g.Key, Liquido = g.Sum(t => t.Tipo == TipoTransacao.Receita ? t.Valor : -t.Valor) })
            .ToListAsync();

        var saldos = new decimal[12];
        var acumulado = antesDoAno;
        for (var mes = 1; mes <= 12; mes++)
        {
            acumulado += porMes.FirstOrDefault(x => x.Mes == mes)?.Liquido ?? 0m;
            saldos[mes - 1] = acumulado;
        }
        return saldos;
    }

    // ── Total / restante de fatura ────────────────────────────────────────────

    /// <summary>
    /// Lançamento de crédito à vista (Transacao com <c>FaturaId</c>) que entra no total: comprado no
    /// crédito e vivo. O pagamento da fatura não entra — ele aponta pra fatura por <c>FaturaPagaId</c>
    /// (não <c>FaturaId</c>) e não é <c>UsadoComoCredito</c>, então não há dupla contagem.
    /// </summary>
    public static bool CompoeTotalFatura(Transacao t) => t.UsadoComoCredito && t.Ativo;

    /// <summary>
    /// Parcela de parcelamento que entra no total: Pendente ou Paga. A Paga continua no total porque o
    /// pagamento antecipado soma em <c>Fatura.ValorPago</c> — tirar ela do total descontaria duas vezes.
    /// A Cancelada SAI: o cancelamento mantém o <c>FaturaId</c> (histórico), e sem este filtro a fatura
    /// seguia cobrando o que não é mais devido. Por isso só pode ser cancelada parcela ainda devida —
    /// a quitada pela fatura conta como Paga (<see cref="ParcelaQuitadaPelaFatura"/>).
    /// </summary>
    public static bool CompoeTotalFatura(ParcelaTransacao p) => p.Status != StatusParcela.Cancelada;

    /// <summary>Valor devido da parcela: com juros (PIX Crédito) quando houver, senão o valor base.</summary>
    public static decimal ValorDevidoParcela(ParcelaTransacao p) => p.ValorComJuros ?? p.Valor;

    /// <summary>
    /// Total da fatura = crédito à vista (legado) + parcelas do parcelamento, pelas regras acima.
    /// Recebe as coleções (não a Fatura) pra servir também a quem monta faturas em memória (seeder).
    /// </summary>
    public static decimal ValorTotalFatura(IEnumerable<Transacao> transacoes, IEnumerable<ParcelaTransacao> parcelas) =>
        transacoes.Where(CompoeTotalFatura).Sum(t => t.Valor)
        + parcelas.Where(CompoeTotalFatura).Sum(ValorDevidoParcela);

    /// <summary>
    /// Total da fatura a partir das navegações carregadas — o chamador precisa ter feito
    /// <c>Include(Transacoes)</c> e <c>Include(ParcelasTransacao)</c>.
    /// </summary>
    public static decimal ValorTotalFatura(Fatura fatura) =>
        ValorTotalFatura(fatura.Transacoes, fatura.ParcelasTransacao);

    /// <summary>
    /// Quanto falta pagar. Nunca negativo: se o total cair depois de um pagamento (ex.: parcela
    /// cancelada numa fatura já paga em parte), o que sobra é crédito, não "restante negativo".
    /// </summary>
    public static decimal ValorRestanteFatura(decimal valorTotal, decimal valorPago) =>
        Math.Max(0m, valorTotal - valorPago);

    /// <summary>Restante a partir das navegações carregadas (mesmo requisito de <see cref="ValorTotalFatura(Fatura)"/>).</summary>
    public static decimal ValorRestanteFatura(Fatura fatura) =>
        ValorRestanteFatura(ValorTotalFatura(fatura), fatura.ValorPago);

    // ── Parcela quitada pela fatura ───────────────────────────────────────────

    /// <summary>
    /// Fatura COBERTA pelo pagamento: algo foi pago e nada resta (<c>ValorPago</c> ≥ total). Olha a
    /// cobertura REAL, não o rótulo <c>EstadoPagamento</c>, que diverge dela nos dois sentidos:
    /// <list type="bullet">
    ///   <item><c>Pago</c> sem cobrir: compra/parcela nova cai numa fatura já Pago
    ///   (<c>ObterOuCriarFaturaAsync</c> não olha o estado) — o que entrou depois não foi pago.</item>
    ///   <item>Coberta sem ser <c>Pago</c>: ciclo aberto que ficou Parcial com restante 0 depois de um
    ///   cancelamento (decisão em <see cref="ReconciliarEstadoPagamento"/>) — o que ficou já foi pago.</item>
    /// </list>
    /// Exige <c>Include(Transacoes)</c> e <c>Include(ParcelasTransacao)</c> (usa o total).
    /// </summary>
    public static bool FaturaCobertaPeloPagamento(Fatura fatura) =>
        fatura.ValorPago > 0 && ValorRestanteFatura(fatura) == 0;

    /// <summary>
    /// INVARIANTE: parcela <c>Pendente</c> numa fatura COBERTA pelo pagamento
    /// (<see cref="FaturaCobertaPeloPagamento"/>) JÁ FOI PAGA. Pagar a fatura
    /// (<c>FaturaService.PagarFaturaAsync</c>) só soma em <c>Fatura.ValorPago</c> — não mexe no Status das
    /// parcelas dela —, então ali "Pendente" quer dizer "paga via fatura", não "a pagar". Tudo que decide se
    /// a parcela ainda é devida (cancelar, sinalizar estorno) tem que tratá-la como Paga: cancelar tiraria
    /// do total um valor já pago e o dinheiro sumia (fatura de R$ 0 com R$ 300 pagos, <c>requerEstorno=false</c>).
    /// Cobertura, e não <c>EstadoPagamento == Pago</c>: parcela que caiu numa fatura já Pago não foi paga
    /// (tratar como paga gravava um PagoEm falso e sinalizava estorno de dinheiro que nunca saiu), e a do
    /// ciclo aberto coberto (Parcial com restante 0) foi.
    /// Cobertura PARCIAL (restante &gt; 0 mas menor que a parcela) não conta: aí o pagamento cobre só parte da
    /// parcela e marcá-la Paga cobraria o resto de uma compra cancelada. Cancelá-la deixa o excedente como
    /// crédito que o sistema não representa nem sinaliza — lacuna conhecida, item de ROADMAP.
    /// Exige a <c>Fatura</c> carregada COM <c>Transacoes</c> e <c>ParcelasTransacao</c>: com a coleção
    /// faltando o total sai menor e a parcela pareceria quitada em silêncio, então falha alto — por isso
    /// recebe o contexto (é ele que sabe se a coleção foi carregada).
    /// </summary>
    public static bool ParcelaQuitadaPelaFatura(AppDbContext context, ParcelaTransacao p)
    {
        if (p.Status != StatusParcela.Pendente) return false;
        var fatura = p.Fatura ?? throw new InvalidOperationException(
            "Carregue a Fatura da parcela (Include) antes de avaliar se ela foi quitada pela fatura.");
        var entrada = context.Entry(fatura);
        if (!entrada.Collection(f => f.Transacoes).IsLoaded || !entrada.Collection(f => f.ParcelasTransacao).IsLoaded)
            throw new InvalidOperationException(
                "Carregue Fatura.Transacoes e Fatura.ParcelasTransacao (ThenInclude) antes de avaliar se a parcela foi quitada pela fatura.");
        return FaturaCobertaPeloPagamento(fatura);
    }

    // ── Estado de pagamento depois que o total cai ────────────────────────────

    /// <summary>
    /// Reconcilia o estado de pagamento com o total ATUAL quando ele muda SEM pagamento novo — parcela
    /// ou parcelamento cancelado — ou quando o ciclo fecha. Sem isso a fatura travava: pagava R$ 100 de
    /// 300, a parcela de 200 era cancelada, o restante ia a 0 e o estado ficava Parcial pra sempre —
    /// job de atraso cobrando juros de fatura coberta e todo pagamento recusado ("Restante a pagar:
    /// R$ 0,00"). O limite não depende deste rótulo: segue o pago (<see cref="LimiteUsadoDaFatura(decimal, decimal)"/>).
    /// <list type="bullet">
    ///   <item>Ainda resta pagar → nada muda (estado e atraso seguem valendo).</item>
    ///   <item>Nada resta → sai do atraso (<c>EstaAtrasada=false</c>). Juros/multa já lançados ficam como
    ///   histórico (o job lança uma vez só e ninguém cobra a partir deles).</item>
    ///   <item>Nada resta, houve pagamento e o ciclo está FECHADO → <c>Pago</c>.</item>
    ///   <item>Ciclo ABERTO fica como está (Parcial com restante 0) até o fechamento, quando o
    ///   <c>FaturaFechamentoJob</c> aplica esta mesma regra. DECISÃO: marcar Pago com o ciclo aberto
    ///   travaria a próxima compra do ciclo — <c>ObterOuCriarFaturaAsync</c> põe a compra na fatura sem
    ///   olhar o estado e <c>PagarFaturaAsync</c> recusa fatura Pago ("já foi paga integralmente").
    ///   Parcial com restante 0 não prende limite: o usado segue o pago, não o rótulo. A janela foi
    ///   considerada: nela as parcelas Pendentes restantes JÁ estão pagas, e quem decide isso olha a
    ///   cobertura, não o rótulo — cancelar o parcelamento delas sinaliza estorno
    ///   (<see cref="ParcelaQuitadaPelaFatura"/>) e o pagamento antecipado recusa (restante menor que a
    ///   parcela, em <c>ParcelaTransacaoService.PagarAntecipadoAsync</c>).</item>
    ///   <item>Total 0 sem nada pago (todas as parcelas canceladas) fica <c>NaoPago</c> com restante 0:
    ///   não vira Pago (nada foi pago, e Pago travaria uma compra retroativa no ciclo) e não fica
    ///   vencida/atrasada, que derivam do restante. É o que a tela já mostra pra mês sem lançamento
    ///   (estado 0, restante 0, sem "Vencida", sem botão Pagar); fechada, aparece como "Paga" porque a
    ///   tela olha o restante, não o EstadoPagamento.</item>
    /// </list>
    /// Só avança (Parcial → Pago, atrasada → em dia): total que cai nunca faz a fatura dever mais.
    /// Exige <c>Include(Transacoes)</c> e <c>Include(ParcelasTransacao)</c>.
    /// </summary>
    /// <returns><c>true</c> se a fatura virou Pago agora — o chamador registra com
    /// <see cref="RegistrarQuitacaoSemPagamentoNovo"/>.</returns>
    public static bool ReconciliarEstadoPagamento(Fatura fatura, DateTime agora)
    {
        if (ValorRestanteFatura(fatura) > 0) return false;

        fatura.EstaAtrasada = false;

        if (fatura.ValorPago <= 0
            || fatura.EstadoCiclo != EstadoCicloFatura.Fechada
            || fatura.EstadoPagamento == EstadoPagamentoFatura.Pago)
            return false;

        fatura.EstadoPagamento = EstadoPagamentoFatura.Pago;
        fatura.DataPagamentoTotal = agora;
        return true;
    }

    /// <summary>
    /// Registra <c>FaturaPagaTotal</c> pra fatura que virou Pago SEM dinheiro novo — o total caiu até o já
    /// pago (cancelamento) ou o ciclo fechou já coberto (<c>FaturaFechamentoJob</c>). Toda passagem pra
    /// Pago muda a fatura sem movimento de dinheiro, então a trilha de auditoria registra por qualquer
    /// caminho, com o mesmo formato — antes só o cancelamento registrava e o job não.
    /// Não salva — o chamador grava junto com a mudança de estado.
    /// </summary>
    public static void RegistrarQuitacaoSemPagamentoNovo(
        FinancialEventLogService eventLog,
        Fatura fatura,
        Guid usuarioId,
        Guid correlationId,
        string origemAcao,
        string motivo)
    {
        eventLog.Registrar(
            usuarioId: usuarioId,
            tipo: FinancialEventType.FaturaPagaTotal,
            entidade: "Fatura",
            entidadeId: fatura.Id,
            correlationId: correlationId,
            origemAcao: origemAcao,
            valorAntes: fatura.ValorPago,
            valorDepois: fatura.ValorPago, // nenhum dinheiro novo: o total é que ficou coberto pelo já pago
            payload: new
            {
                motivo,
                valorTotal = ValorTotalFatura(fatura),
                estadoPagamento = fatura.EstadoPagamento.ToString(),
            });
    }

    /// <summary>
    /// Depois de cancelar parcela(s): recarrega as faturas afetadas (com Transacoes e ParcelasTransacao),
    /// aplica <see cref="ReconciliarEstadoPagamento"/> e registra <c>FaturaPagaTotal</c> no audit log pra
    /// cada uma que virou Pago (<see cref="RegistrarQuitacaoSemPagamentoNovo"/>). Parcela avulsa e
    /// parcelamento inteiro passam por aqui — um lugar só.
    /// Consulta RASTREADA de propósito: a parcela já marcada Cancelada em memória no mesmo contexto volta
    /// como a mesma instância (o EF não sobrescreve entidade rastreada), então o total já sai sem ela
    /// antes do SaveChanges. Filtra pelo dono do cartão (defesa em profundidade, mesmo molde do saldo).
    /// Não salva — o chamador grava na mesma transação.
    /// </summary>
    /// <returns>As faturas que viraram Pago.</returns>
    public static async Task<List<Fatura>> ReconciliarFaturasAposCancelamentoAsync(
        AppDbContext context,
        FinancialEventLogService eventLog,
        IEnumerable<Guid> faturaIds,
        Guid usuarioId,
        Guid correlationId,
        DateTime agora)
    {
        var ids = faturaIds.Distinct().ToArray();
        if (ids.Length == 0) return new List<Fatura>();

        var faturas = await context.Faturas
            .Include(f => f.Transacoes)
            .Include(f => f.ParcelasTransacao)
            .Where(f => ids.Contains(f.Id) && f.CartaoCredito.CriadoPor == usuarioId)
            .ToListAsync();

        var quitadas = faturas.Where(f => ReconciliarEstadoPagamento(f, agora)).ToList();
        foreach (var f in quitadas)
            RegistrarQuitacaoSemPagamentoNovo(eventLog, f, usuarioId, correlationId, "API", "CancelamentoZerouRestante");
        return quitadas;
    }

    // ── Limite do cartão ──────────────────────────────────────────────────────
    //
    // Havia duas regras e nenhuma batia com o banco: o card da tela de cartões somava só compra à vista
    // datada no ciclo atual (ignorava parcela) e subtraía o ValorPago inteiro das faturas — com
    // R$ 1.500 em parcelamentos mostrava "Disponível R$ 5.000 de R$ 5.000"; o LimiteCalculator somava
    // parcela Pendente + à vista de fatura não Pago — pagamento parcial não liberava nada e a parcela
    // coberta pelo pagamento da fatura seguia bloqueando. A regra agora é a do banco: comprou, o usado
    // sobe; pagou a fatura (mesmo em parte), o usado desce na medida do pago. Um lugar só, os dois usam.

    /// <summary>
    /// Limite que UMA fatura segura: o que ela cobra de efetivado menos o que já foi pago, nunca
    /// negativo. O piso é por fatura de propósito: excesso pago numa fatura (pagou a mais, parcela
    /// cancelada depois do pagamento) é crédito que o sistema ainda não representa — não pode liberar
    /// o limite de OUTRA fatura, senão o usado caía por uma compra que ninguém pagou.
    /// </summary>
    public static decimal LimiteUsadoDaFatura(decimal valorExecutado, decimal valorPago) =>
        Math.Max(0m, valorExecutado - valorPago);

    /// <summary>
    /// O que UMA fatura carregada cobra de EFETIVADO: o total (<see cref="ValorTotalFatura(Fatura)"/>) sem
    /// previsão — a mesma conta que <see cref="ConsultaLimitePorFatura"/> faz em SQL, pra quem já tem a
    /// fatura na mão e precisa do antes/depois de uma mudança ainda não salva. Exige
    /// <c>Include(Transacoes)</c> e <c>Include(ParcelasTransacao)</c>.
    /// </summary>
    public static decimal ValorExecutadoFatura(Fatura fatura) =>
        ValorTotalFatura(
            fatura.Transacoes.Where(t => t.StatusTransacao == StatusTransacao.Executado),
            fatura.ParcelasTransacao);

    /// <summary>
    /// Limite que a fatura carregada segura agora (<see cref="LimiteUsadoDaFatura(decimal, decimal)"/> com o
    /// efetivado dela). Quem muda pago ou total de faturas mede o limite que REALMENTE soltou pela queda
    /// disto antes/depois — o valor da parcela ou do pagamento é só o teto: o usado segue o pago de cada
    /// fatura, então pagamento anterior já tinha soltado parte, e pagamento que cobre previsão não solta
    /// nada (previsão não usa limite). Mesmo requisito de <see cref="ValorExecutadoFatura"/>.
    /// </summary>
    public static decimal LimiteUsadoDaFatura(Fatura fatura) =>
        LimiteUsadoDaFatura(ValorExecutadoFatura(fatura), fatura.ValorPago);

    /// <summary>
    /// Disponível = limite total − usado. PODE ficar negativo: se o usado passou do limite (compra
    /// lançada acima do disponível, limite reduzido depois), o número mostra o estouro em vez de
    /// esconder atrás de um zero. A trava de compra parcelada ("Limite insuficiente") compara com ele.
    /// </summary>
    public static decimal LimiteDisponivel(decimal limiteTotal, decimal limiteUsado) =>
        limiteTotal - limiteUsado;

    /// <summary>Linha da consulta de limite: uma por fatura dos cartões pedidos.</summary>
    public sealed record LimiteFaturaLinha(Guid CartaoId, decimal ValorExecutado, decimal ValorPago);

    /// <summary>
    /// Por fatura: o que ela cobra de EFETIVADO e o que já foi pago. "Cobra" é a regra do total da fatura
    /// (<see cref="CompoeTotalFatura(Transacao)"/> + <see cref="CompoeTotalFatura(ParcelaTransacao)"/>,
    /// valor devido da parcela = <see cref="ValorDevidoParcela"/>), escrita aqui em SQL — um bool em C#
    /// não vira WHERE —, com UMA diferença: previsão (recorrente futura no cartão) fica fora. Ela entra no
    /// total pagável, mas ainda não foi cobrada, então não usa limite (aparece à parte como exposição
    /// futura no LimiteCalculator). Parcela entra inteira, inclusive a de fatura futura: compra parcelada
    /// bloqueia o valor de todas as parcelas não pagas, como no banco. A mesma conta pra fatura já
    /// carregada é <see cref="ValorExecutadoFatura"/> (teste garante que as duas batem).
    /// Somas nas subconsultas (uma linha por fatura, não o histórico de lançamentos em memória); o piso
    /// por fatura (<see cref="LimiteUsadoDaFatura(decimal, decimal)"/>) é aplicado depois, no C#. Filtra pelo dono do
    /// cartão: id de cartão alheio vindo de um chamador não devolve nada.
    /// </summary>
    public static IQueryable<LimiteFaturaLinha> ConsultaLimitePorFatura(
        AppDbContext context, IEnumerable<Guid> cartaoIds, Guid usuarioId)
    {
        var ids = cartaoIds.Distinct().ToArray();
        return context.Faturas
            .Where(f => ids.Contains(f.CartaoCreditoId) && f.CartaoCredito.CriadoPor == usuarioId)
            .Select(f => new LimiteFaturaLinha(
                f.CartaoCreditoId,
                f.Transacoes
                    .Where(t => t.UsadoComoCredito && t.Ativo && t.StatusTransacao == StatusTransacao.Executado)
                    .Sum(t => t.Valor)
                + f.ParcelasTransacao
                    .Where(p => p.Status != StatusParcela.Cancelada)
                    .Sum(p => p.ValorComJuros ?? p.Valor),
                f.ValorPago));
    }

    /// <summary>Linha da consulta de compra no cartão fora de fatura (uma por cartão que tem).</summary>
    public sealed record CompraSemFaturaLinha(Guid CartaoId, decimal Valor);

    /// <summary>
    /// Compra efetivada no cartão SEM fatura. Rede de segurança pra dado antigo: até a correção,
    /// <c>RecorrenteService.GerarPendentesAsync</c> lançava a recorrente de cartão como Executado sem
    /// <c>FaturaId</c> (e sem <c>UsadoComoCredito</c>); hoje ela nasce na fatura do período e o
    /// <c>ExpandirRecorrentesJob</c> põe as antigas na fatura delas (aí pagar libera). Enquanto nenhuma
    /// fatura cobra a compra, pagar fatura não a libera — mas ela foi feita no crédito e usa limite
    /// (conservador: não soltar limite de compra que ninguém pagou). Sai do usado quando a transação é
    /// excluída ou entra numa fatura. Parcela nunca cai aqui: <c>ParcelaTransacao.FaturaId</c> é obrigatório.
    /// Só despesa sem conta (compra com conta é débito, não crédito) e só do dono: o lançamento tem que
    /// ser dele além do cartão, pra um id de cartão alheio gravado num lançamento não mexer no limite
    /// de outra pessoa.
    /// </summary>
    public static IQueryable<CompraSemFaturaLinha> ConsultaComprasSemFatura(
        AppDbContext context, IEnumerable<Guid> cartaoIds, Guid usuarioId)
    {
        var ids = cartaoIds.Distinct().ToArray();
        return context.Transacoes
            .Where(t => t.CartaoCreditoId != null
                        && ids.Contains(t.CartaoCreditoId.Value)
                        && t.CartaoCredito!.CriadoPor == usuarioId
                        && t.CriadoPor == usuarioId
                        && t.FaturaId == null
                        && t.ContaId == null
                        && !t.EhPagamentoFatura
                        && t.Ativo
                        && t.StatusTransacao == StatusTransacao.Executado
                        && t.Tipo == TipoTransacao.Despesa)
            .GroupBy(t => t.CartaoCreditoId!.Value)
            .Select(g => new CompraSemFaturaLinha(g.Key, g.Sum(t => t.Valor)));
    }

    /// <summary>
    /// Limite USADO de vários cartões em duas idas ao banco (não uma por cartão): Σ das faturas de
    /// <see cref="LimiteUsadoDaFatura(decimal, decimal)"/> + compra fora de fatura. Todo cartão pedido vem no dicionário
    /// (sem fatura nem compra → 0). Mesmo número no card da tela de cartões, na trava de compra
    /// parcelada, no resultado de pagar/cancelar parcela e no dashboard.
    /// </summary>
    public static async Task<Dictionary<Guid, decimal>> LimitesUsadosDosCartoesAsync(
        AppDbContext context, IEnumerable<Guid> cartaoIds, Guid usuarioId)
    {
        var ids = cartaoIds.Distinct().ToList();
        var resultado = ids.ToDictionary(id => id, _ => 0m);
        if (ids.Count == 0) return resultado;

        var faturas = await ConsultaLimitePorFatura(context, ids, usuarioId).ToListAsync();
        foreach (var f in faturas)
            resultado[f.CartaoId] += LimiteUsadoDaFatura(f.ValorExecutado, f.ValorPago);

        var semFatura = await ConsultaComprasSemFatura(context, ids, usuarioId).ToListAsync();
        foreach (var s in semFatura)
            resultado[s.CartaoId] += s.Valor;

        return resultado;
    }

    /// <summary>Limite usado de UM cartão (mesma regra/consultas de <see cref="LimitesUsadosDosCartoesAsync"/>).</summary>
    public static async Task<decimal> LimiteUsadoDoCartaoAsync(AppDbContext context, Guid cartaoId, Guid usuarioId) =>
        (await LimitesUsadosDosCartoesAsync(context, new[] { cartaoId }, usuarioId))[cartaoId];

    // ── Gasto do mês por categoria ───────────────────────────────────────────

    /// <summary>O que foi gasto (efetivado) e o que ainda está previsto numa categoria no mês.</summary>
    public readonly record struct GastoCategoria(decimal Gasto, decimal Previsto);

    /// <summary>Chave de "sem categoria" no dicionário de <see cref="GastosPorCategoriaDoMesAsync"/>.</summary>
    public static readonly Guid SemCategoria = Guid.Empty;

    /// <summary>
    /// Gasto do mês de uma pessoa por categoria (Limites; depois Relatórios). Regra única:
    /// <list type="bullet">
    /// <item>despesa que entra no resultado (<see cref="EntraNoResultado"/>), em conta ou à vista no cartão, pela
    /// data do lançamento; efetivada é gasto, prevista (conta fixa que ainda vai cair) é previsto;</item>
    /// <item>compra parcelada conta a PARCELA no mês dela (o valor com juros, se tiver), não o total no mês da
    /// compra. Parcelamento não vira lançamento: antes ficava de fora e o limite mostrava menos do que foi gasto.</item>
    /// </list>
    /// Parcela cancelada e parcelamento cancelado saem. Subcategoria soma na categoria dela.
    /// </summary>
    public static async Task<Dictionary<Guid, GastoCategoria>> GastosPorCategoriaDoMesAsync(
        AppDbContext context, Guid usuarioId, int ano, int mes)
    {
        var inicio = new DateOnly(ano, mes, 1);
        var fim = inicio.AddMonths(1);
        var lancamentos = await context.Transacoes.AsNoTracking()
            .Where(t => t.CriadoPor == usuarioId && t.Tipo == TipoTransacao.Despesa && t.Ativo
                        && t.StatusTransacao != StatusTransacao.Cancelado && t.Data >= inicio && t.Data < fim)
            .Where(EntraNoResultado)
            .GroupBy(t => new { t.CategoriaId, Efetivado = t.StatusTransacao == StatusTransacao.Executado })
            .Select(g => new { g.Key.CategoriaId, g.Key.Efetivado, Total = g.Sum(t => t.Valor) })
            .ToListAsync();

        var de = inicio.ToDateTime(TimeOnly.MinValue);
        var ate = fim.ToDateTime(TimeOnly.MinValue);
        var parcelas = await context.ParcelasTransacao.AsNoTracking()
            .Where(p => p.Parcelamento!.CriadoPor == usuarioId && p.Parcelamento.Ativo
                        && p.Status != StatusParcela.Cancelada && p.DataVencimento >= de && p.DataVencimento < ate)
            .GroupBy(p => p.Parcelamento!.CategoriaId)
            .Select(g => new { CategoriaId = g.Key, Total = g.Sum(p => p.ValorComJuros ?? p.Valor) })
            .ToListAsync();

        var resultado = new Dictionary<Guid, GastoCategoria>();
        void Soma(Guid? categoriaId, decimal gasto, decimal previsto)
        {
            var chave = categoriaId ?? SemCategoria;
            var atual = resultado.GetValueOrDefault(chave);
            resultado[chave] = new GastoCategoria(atual.Gasto + gasto, atual.Previsto + previsto);
        }
        foreach (var l in lancamentos)
            Soma(l.CategoriaId, l.Efetivado ? l.Total : 0m, l.Efetivado ? 0m : l.Total);
        foreach (var p in parcelas)
            Soma(p.CategoriaId, p.Total, 0m);
        return resultado;
    }
}
