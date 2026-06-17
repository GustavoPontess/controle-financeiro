using System.Security.Cryptography;
using System.Text;

namespace ControleFinanceiro.Api.Infrastructure.Identity;

/// <summary>
/// Hash de tokens opacos de alta entropia (reset de senha) para armazenamento.
/// SHA-256 basta — o token tem 64 bytes aleatórios, não precisa de KDF lento (ao contrário
/// de senha). Guarda-se só o hash no banco; o token bruto vai para o usuário (e-mail) e
/// nunca é persistido. Se o banco vazar, os hashes não revelam tokens utilizáveis.
/// </summary>
public static class OpaqueTokenHasher
{
    public static string Hash(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
