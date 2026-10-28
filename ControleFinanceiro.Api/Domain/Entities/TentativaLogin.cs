namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Senhas erradas seguidas de um e-mail DIGITADO no login, exista ou não a conta (assim a resposta é igual nos dois
/// casos e ninguém descobre quem tem conta). Guarda só o resumo HMAC do e-mail (<c>TentativasLogin.ChaveDoEmail</c>),
/// nunca o e-mail. Vale 24 h depois da última falha; acerto da senha ou senha nova apagam a linha, e o
/// <c>PurgaTentativaLoginJob</c> apaga as vencidas todo dia. Regras em <c>Services/TentativasLogin.cs</c>.
/// </summary>
public class TentativaLogin
{
    public Guid Id { get; set; }

    /// <summary>HMAC-SHA256 do e-mail em minúsculas, com chave do servidor (não está no banco).</summary>
    public string ChaveEmail { get; set; } = string.Empty;

    public int Falhas { get; set; }

    public DateTime UltimaFalhaEm { get; set; }
}
