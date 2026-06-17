using System.Security.Cryptography;
using System.Text;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Identity;

/// <summary>
/// A1/A2: hash de senha com Argon2id (OWASP first-choice). Cobre roundtrip, formato
/// versionado (saída 32B, não 20B), compatibilidade com o hash legado PBKDF2 e a detecção
/// de rehash necessário.
/// </summary>
public class PasswordHasherTests
{
    // Reproduz o esquema LEGADO (PBKDF2-HMAC-SHA256, 10k iterações, 20 bytes, salt 16),
    // pra provar que VerifyPassword ainda valida hashes antigos do banco.
    private static string LegacyHash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var key = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password), salt, 10000, HashAlgorithmName.SHA256, 20);
        var blob = new byte[16 + 20];
        Array.Copy(salt, 0, blob, 0, 16);
        Array.Copy(key, 0, blob, 16, 20);
        return Convert.ToBase64String(blob);
    }

    [Fact]
    public void Hash_e_Verify_Argon2_roundtrip()
    {
        var hash = PasswordHasher.HashPassword("S3nh@Forte!2026");
        Assert.True(PasswordHasher.VerifyPassword("S3nh@Forte!2026", hash));
        Assert.False(PasswordHasher.VerifyPassword("senha errada", hash));
    }

    [Fact]
    public void Hash_usaFormatoArgon2idVersionado_com32bytes()
    {
        var hash = PasswordHasher.HashPassword("abc");
        var parts = hash.Split('$');
        Assert.Equal(6, parts.Length);
        Assert.Equal("ARGON2ID", parts[0]);
        Assert.Equal("19456", parts[1]); // 19 MiB
        Assert.Equal("2", parts[2]);     // iterations
        Assert.Equal("1", parts[3]);     // parallelism
        Assert.Equal(32, Convert.FromBase64String(parts[5]).Length); // saída 32B, não 20B
    }

    [Fact]
    public void Hash_geraSaltUnico_porChamada()
    {
        var a = PasswordHasher.HashPassword("mesma-senha");
        var b = PasswordHasher.HashPassword("mesma-senha");
        Assert.NotEqual(a, b); // salt aleatório → hashes diferentes
        Assert.True(PasswordHasher.VerifyPassword("mesma-senha", a));
        Assert.True(PasswordHasher.VerifyPassword("mesma-senha", b));
    }

    [Fact]
    public void Verify_aceitaHashLegadoPbkdf2()
    {
        var legacy = LegacyHash("senhaAntiga123");
        Assert.True(PasswordHasher.VerifyPassword("senhaAntiga123", legacy));
        Assert.False(PasswordHasher.VerifyPassword("outra", legacy));
    }

    [Fact]
    public void NeedsRehash_trueParaLegado_falseParaAtual()
    {
        Assert.True(PasswordHasher.NeedsRehash(LegacyHash("x")));   // PBKDF2 legado
        Assert.True(PasswordHasher.NeedsRehash(""));                // vazio/desconhecido
        Assert.True(PasswordHasher.NeedsRehash("lixo-sem-cifrao")); // não reconhecido
        Assert.False(PasswordHasher.NeedsRehash(PasswordHasher.HashPassword("x"))); // atual
    }

    [Fact]
    public void Verify_hashCorrompido_naoLancaExcecao_retornaFalse()
    {
        Assert.False(PasswordHasher.VerifyPassword("x", "ARGON2ID$19456$2$1$nao-base64!$tambem-nao"));
        Assert.False(PasswordHasher.VerifyPassword("x", "ARGON2ID$so$tres$campos"));
        Assert.False(PasswordHasher.VerifyPassword("x", "@@@nao-base64@@@"));
    }
}
