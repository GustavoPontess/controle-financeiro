using System.Text.RegularExpressions;

namespace ControleFinanceiro.Api.Services;

public static class PasswordPolicyService
{
    private static readonly HashSet<string> SenhasComuns = new(StringComparer.OrdinalIgnoreCase)
    {
        "password", "password1", "password12", "password123", "password1234",
        "123456789", "1234567890", "12345678", "1234567", "123456",
        "qwerty123", "qwerty1234", "qwertyuiop", "qwerty",
        "abc123456", "abc12345", "abc1234", "abc123",
        "iloveyou1", "iloveyou!", "iloveyou",
        "admin1234", "admin123!", "adminadmin", "admin@123",
        "welcome1!", "welcome123", "welcome1",
        "letmein1!", "letmein123", "letmein",
        "monkey123", "dragon123", "master123", "shadow123",
        "sunshine1", "superman1", "batman123", "trustno1!",
        "passw0rd!", "passw0rd1", "p@ssword1", "p@ssw0rd",
        "senha1234", "senha123!", "senha12345", "minhasenha",
        "brasil123", "futebol12", "flamengo1", "corinthian",
        "palmeiras", "gremio123", "santos123",
        "mudar123!", "mudar@123", "teste1234", "teste@123",
        "changeme1", "change123", "123mudar!", "123456abc",
    };

    public static List<string> Validar(string senha)
    {
        var erros = new List<string>();

        // NIST SP 800-63B: mínimo 15 chars sem MFA (ainda não temos MFA). Teto alto para
        // permitir passphrase, mas limitado p/ não alimentar entrada gigante ao Argon2id (DoS).
        if (senha.Length < 15)
            erros.Add("Mínimo 15 caracteres");

        if (senha.Length > 128)
            erros.Add("Máximo 128 caracteres");

        if (!Regex.IsMatch(senha, @"[a-z]"))
            erros.Add("Pelo menos 1 letra minúscula");

        if (!Regex.IsMatch(senha, @"[A-Z]"))
            erros.Add("Pelo menos 1 letra maiúscula");

        if (!Regex.IsMatch(senha, @"[0-9]"))
            erros.Add("Pelo menos 1 número");

        if (!Regex.IsMatch(senha, @"[^a-zA-Z0-9]"))
            erros.Add("Pelo menos 1 caractere especial (ex: !@#$%^&*)");

        if (erros.Count == 0 && SenhasComuns.Contains(senha))
            erros.Add("Senha muito comum, escolha outra");

        return erros;
    }

    public static void ValidarOuLancar(string senha)
    {
        var erros = Validar(senha);
        if (erros.Count > 0)
            throw new ArgumentException("Senha não atende aos requisitos: " + string.Join("; ", erros));
    }
}
