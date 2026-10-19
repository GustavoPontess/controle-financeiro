namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Nomes dos meses em português, fixos. A imagem de produção (alpine) roda com globalização invariante: lá
/// <c>new CultureInfo("pt-BR")</c> lança erro e o nome do mês da cultura não existe. Ver também <see cref="Reais"/>.
/// </summary>
public static class MesesPt
{
    /// <summary>"janeiro" … "dezembro".</summary>
    public static readonly string[] Nomes =
        ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

    /// <summary>"Jan" … "Dez" (rótulo curto de gráfico).</summary>
    public static readonly string[] Curtos = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    /// <summary>Nome do mês (1–12).</summary>
    public static string Nome(int mes) => Nomes[mes - 1];
}
