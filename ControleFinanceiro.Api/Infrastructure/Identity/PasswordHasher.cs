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
///   ARGON2ID$&lt;memKiB&gt;$&lt;iterations&gt;$&lt;parallelism&gt;$&lt;base64(salt)&gt;$&lt;base64(hash)&gt;
///
/// Compatível com o hash <b>legado</b> (PBKDF2-HMAC-SHA256, 10k iterações, 20 bytes) — um
/// blob base64 sem '$'. <see cref="VerifyPassword"/> aceita ambos; <see cref="NeedsRehash"/>
/// sinaliza hashes fora do padrão atual para rehash transparente no próximo login.
///
/// Fontes: OWASP Password Storage Cheat Sheet; NIST SP 800-63B §3.1.1.2.
/// Pepper (NIST SHOULD — segredo server-side) não implementado aqui ainda: depende de
/// gestão de chave (KMS/HSM) — ver ROADMAP. Ponto de extensão: <c>argon2.KnownSecret</c>.
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

    public static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Argon2Hash(password, salt);
        return string.Join('$',
            Argon2Prefix,
            Argon2MemoryKiB,
            Argon2Iterations,
            Argon2Parallelism,
            Convert.ToBase64String(salt),
            Convert.ToBase64String(hash));
    }

    public static bool VerifyPassword(string password, string stored)
    {
        if (string.IsNullOrEmpty(stored))
            return false;

        return stored.StartsWith(Argon2Prefix + "$", StringComparison.Ordinal)
            ? VerifyArgon2(password, stored)
            : VerifyLegacyPbkdf2(password, stored);
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
        // ARGON2ID $ mem $ iter $ par $ salt $ hash  → 6 partes
        if (parts.Length != 6) return true;
        return !(int.TryParse(parts[1], out var mem) && mem == Argon2MemoryKiB
              && int.TryParse(parts[2], out var iter) && iter == Argon2Iterations
              && int.TryParse(parts[3], out var par) && par == Argon2Parallelism);
    }

    // ── Internos ─────────────────────────────────────────────────────────────────

    private static byte[] Argon2Hash(string password, byte[] salt,
        int memoryKiB = Argon2MemoryKiB, int iterations = Argon2Iterations, int parallelism = Argon2Parallelism)
    {
        using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password))
        {
            Salt = salt,
            MemorySize = memoryKiB,
            Iterations = iterations,
            DegreeOfParallelism = parallelism,
        };
        return argon2.GetBytes(HashSize);
    }

    private static bool VerifyArgon2(string password, string stored)
    {
        var parts = stored.Split('$');
        if (parts.Length != 6) return false;
        if (!int.TryParse(parts[1], out var mem) ||
            !int.TryParse(parts[2], out var iter) ||
            !int.TryParse(parts[3], out var par))
            return false;

        byte[] salt, expected;
        try
        {
            salt = Convert.FromBase64String(parts[4]);
            expected = Convert.FromBase64String(parts[5]);
        }
        catch (FormatException)
        {
            return false;
        }

        // Recomputa com os MESMOS parâmetros gravados no hash (não os atuais) — assim um
        // hash antigo de Argon2id ainda valida mesmo após subirmos os parâmetros.
        var actual = Argon2Hash(password, salt, mem, iter, par);
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
