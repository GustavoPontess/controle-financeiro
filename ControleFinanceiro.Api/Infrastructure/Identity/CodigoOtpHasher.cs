using System.Security.Cryptography;
using System.Text;

namespace ControleFinanceiro.Api.Infrastructure.Identity;

/// <summary>
/// Resumo do código de 6 números enviado por e-mail. Diferente do link (128 caracteres aleatórios, onde o SHA-256 puro
/// basta), um código de 6 números tem só 1 milhão de valores: com o banco vazado, o SHA-256 puro sairia em segundos.
/// Aqui é HMAC-SHA256 com uma chave que NÃO está no banco (derivada do JWT_SECRET por HKDF, com rótulo próprio) e com o
/// id da pessoa junto, então o resumo vazado não serve sem a chave do servidor.
/// </summary>
public static class CodigoOtpHasher
{
    private static readonly Lazy<byte[]> Chave = new(() =>
    {
        var segredo = Environment.GetEnvironmentVariable("JWT_SECRET");
        // Sem JWT_SECRET (só em teste que monta o serviço na mão; a API não sobe sem ele): chave aleatória do processo.
        if (string.IsNullOrEmpty(segredo)) return RandomNumberGenerator.GetBytes(32);
        return HKDF.DeriveKey(HashAlgorithmName.SHA256, Encoding.UTF8.GetBytes(segredo), 32,
            info: Encoding.UTF8.GetBytes("pontes-email-otp-v1"));
    });

    public static string Hash(Guid usuarioId, string codigo)
    {
        var mac = HMACSHA256.HashData(Chave.Value, Encoding.UTF8.GetBytes($"{usuarioId:N}:{codigo}"));
        return Convert.ToHexString(mac).ToLowerInvariant();
    }

    /// <summary>Compara em tempo constante.</summary>
    public static bool Confere(string hashGuardado, Guid usuarioId, string codigo) =>
        CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(hashGuardado), Encoding.ASCII.GetBytes(Hash(usuarioId, codigo)));
}
