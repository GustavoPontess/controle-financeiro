using ControleFinanceiro.Api.Infrastructure.Identity;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Identity;

/// <summary>
/// Criptografia do secret TOTP em repouso (AES-256-GCM). Roundtrip, chave separada obrigatória,
/// e que o ciphertext não é o texto claro.
/// </summary>
[Collection("PasswordHasherEnv")] // mexe em env var global (MFA_ENCRYPTION_KEY)
public class MfaCryptoTests : IDisposable
{
    public MfaCryptoTests()
        => Environment.SetEnvironmentVariable("MFA_ENCRYPTION_KEY", Convert.ToBase64String(new byte[32]));

    public void Dispose() => Environment.SetEnvironmentVariable("MFA_ENCRYPTION_KEY", null);

    [Fact]
    public void Encrypt_Decrypt_roundtrip()
    {
        var claro = "JBSWY3DPEHPK3PXP";
        var cifrado = MfaCrypto.Encrypt(claro);
        Assert.NotEqual(claro, cifrado);
        Assert.Equal(claro, MfaCrypto.Decrypt(cifrado));
    }

    [Fact]
    public void Encrypt_geraSaidaDiferente_porNonce()
    {
        var a = MfaCrypto.Encrypt("mesmo-segredo");
        var b = MfaCrypto.Encrypt("mesmo-segredo");
        Assert.NotEqual(a, b); // nonce aleatório
        Assert.Equal(MfaCrypto.Decrypt(a), MfaCrypto.Decrypt(b));
    }

    [Fact]
    public void SemChaveConfigurada_lancaExcecao()
    {
        Environment.SetEnvironmentVariable("MFA_ENCRYPTION_KEY", null);
        Assert.Throws<InvalidOperationException>(() => MfaCrypto.Encrypt("x"));
    }

    [Fact]
    public void ChaveComTamanhoErrado_lancaExcecao()
    {
        Environment.SetEnvironmentVariable("MFA_ENCRYPTION_KEY", Convert.ToBase64String(new byte[16])); // 128 bits, não 256
        Assert.Throws<InvalidOperationException>(() => MfaCrypto.Encrypt("x"));
    }
}
