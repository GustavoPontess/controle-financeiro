using System.Security.Cryptography;
using System.Text;
using ControleFinanceiro.Api.Services;

namespace ControleFinanceiro.Api.Infrastructure.Identity;

/// <summary>
/// Senha nova já apareceu em vazamento? NIST SP 800-63B rev4 §3.1.1.2: "SHALL compare the prospective secret
/// against a blocklist" de senhas comuns, esperadas ou comprometidas.
/// </summary>
public interface IVerificadorSenhaVazada
{
    Task<bool> EstaVazadaAsync(string senha, CancellationToken ct = default);
}

/// <summary>
/// Pwned Passwords (Have I Been Pwned, indicado pela OWASP) por k-anonymity: só os 5 primeiros caracteres do
/// SHA-1 da senha saem do servidor; a resposta traz todos os sufixos com aquele começo e a comparação é aqui.
/// A senha e o e-mail nunca saem (LGPD ok). "Add-Padding" deixa todas as respostas do mesmo tamanho (ninguém
/// no meio do caminho deduz nada pelo tamanho). Fora do ar ou lento (timeout curto): deixa passar e registra
/// no log — não trava cadastro nem troca de senha (fail-open; a lista local continua valendo).
/// </summary>
public sealed class PwnedPasswordsVerificador : IVerificadorSenhaVazada
{
    private readonly HttpClient _http;
    private readonly ILogger<PwnedPasswordsVerificador> _logger;

    public PwnedPasswordsVerificador(HttpClient http, ILogger<PwnedPasswordsVerificador> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<bool> EstaVazadaAsync(string senha, CancellationToken ct = default)
    {
        var sha1 = Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(PasswordPolicyService.Normalizar(senha))));
        var prefixo = sha1[..5];
        var sufixo = sha1[5..];
        try
        {
            using var resp = await _http.GetAsync($"range/{prefixo}", ct);
            resp.EnsureSuccessStatusCode();
            var corpo = await resp.Content.ReadAsStringAsync(ct);
            foreach (var linha in corpo.Split('\n'))
            {
                var partes = linha.Trim().Split(':');
                // Linhas de enchimento (padding) vêm com contagem 0 — não são vazamento.
                if (partes.Length == 2 && partes[0].Equals(sufixo, StringComparison.OrdinalIgnoreCase)
                    && int.TryParse(partes[1], out var vezes) && vezes > 0)
                    return true;
            }
            return false;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or OperationCanceledException)
        {
            // Nada da senha no log — só que a checagem não rodou.
            _logger.LogWarning("Pwned Passwords indisponível ({Erro}); senha aceita sem a checagem de vazamento.", ex.GetType().Name);
            return false;
        }
    }
}

/// <summary>Sem checagem externa (testes e ambiente sem internet: SENHA_VAZADA_CHECAGEM=off). A lista local continua.</summary>
public sealed class SemVerificacaoDeVazamento : IVerificadorSenhaVazada
{
    public static readonly SemVerificacaoDeVazamento Instancia = new();
    public Task<bool> EstaVazadaAsync(string senha, CancellationToken ct = default) => Task.FromResult(false);
}
