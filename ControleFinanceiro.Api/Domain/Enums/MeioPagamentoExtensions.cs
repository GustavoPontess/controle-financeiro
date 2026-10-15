namespace ControleFinanceiro.Api.Domain.Enums;

/// <summary>Rótulo do meio de pagamento — um lugar só (era copiado em 4 telas/relatórios e divergia ao crescer).</summary>
public static class MeioPagamentoExtensions
{
    public static string? Descricao(this MeioPagamento? meio) => meio switch
    {
        MeioPagamento.Dinheiro => "Dinheiro",
        MeioPagamento.Debito => "Débito",
        MeioPagamento.Credito => "Crédito",
        MeioPagamento.Pix => "Pix",
        MeioPagamento.Ted => "TED/DOC",
        MeioPagamento.Boleto => "Boleto",
        MeioPagamento.DebitoAutomatico => "Débito automático",
        _ => null,
    };

    public const string MensagemInvalido = "Forma de pagamento inválida.";

    /// <summary>
    /// Número vindo do cliente → enum. Fora do enum → 400 (antes gravava qualquer número: "99" virava um meio
    /// sem rótulo). Null segue null.
    /// </summary>
    public static MeioPagamento? DoCliente(int? valor) => valor switch
    {
        null => null,
        { } v when Enum.IsDefined(typeof(MeioPagamento), v) => (MeioPagamento)v,
        _ => throw new ArgumentException(MensagemInvalido),
    };
}
