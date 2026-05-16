using System.Security.Cryptography;

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

    public bool ValidateToken(string token1, string token2)
    {
        if (string.IsNullOrEmpty(token1) || string.IsNullOrEmpty(token2))
            return false;

        return token1.Equals(token2, StringComparison.Ordinal);
    }
}
