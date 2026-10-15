using System.Security.Cryptography;
using System.Text;
using Konscious.Security.Cryptography;

namespace ControleFinanceiro.Api.Infrastructure.Identity;

/// <summary>
/// Hash de senha com <b>Argon2id</b> — primeira escolha da OWASP Password Storage Cheat
/// Sheet (memory-hard, resistente a GPU/ASIC). Parâmetros = mínimo recomendado pela OWASP
/// para 2024-2025: 19 MiB de memória, 2 iterações, paralelismo 1 (m=19456 KiB, t=2, p=1).
/// Salt 16 bytes (RNG), saída 32 bytes (= tamanho nativo, sem truncar).
///
/// Formato armazenado, auto-descritivo (permite migração futura de parâmetros/algoritmo):
///   ARGON2ID$&lt;memKiB&gt;$&lt;iterations&gt;$&lt;parallelism&gt;$&lt;pepperFlag&gt;$&lt;base64(salt)&gt;$&lt;base64(hash)&gt;
///
/// Compatível com o hash <b>legado</b> (PBKDF2-HMAC-SHA256, 10k iterações, 20 bytes) — um
/// blob base64 sem '$'. <see cref="VerifyPassword"/> aceita ambos; <see cref="NeedsRehash"/>
/// sinaliza hashes fora do padrão atual (formato de 6 partes sem pepperFlag, ou pepper ligado
/// mas hash gravado sem ele) para rehash transparente no próximo login.
///
/// Fontes: OWASP Password Storage Cheat Sheet; NIST SP 800-63B §3.1.1.2.
///
/// <b>Pepper (NIST SHOULD):</b> segredo server-side aplicado via <c>Argon2.KnownSecret</c> — nunca
/// gravado no banco, só na env var <c>PASSWORD_PEPPER</c> (fica fora do alcance de quem só vaza o
/// Postgres). Se a env var não estiver setada, hash/verify seguem sem pepper (não quebra ambiente
/// sem ela configurada — ex. dev local). <c>pepperFlag</c> no formato registra se aquele hash
/// específico foi gravado com pepper, pra saber se deve aplicar no verify.
/// </summary>
public static class PasswordHasher
{
    // ── Argon2id (atual) ───────────────────────────────────────────────────────
    private const string Argon2Prefix = "ARGON2ID";
    private const int Argon2MemoryKiB = 19456; // 19 MiB
    private const int Argon2Iterations = 2;
    private const int Argon2Parallelism = 1;
    private const int SaltSize = 16; // 128 bits (OWASP)
    private const int HashSize = 32; // 256 bits (saída nativa SHA-256)

    // ── PBKDF2 legado (somente verificação) ──────────────────────────────────────
    private const int LegacySaltSize = 16;
    private const int LegacyHashSize = 20;
    private const int LegacyIterations = 10000;

    private static byte[]? Pepper()
    {
        var raw = Environment.GetEnvironmentVariable("PASSWORD_PEPPER");
        return string.IsNullOrEmpty(raw) ? null : Encoding.UTF8.GetBytes(raw);
    }

    /// <summary>Gera o hash da senha já na forma canônica (NFC — NIST SHOULD): "ç" digitado como 1 ou 2
    /// caracteres (teclados/sistemas diferentes) vira a mesma senha.</summary>
    public static string HashPassword(string password)
    {
        password = password.Normalize(System.Text.NormalizationForm.FormC);
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var pepper = Pepper();
        var hash = Argon2Hash(password, salt, knownSecret: pepper);
        return string.Join('$',
            Argon2Prefix,
            Argon2MemoryKiB,
            Argon2Iterations,
            Argon2Parallelism,
            pepper is null ? "0" : "1",
            Convert.ToBase64String(salt),
            Convert.ToBase64String(hash));
    }

    /// <summary>Confere na forma canônica (NFC). Hash gravado antes da normalização com a forma decomposta
    /// ainda confere: se a NFC não bate e o texto digitado era diferente dela, tenta o texto como veio.</summary>
    public static bool VerifyPassword(string password, string stored)
    {
        if (string.IsNullOrEmpty(stored))
            return false;

        var nfc = password.Normalize(System.Text.NormalizationForm.FormC);
        if (Verificar(nfc, stored)) return true;
        return !string.Equals(nfc, password, StringComparison.Ordinal) && Verificar(password, stored);

        static bool Verificar(string senha, string hash) => hash.StartsWith(Argon2Prefix + "$", StringComparison.Ordinal)
            ? VerifyArgon2(senha, hash)
            : VerifyLegacyPbkdf2(senha, hash);
    }

    /// <summary>
    /// True quando o hash armazenado não está no esquema/parâmetros atuais (legado PBKDF2 ou
    /// Argon2id com parâmetros diferentes) e deve ser regravado no próximo login bem-sucedido.
    /// </summary>
    public static bool NeedsRehash(string stored)
    {
        if (string.IsNullOrEmpty(stored) || !stored.StartsWith(Argon2Prefix + "$", StringComparison.Ordinal))
            return true; // legado (ou vazio/desconhecido)

        var parts = stored.Split('$');
        // ARGON2ID $ mem $ iter $ par $ pepperFlag $ salt $ hash  → 7 partes
        if (parts.Length != 7) return true; // inclui o formato antigo de 6 partes (sem pepperFlag)
        if (!(int.TryParse(parts[1], out var mem) && mem == Argon2MemoryKiB
              && int.TryParse(parts[2], out var iter) && iter == Argon2Iterations
              && int.TryParse(parts[3], out var par) && par == Argon2Parallelism))
            return true;

        // Pepper foi ligado (env var configurada) mas esse hash específico foi gravado sem —
        // regrava pra passar a usar, mesmo que os outros parâmetros já estejam atuais.
        var hashTemPepper = parts[4] == "1";
        var pepperLigado = Pepper() is not null;
        return pepperLigado && !hashTemPepper;
    }

    // ── Internos ─────────────────────────────────────────────────────────────────

    private static byte[] Argon2Hash(string password, byte[] salt,
        int memoryKiB = Argon2MemoryKiB, int iterations = Argon2Iterations, int parallelism = Argon2Parallelism,
        byte[]? knownSecret = null)
    {
        using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password))
        {
            Salt = salt,
            MemorySize = memoryKiB,
            Iterations = iterations,
            DegreeOfParallelism = parallelism,
            KnownSecret = knownSecret,
        };
        return argon2.GetBytes(HashSize);
    }

    private static bool VerifyArgon2(string password, string stored)
    {
        var parts = stored.Split('$');
        // Formato antigo (6 partes, sem pepperFlag) — hash foi gravado sem pepper, sempre.
        var legacySemPepperFlag = parts.Length == 6;
        if (!legacySemPepperFlag && parts.Length != 7) return false;

        if (!int.TryParse(parts[1], out var mem) ||
            !int.TryParse(parts[2], out var iter) ||
            !int.TryParse(parts[3], out var par))
            return false;

        var saltIdx = legacySemPepperFlag ? 4 : 5;
        var hashIdx = legacySemPepperFlag ? 5 : 6;
        var hashTemPepper = !legacySemPepperFlag && parts[4] == "1";

        byte[] salt, expected;
        try
        {
            salt = Convert.FromBase64String(parts[saltIdx]);
            expected = Convert.FromBase64String(parts[hashIdx]);
        }
        catch (FormatException)
        {
            return false;
        }

        // Só aplica o pepper atual se ESSE hash foi gravado com pepper — senão a senha nunca
        // mais validaria pra quem se cadastrou antes do pepper existir.
        var pepper = hashTemPepper ? Pepper() : null;

        // Recomputa com os MESMOS parâmetros gravados no hash (não os atuais) — assim um
        // hash antigo de Argon2id ainda valida mesmo após subirmos os parâmetros.
        var actual = Argon2Hash(password, salt, mem, iter, par, pepper);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    private static bool VerifyLegacyPbkdf2(string password, string stored)
    {
        byte[] hashBytes;
        try
        {
            hashBytes = Convert.FromBase64String(stored);
        }
        catch (FormatException)
        {
            return false;
        }
        if (hashBytes.Length != LegacySaltSize + LegacyHashSize)
            return false;

        var salt = new byte[LegacySaltSize];
        Array.Copy(hashBytes, 0, salt, 0, LegacySaltSize);

        var keyToCheck = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password), salt, LegacyIterations, HashAlgorithmName.SHA256, LegacyHashSize);

        var keyInHash = new byte[LegacyHashSize];
        Array.Copy(hashBytes, LegacySaltSize, keyInHash, 0, LegacyHashSize);

        return CryptographicOperations.FixedTimeEquals(keyToCheck, keyInHash);
    }
}
