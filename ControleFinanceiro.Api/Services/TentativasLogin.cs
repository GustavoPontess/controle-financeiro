using System.Security.Cryptography;
using System.Text;
using ControleFinanceiro.Api.Domain.Entities;

namespace ControleFinanceiro.Api.Services;

/// <summary>
/// Regras de senha errada no login, num lugar só (desenho aprovado pelo Gustavo em 2026-10-28; fontes: NIST SP 800-63B
/// rev4 "Rate Limiting", OWASP Authentication Cheat Sheet, Microsoft Smart Lockout, Cloudflare Turnstile).
/// Tudo conta pelo E-MAIL DIGITADO, exista ou não a conta, pra resposta ser igual nos dois casos:
/// <list type="bullet">
/// <item>a partir do 1º erro, a próxima tentativa daquele e-mail exige o Turnstile;</item>
/// <item>a partir do 5º erro, espera que dobra (1 s, 2 s, 4 s... até 5 min), menos no aparelho onde a conta já entrou;</item>
/// <item>no 5º erro em 24 h de uma conta que existe, e-mail pro dono e alerta no Admin (1 por dia);</item>
/// <item>na 100ª senha errada SEGUIDA da conta, ela pede senha nova (só diz isso pra quem acertou a senha).</item>
/// </list>
/// Nada trava a conta de vez: quem ataca não consegue trancar o dono.
/// </summary>
public static class TentativasLogin
{
    public const string MensagemSenhaIncorreta = "E-mail ou senha incorretos.";
    public const string MensagemSenhaNova = "Por segurança, crie uma senha nova em \"Esqueci a senha\".";

    /// <summary>Uma falha some 24 h depois da última.</summary>
    public static readonly TimeSpan Janela = TimeSpan.FromHours(24);
    public const int FalhasParaVerificacao = 1;
    public const int FalhasParaEspera = 5;
    public const int EsperaMaximaSegundos = 300;
    public const int FalhasParaAvisarDono = 5;
    public const int FalhasSeguidasParaSenhaNova = 100;

    private static readonly Lazy<byte[]> Chave = new(() =>
    {
        var segredo = Environment.GetEnvironmentVariable("JWT_SECRET");
        // Sem JWT_SECRET (só em teste que monta o serviço na mão; a API não sobe sem ele): chave aleatória do processo.
        if (string.IsNullOrEmpty(segredo)) return RandomNumberGenerator.GetBytes(32);
        return HKDF.DeriveKey(HashAlgorithmName.SHA256, Encoding.UTF8.GetBytes(segredo), 32,
            info: Encoding.UTF8.GetBytes("pontes-login-email-v1"));
    });

    /// <summary>Resumo do e-mail digitado (minúsculas, sem espaço nas pontas). O e-mail nunca vai pro banco.</summary>
    public static string ChaveDoEmail(string email)
    {
        var mac = HMACSHA256.HashData(Chave.Value, Encoding.UTF8.GetBytes(email.Trim().ToLowerInvariant()));
        return Convert.ToHexString(mac).ToLowerInvariant();
    }

    /// <summary>Falhas que ainda valem (0 se não há linha ou se a última foi há mais de 24 h).</summary>
    public static int FalhasValendo(TentativaLogin? t, DateTime agora) =>
        t is null || agora - t.UltimaFalhaEm > Janela ? 0 : t.Falhas;

    public static bool PrecisaVerificacao(TentativaLogin? t, DateTime agora) =>
        FalhasValendo(t, agora) >= FalhasParaVerificacao;

    /// <summary>Segundos que ainda faltam pra poder tentar (0 = pode). Do 5º erro em diante: 1, 2, 4... até 300.</summary>
    public static int SegundosDeEspera(TentativaLogin? t, DateTime agora)
    {
        var falhas = FalhasValendo(t, agora);
        if (falhas < FalhasParaEspera) return 0;
        var espera = Math.Min(Math.Pow(2, falhas - FalhasParaEspera), EsperaMaximaSegundos);
        var falta = t!.UltimaFalhaEm.AddSeconds(espera) - agora;
        return falta <= TimeSpan.Zero ? 0 : (int)Math.Ceiling(falta.TotalSeconds);
    }
}
