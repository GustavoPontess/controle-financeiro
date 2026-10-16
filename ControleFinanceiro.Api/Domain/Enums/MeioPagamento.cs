namespace ControleFinanceiro.Api.Domain.Enums;

public enum MeioPagamento
{
    Dinheiro   = 1,
    Debito     = 2,
    Credito    = 3,
    Pix        = 4,
    Ted        = 5,
    Boleto     = 6,
    /// <summary>Debitado sozinho da conta no vencimento (conta de luz, internet, plano de saúde…).</summary>
    DebitoAutomatico = 7,
}
