using System.Text;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Regras de senha nova (cadastro, troca, redefinição) — NIST SP 800-63B rev4 §3.1.1.2:
/// <list type="bullet">
/// <item>tamanho 15–128 contado em caracteres de verdade (code points, depois da normalização NFC);</item>
/// <item>SEM regra de composição (maiúscula/número/símbolo — o NIST proíbe: "SHALL NOT impose other
/// composition rules"; aumenta a previsibilidade sem entropia real);</item>
/// <item>blocklist da senha INTEIRA (não substring): lista local de senhas comuns de 15+, sequências
/// (123456789012345), repetições (senhasenhasenha) e o próprio e-mail. A checagem contra senhas vazadas
/// (Pwned Passwords) fica no <see cref="ControleFinanceiro.Api.Infrastructure.Identity.IVerificadorSenhaVazada"/>,
/// chamada pelo AuthService depois desta.</item>
/// </list>
/// </summary>
public static class PasswordPolicyService
{
    public const int Minimo = 15;
    public const int Maximo = 128;
    public const string MensagemComum = "Senha muito comum. Escolha outra.";
    public const string MensagemEmail = "Não use o seu e-mail como senha.";
    public const string MensagemVazada = "Essa senha já vazou em outro site. Escolha outra.";

    // Comuns de 15+ (as curtas o tamanho já barra). O grosso vem do Pwned Passwords; esta lista cobre o que é
    // óbvio mesmo se o serviço estiver fora, e o que é bem brasileiro.
    private static readonly HashSet<string> SenhasComuns = new(StringComparer.OrdinalIgnoreCase)
    {
        "123456789012345", "1234567890123456", "12345678901234567890", "098765432109876",
        "qwertyuiopasdfg", "qwertyuiopasdfgh", "qwertyuiopasdfghjkl", "asdfghjklqwerty", "qwerty123456789",
        "passwordpassword", "password12345678", "iloveyouiloveyou",
        "minhasenhaforte", "minhasenhasegura", "minhasenhasecreta", "senhamuitoforte", "senhasuperforte",
        "senhasupersegura", "senhaforte12345", "senha123456789", "senha1234567890", "senha12345678910",
        "eutequeromuito", "euteamomuito123", "brasil123456789", "flamengo1234567", "corinthians12345",
        "palmeiras123456", "mudar123456789", "trocarasenha123",
    };

    /// <summary>Forma canônica (NFC): "ç" digitado como 1 ou 2 caracteres vira o mesmo texto.</summary>
    public static string Normalizar(string senha) => senha.Normalize(NormalizationForm.FormC);

    /// <summary>Tamanho em caracteres de verdade (code points depois do NFC) — emoji conta 1, não 2.</summary>
    public static int Tamanho(string senha) => Normalizar(senha).EnumerateRunes().Count();

    public static List<string> Validar(string senha, string? email = null)
    {
        var erros = new List<string>();
        var s = Normalizar(senha ?? string.Empty);
        var tamanho = s.EnumerateRunes().Count();
        // NIST: mínimo 15 quando a senha é o único fator (o MFA é opt-in, então vale pra todo mundo).
        // Teto alto pra frase, mas limitado pra não alimentar entrada gigante no Argon2id (DoS).
        if (tamanho < Minimo) erros.Add($"Mínimo {Minimo} caracteres");
        if (tamanho > Maximo) erros.Add($"Máximo {Maximo} caracteres");
        if (erros.Count > 0) return erros;

        if (SenhasComuns.Contains(s) || EhRepeticao(s) || EhSequencia(s))
            erros.Add(MensagemComum);
        else if (!string.IsNullOrWhiteSpace(email) && EhOEmail(s, email))
            erros.Add(MensagemEmail);
        return erros;
    }

    public static void ValidarOuLancar(string senha, string? email = null)
    {
        var erros = Validar(senha, email);
        if (erros.Count == 0) return;
        // Recusa por lista: a mensagem já é a frase pronta (NIST: dizer o motivo da recusa).
        if (erros.Count == 1 && (erros[0] == MensagemComum || erros[0] == MensagemEmail))
            throw new ArgumentException(erros[0]);
        throw new ArgumentException("Senha não atende aos requisitos: " + string.Join("; ", erros));
    }

    /// <summary>A senha inteira é um pedaço repetido: "aaaaaaaaaaaaaaa", "senhasenhasenha", "abcabcabcabcabc".</summary>
    private static bool EhRepeticao(string s)
    {
        var r = s.ToLowerInvariant();
        for (var k = 1; k <= r.Length / 2; k++)
        {
            if (r.Length % k != 0) continue;
            var parte = r[..k];
            var repetido = true;
            for (var i = k; i < r.Length && repetido; i += k)
                repetido = string.CompareOrdinal(r, i, parte, 0, k) == 0;
            if (repetido) return true;
        }
        return false;
    }

    /// <summary>A senha inteira é uma sequência de dígitos (com volta: …890123…) ou de letras, subindo ou descendo.</summary>
    private static bool EhSequencia(string s)
    {
        var r = s.ToLowerInvariant();
        if (r.All(char.IsAsciiDigit))
            return Passo(r, 10, c => c - '0', +1) || Passo(r, 10, c => c - '0', -1);
        if (r.All(char.IsAsciiLetterLower))
            return Passo(r, 0, c => c - 'a', +1) || Passo(r, 0, c => c - 'a', -1);
        return false;

        // Cada caractere é o anterior +1 (ou -1). Dígito dá a volta (9 → 0); letra não (z não volta pro a).
        static bool Passo(string t, int modulo, Func<char, int> valor, int dir)
        {
            var esperado = modulo > 0 ? ((dir % modulo) + modulo) % modulo : dir;
            for (var i = 1; i < t.Length; i++)
            {
                var d = valor(t[i]) - valor(t[i - 1]);
                if (modulo > 0) d = ((d % modulo) + modulo) % modulo;
                if (d != esperado) return false;
            }
            return true;
        }
    }

    /// <summary>A senha é o e-mail inteiro ou a parte antes do @ (NIST: termos do contexto, como o nome de usuário).</summary>
    private static bool EhOEmail(string s, string email)
    {
        var e = email.Trim();
        var local = e.Split('@')[0];
        return string.Equals(s, e, StringComparison.OrdinalIgnoreCase)
            || (local.Length > 0 && string.Equals(s, local, StringComparison.OrdinalIgnoreCase));
    }
}
