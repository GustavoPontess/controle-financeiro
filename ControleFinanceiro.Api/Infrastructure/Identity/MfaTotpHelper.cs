using OtpNet;

namespace ControleFinanceiro.Api.Infrastructure.Identity;

/// <summary>
/// TOTP (RFC 6238) via Otp.NET — não usamos ASP.NET Core Identity nesse projeto (auth
/// própria), então não tem "MFA via Identity" pronto; a lib faz só o cálculo/verificação do
/// código, compatível com Google Authenticator/Authy/1Password (SHA1, 6 dígitos, passo 30s —
/// parâmetros padrão do RFC e o que todo app autenticador espera).
/// </summary>
public static class MfaTotpHelper
{
    private const int SecretSizeBytes = 20; // 160 bits — mínimo recomendado RFC 4226 §4
    private const string Issuer = "Pontes Finanças";

    public static byte[] GerarSecret() => KeyGeneration.GenerateRandomKey(SecretSizeBytes);

    public static string ParaBase32(byte[] secret) => Base32Encoding.ToString(secret);

    public static byte[] DeBase32(string base32) => Base32Encoding.ToBytes(base32);

    /// <summary>URI otpauth:// padrão pro app autenticador ler via QR code.</summary>
    public static string ProvisioningUri(string email, string secretBase32)
    {
        var label = Uri.EscapeDataString($"{Issuer}:{email}");
        var issuer = Uri.EscapeDataString(Issuer);
        return $"otpauth://totp/{label}?secret={secretBase32}&issuer={issuer}&algorithm=SHA1&digits=6&period=30";
    }

    /// <summary>Aceita o código do passo anterior/seguinte (tolerância de clock drift comum
    /// entre celular e servidor) — janela de ±1 passo (30s), padrão da indústria.</summary>
    public static bool VerificarCodigo(byte[] secret, string codigo)
    {
        if (string.IsNullOrWhiteSpace(codigo)) return false;
        var totp = new Totp(secret, mode: OtpHashMode.Sha1, totpSize: 6);
        return totp.VerifyTotp(codigo, out _, new VerificationWindow(previous: 1, future: 1));
    }
}
