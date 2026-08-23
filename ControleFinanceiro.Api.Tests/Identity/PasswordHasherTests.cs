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
// Testes de pepper mexem na env var PASSWORD_PEPPER (global do processo) — precisa rodar
// serializado com qualquer outro teste que chame PasswordHasher (AuthServiceTests), senão
// vira race condition entre threads paralelas do xUnit.
[CollectionDefinition("PasswordHasherEnv")]
public class PasswordHasherEnvCollection { }

[Collection("PasswordHasherEnv")]
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
        Assert.Equal(7, parts.Length);
        Assert.Equal("ARGON2ID", parts[0]);
        Assert.Equal("19456", parts[1]); // 19 MiB
        Assert.Equal("2", parts[2]);     // iterations
        Assert.Equal("1", parts[3]);     // parallelism
        Assert.Equal("0", parts[4]);     // pepperFlag — sem PASSWORD_PEPPER setada no teste
        Assert.Equal(32, Convert.FromBase64String(parts[6]).Length); // saída 32B, não 20B
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

    // ── Pepper (NIST SHOULD) ──────────────────────────────────────────────────────

    [Fact]
    public void Hash_comPepperLigado_marcaFlagENaoValidaSemPepper()
    {
        Environment.SetEnvironmentVariable("PASSWORD_PEPPER", "segredo-so-do-servidor-123");
        try
        {
            var hash = PasswordHasher.HashPassword("S3nh@ComPepper!2026");
            Assert.Equal("1", hash.Split('$')[4]); // pepperFlag ligado

            // Com o pepper certo, valida normal.
            Assert.True(PasswordHasher.VerifyPassword("S3nh@ComPepper!2026", hash));

            // Tira o pepper (simula ambiente sem a env var, ou pepper errado) — não valida mais,
            // é exatamente o ponto do pepper: sem ele, o hash sozinho não abre a senha.
            Environment.SetEnvironmentVariable("PASSWORD_PEPPER", null);
            Assert.False(PasswordHasher.VerifyPassword("S3nh@ComPepper!2026", hash));

            Environment.SetEnvironmentVariable("PASSWORD_PEPPER", "pepper-errado-999");
            Assert.False(PasswordHasher.VerifyPassword("S3nh@ComPepper!2026", hash));
        }
        finally
        {
            Environment.SetEnvironmentVariable("PASSWORD_PEPPER", null);
        }
    }

    [Fact]
    public void Hash_semPepperConfigurado_naoQuebraAmbiente()
    {
        // Ambiente sem PASSWORD_PEPPER (ex: dev local) continua funcionando normal.
        Environment.SetEnvironmentVariable("PASSWORD_PEPPER", null);
        var hash = PasswordHasher.HashPassword("SemPepperMesmo!2026");
        Assert.Equal("0", hash.Split('$')[4]);
        Assert.True(PasswordHasher.VerifyPassword("SemPepperMesmo!2026", hash));
    }

    [Fact]
    public void NeedsRehash_quandoPepperLigaDepoisDoHashExistir_pedeRehash()
    {
        // Hash criado ANTES do pepper existir (env var desligada) — quando o pepper liga
        // depois, esse hash antigo precisa regravar pra passar a usar o pepper também.
        Environment.SetEnvironmentVariable("PASSWORD_PEPPER", null);
        var hashSemPepper = PasswordHasher.HashPassword("x");
        try
        {
            Assert.False(PasswordHasher.NeedsRehash(hashSemPepper)); // ainda sem pepper ligado

            Environment.SetEnvironmentVariable("PASSWORD_PEPPER", "pepper-novo");
            Assert.True(PasswordHasher.NeedsRehash(hashSemPepper)); // pepper ligou, esse hash não tem
        }
        finally
        {
            Environment.SetEnvironmentVariable("PASSWORD_PEPPER", null);
        }
    }

    [Fact]
    public void Verify_hashCorrompido_naoLancaExcecao_retornaFalse()
    {
        Assert.False(PasswordHasher.VerifyPassword("x", "ARGON2ID$19456$2$1$nao-base64!$tambem-nao"));
        Assert.False(PasswordHasher.VerifyPassword("x", "ARGON2ID$so$tres$campos"));
        Assert.False(PasswordHasher.VerifyPassword("x", "@@@nao-base64@@@"));
    }
}
