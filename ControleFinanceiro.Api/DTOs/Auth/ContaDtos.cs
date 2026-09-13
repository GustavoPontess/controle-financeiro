namespace ControleFinanceiro.Api.DTOs.Auth;

/// <summary>Passo 1 da exclusão da própria conta: confirma a senha atual e, se o usuário não tem MFA,
/// dispara o PIN por e-mail. Resposta diz qual 2º fator o front deve pedir.</summary>
public class IniciarExclusaoContaRequest
{
    public string SenhaAtual { get; set; } = string.Empty;
}

/// <summary>Passo 2: senha atual + código do 2º fator (TOTP/backup se MFA ativo; senão PIN do e-mail).</summary>
public class ExcluirContaRequest
{
    public string SenhaAtual { get; set; } = string.Empty;
    public string Codigo { get; set; } = string.Empty;
}

/// <summary>Qual 2º fator o front deve pedir: "totp" (app/backup) ou "email" (PIN enviado).</summary>
public record Metodo2FaResponse(string Metodo);
