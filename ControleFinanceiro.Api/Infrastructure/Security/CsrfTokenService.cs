using System.Security.Cryptography;
using System.Text;

namespace ControleFinanceiro.Api.Infrastructure.Security;

public class CsrfTokenService
{
    public string GenerateToken()
    {
        var bytes = new byte[32];
        using (var rng = RandomNumberGenerator.Create())
        {
            rng.GetBytes(bytes);
        }
        return Convert.ToBase64String(bytes);
    }

    /// <summary>
    /// Compara os dois lados do double-submit em tempo constante (<see cref="CryptographicOperations.FixedTimeEquals"/>)
    /// — evita oráculo de timing que uma comparação curto-circuitante (Ordinal) exporia. Diferença de
    /// tamanho já falha (FixedTimeEquals exige spans do mesmo comprimento).
    /// </summary>
    public bool ValidateToken(string token1, string token2)
    {
        if (string.IsNullOrEmpty(token1) || string.IsNullOrEmpty(token2))
            return false;

        var a = Encoding.UTF8.GetBytes(token1);
        var b = Encoding.UTF8.GetBytes(token2);
        if (a.Length != b.Length)
            return false;

        return CryptographicOperations.FixedTimeEquals(a, b);
    }
}
