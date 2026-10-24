namespace ControleFinanceiro.Api.Domain.Enums
{
    public enum Finalidade
    {
        Despesa = 1,
        Receita = 2,
        Ambas = 3,
        /// <summary>Investimento (2026-10-22, seção Investimentos do Orçamento): aporte sai como despesa, resgate volta como
        /// receita; mexe no saldo mas não é gasto nem renda (<c>Transacao.EhInvestimento</c>).</summary>
        Investimento = 4
    }
}