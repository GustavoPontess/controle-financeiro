namespace ControleFinanceiro.Api.Domain.Enums;

public static class TipoContaExtensions
{
    /// <summary>Nome do tipo de conta como aparece na tela (o <c>ToString()</c> do enum sai cru,
    /// tipo "ContaCorrente"). Fonte única — tela de contas e dashboard usam a mesma.</summary>
    public static string Descricao(this TipoConta tipo) => tipo switch
    {
        TipoConta.ContaCorrente => "Conta Corrente",
        TipoConta.ContaPoupanca => "Conta Poupança",
        TipoConta.CartaoCredito => "Cartão de Crédito",
        TipoConta.Dinheiro => "Dinheiro",
        TipoConta.Emprestimo => "Empréstimo",
        TipoConta.Investimento => "Investimentos",
        TipoConta.Caixinha => "Caixinha de meta",
        _ => tipo.ToString()
    };
}
