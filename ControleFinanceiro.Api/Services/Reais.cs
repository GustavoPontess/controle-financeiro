using System.Globalization;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Valor em reais pra mensagem que a pessoa lê ("R$ 1.234,56", "-R$ 10,00"), sem depender da cultura da máquina.
/// A imagem de produção (alpine) roda com globalização invariante: lá <c>{valor:C}</c> sai "¤1,234.56" e
/// <c>new CultureInfo("pt-BR")</c> lança erro. Este formato é montado à mão e vale em qualquer máquina.
/// </summary>
public static class Reais
{
    private static readonly NumberFormatInfo Formato = new()
    {
        CurrencySymbol = "R$",
        CurrencyDecimalSeparator = ",",
        CurrencyGroupSeparator = ".",
        CurrencyGroupSizes = [3],
        CurrencyDecimalDigits = 2,
        CurrencyPositivePattern = 2, // "R$ n"
        CurrencyNegativePattern = 9, // "-R$ n"
    };

    public static string Formatar(decimal valor) => valor.ToString("C", Formato);
}
