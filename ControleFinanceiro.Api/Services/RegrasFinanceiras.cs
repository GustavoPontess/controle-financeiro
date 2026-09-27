using System.Linq.Expressions;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Fonte ÚNICA das regras de dinheiro que antes estavam copiadas (e divergiam) entre services,
/// controller e jobs: <b>saldo de conta</b> e <b>total/restante de fatura</b>.
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
    /// seguia cobrando o que não é mais devido.
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
}
