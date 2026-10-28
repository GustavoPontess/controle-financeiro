using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace ControleFinanceiro.Api.Infrastructure.Identity;

/// <summary>
/// Passe curto pra reativar a conta na carência de exclusão. O login devolve um quando a senha certa cai numa conta
/// marcada pra exclusão; o "Reativar conta" manda só ele (nunca e-mail e senha). Antes, o reativar recebia e-mail e
/// senha e conferia por fora do login (sem Turnstile, sem espera, resposta diferente quando a conta não existia): era
/// um atalho pra testar senha.
/// <para>
/// Formato <c>idDaConta.validade.assinatura</c>, HMAC com chave do servidor sobre o id, a validade e o hash da senha
/// atual: vale 10 minutos e deixa de valer se a senha mudar. Não guarda nada no banco.
/// </para>
/// </summary>
public static class TokenReativacao
{
    public static readonly TimeSpan Validade = TimeSpan.FromMinutes(10);

    private static readonly Lazy<byte[]> Chave = new(() =>
    {
        var segredo = Environment.GetEnvironmentVariable("JWT_SECRET");
        if (string.IsNullOrEmpty(segredo)) return RandomNumberGenerator.GetBytes(32);
        return HKDF.DeriveKey(HashAlgorithmName.SHA256, Encoding.UTF8.GetBytes(segredo), 32,
            info: Encoding.UTF8.GetBytes("pontes-reativar-conta-v1"));
    });

    private static string Assinar(Guid usuarioId, long validade, string hashDaSenha) =>
        Convert.ToHexString(HMACSHA256.HashData(Chave.Value, Encoding.UTF8.GetBytes($"{usuarioId:N}:{validade}:{hashDaSenha}"))).ToLowerInvariant();

    public static string Gerar(Guid usuarioId, string hashDaSenha, DateTime agora)
    {
        var validade = new DateTimeOffset(agora + Validade, TimeSpan.Zero).ToUnixTimeSeconds();
        return $"{usuarioId:N}.{validade}.{Assinar(usuarioId, validade, hashDaSenha)}";
    }

    /// <summary>Id da conta que o token diz (sem conferir nada ainda). Null se o formato não bate.</summary>
    public static Guid? Conta(string? token)
    {
        var p = token?.Split('.');
        return p is { Length: 3 } && Guid.TryParseExact(p[0], "N", out var id) ? id : null;
    }

    public static bool Confere(string? token, Guid usuarioId, string hashDaSenha, DateTime agora)
    {
        var p = token?.Split('.');
        if (p is not { Length: 3 } || !long.TryParse(p[1], NumberStyles.None, CultureInfo.InvariantCulture, out var validade)) return false;
        if (validade < new DateTimeOffset(agora, TimeSpan.Zero).ToUnixTimeSeconds()) return false;
        if (Conta(token) != usuarioId) return false;
        return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(p[2]), Encoding.ASCII.GetBytes(Assinar(usuarioId, validade, hashDaSenha)));
    }
}
