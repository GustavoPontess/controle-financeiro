using System.Security.Cryptography;
using System.Text;

namespace ControleFinanceiro.Api.Infrastructure.Identity;

/// <summary>
/// Criptografia do secret TOTP em repouso (AES-256-GCM). Diferente de hash (senha/token de
/// reset) — o secret TOTP precisa ser RECUPERÁVEL pra validar o código a cada login, não só
/// comparável, então não dá pra hashear. Chave separada do banco (env var
/// <c>MFA_ENCRYPTION_KEY</c>, 256 bits base64, gerar com <c>openssl rand -base64 32</c>) —
/// vazamento do Postgres sozinho não expõe os secrets TOTP dos usuários.
///
/// Formato armazenado: base64(nonce)$base64(ciphertext+tag).
/// </summary>
public static class MfaCrypto
{
    private const int NonceSize = 12; // 96 bits, padrão AES-GCM
    private const int TagSize = 16;   // 128 bits

    private static byte[] Key()
    {
        var raw = Environment.GetEnvironmentVariable("MFA_ENCRYPTION_KEY");
        if (string.IsNullOrEmpty(raw))
            throw new InvalidOperationException(
                "MFA_ENCRYPTION_KEY não configurada — obrigatória pra usar MFA (gerar com 'openssl rand -base64 32').");

        var key = Convert.FromBase64String(raw);
        if (key.Length != 32)
            throw new InvalidOperationException("MFA_ENCRYPTION_KEY precisa ter 32 bytes (256 bits) depois de decodificar o base64.");
        return key;
    }

    public static string Encrypt(string plaintext)
    {
        var key = Key();
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var plainBytes = Encoding.UTF8.GetBytes(plaintext);
        var cipherBytes = new byte[plainBytes.Length];
        var tag = new byte[TagSize];

        using var aes = new AesGcm(key, TagSize);
        aes.Encrypt(nonce, plainBytes, cipherBytes, tag);

        var cipherAndTag = new byte[cipherBytes.Length + tag.Length];
        Buffer.BlockCopy(cipherBytes, 0, cipherAndTag, 0, cipherBytes.Length);
        Buffer.BlockCopy(tag, 0, cipherAndTag, cipherBytes.Length, tag.Length);

        return string.Join('$', Convert.ToBase64String(nonce), Convert.ToBase64String(cipherAndTag));
    }

    public static string Decrypt(string stored)
    {
        var key = Key();
        var parts = stored.Split('$');
        if (parts.Length != 2)
            throw new InvalidOperationException("Valor criptografado de MFA em formato inesperado.");

        var nonce = Convert.FromBase64String(parts[0]);
        var cipherAndTag = Convert.FromBase64String(parts[1]);
        var cipherBytes = new byte[cipherAndTag.Length - TagSize];
        var tag = new byte[TagSize];
        Buffer.BlockCopy(cipherAndTag, 0, cipherBytes, 0, cipherBytes.Length);
        Buffer.BlockCopy(cipherAndTag, cipherBytes.Length, tag, 0, TagSize);

        var plainBytes = new byte[cipherBytes.Length];
        using var aes = new AesGcm(key, TagSize);
        aes.Decrypt(nonce, cipherBytes, tag, plainBytes);

        return Encoding.UTF8.GetString(plainBytes);
    }
}
