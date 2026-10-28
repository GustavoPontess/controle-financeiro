using System.Security.Cryptography;
using System.Text;

namespace ControleFinanceiro.Api.Infrastructure.Identity;

/// <summary>
/// "Aparelho conhecido": o navegador onde a conta já entrou com sucesso fica fora da espera que dobra (como o Smart
/// Lockout da Microsoft separa lugar conhecido de desconhecido). Assim quem erra a senha de propósito em outro lugar
/// não atrasa o dono. Não pula o Turnstile nem a senha.
/// <para>
/// Cookie <c>ac</c> httpOnly, só nos endpoints de auth, 180 dias, até 5 contas por navegador. Cada entrada é
/// <c>validade.assinatura</c>, onde a assinatura é HMAC(id da conta + validade) com chave do servidor: o id da conta
/// não aparece no cookie e ninguém fabrica uma entrada sem a chave.
/// </para>
/// </summary>
public static class AparelhoConhecido
{
    public const string Cookie = "ac";
    public const int Dias = 180;
    private const int MaxContas = 5;

    private static readonly Lazy<byte[]> Chave = new(() =>
    {
        var segredo = Environment.GetEnvironmentVariable("JWT_SECRET");
        if (string.IsNullOrEmpty(segredo)) return RandomNumberGenerator.GetBytes(32);
        return HKDF.DeriveKey(HashAlgorithmName.SHA256, Encoding.UTF8.GetBytes(segredo), 32,
            info: Encoding.UTF8.GetBytes("pontes-aparelho-conhecido-v1"));
    });

    private static string Assinar(Guid usuarioId, long validade)
    {
        var mac = HMACSHA256.HashData(Chave.Value, Encoding.UTF8.GetBytes($"{usuarioId:N}:{validade}"));
        return Convert.ToHexString(mac)[..32].ToLowerInvariant();
    }

    private static IEnumerable<(long Validade, string Assinatura)> Entradas(string? cookie, DateTime agora)
    {
        if (string.IsNullOrEmpty(cookie) || cookie.Length > 1024) yield break;
        var agoraUnix = new DateTimeOffset(agora, TimeSpan.Zero).ToUnixTimeSeconds();
        foreach (var parte in cookie.Split('~', StringSplitOptions.RemoveEmptyEntries))
        {
            var p = parte.Split('.');
            if (p.Length == 2 && long.TryParse(p[0], out var validade) && validade > agoraUnix && p[1].Length == 32)
                yield return (validade, p[1]);
        }
    }

    private static bool Confere((long Validade, string Assinatura) e, Guid usuarioId) =>
        CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(e.Assinatura), Encoding.ASCII.GetBytes(Assinar(usuarioId, e.Validade)));

    /// <summary>Este navegador já entrou nesta conta (e a entrada não venceu)?</summary>
    public static bool Reconhece(string? cookie, Guid usuarioId, DateTime agora) =>
        Entradas(cookie, agora).Any(e => Confere(e, usuarioId));

    /// <summary>Valor novo do cookie com esta conta (validade renovada), mantendo as outras contas válidas (até 5).</summary>
    public static string Lembrar(string? cookie, Guid usuarioId, DateTime agora)
    {
        var outras = Entradas(cookie, agora).Where(e => !Confere(e, usuarioId)).TakeLast(MaxContas - 1);
        var validade = new DateTimeOffset(agora.AddDays(Dias), TimeSpan.Zero).ToUnixTimeSeconds();
        return string.Join('~', outras.Append((validade, Assinar(usuarioId, validade))).Select(e => $"{e.Item1}.{e.Item2}"));
    }
}
