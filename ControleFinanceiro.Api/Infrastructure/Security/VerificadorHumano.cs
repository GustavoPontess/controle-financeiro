using System.Text.Json;

namespace ControleFinanceiro.Api.Infrastructure.Security;

/// <summary>
/// "Não sou robô" (Cloudflare Turnstile). O widget roda no navegador e devolve um token; o servidor SEMPRE confere o
/// token na Cloudflare (o token pode ser forjado no navegador). Vale 5 min e só uma vez.
/// Ligado por <c>TURNSTILE_SECRET</c> + <c>TURNSTILE_SITE_KEY</c>; sem eles (dev, testes) fica desligado e tudo passa.
/// </summary>
public interface IVerificadorHumano
{
    bool Ligado { get; }

    /// <summary>Chave pública do widget (vai pro front). Null quando desligado.</summary>
    string? ChaveDoSite { get; }

    Task<bool> ConfereAsync(string? token, string? ip, CancellationToken ct = default);
}

public sealed record TurnstileOpcoes(string Segredo, string ChaveDoSite);

/// <summary>
/// Confere o token no siteverify da Cloudflare. Fora do ar, lento ou resposta estranha: NÃO passa (fail-closed). Só
/// quem já errou a senha, quem pede acesso e quem pede senha nova dependem dele; o login de primeira não.
/// </summary>
public sealed class TurnstileVerificador : IVerificadorHumano
{
    public const int TamanhoMaximoToken = 2048;
    private readonly HttpClient _http;
    private readonly TurnstileOpcoes _opcoes;
    private readonly ILogger<TurnstileVerificador> _logger;

    public TurnstileVerificador(HttpClient http, TurnstileOpcoes opcoes, ILogger<TurnstileVerificador> logger)
    {
        _http = http;
        _opcoes = opcoes;
        _logger = logger;
    }

    public bool Ligado => true;
    public string? ChaveDoSite => _opcoes.ChaveDoSite;

    public async Task<bool> ConfereAsync(string? token, string? ip, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > TamanhoMaximoToken) return false;
        var campos = new Dictionary<string, string> { ["secret"] = _opcoes.Segredo, ["response"] = token };
        if (!string.IsNullOrEmpty(ip)) campos["remoteip"] = ip;
        try
        {
            using var resp = await _http.PostAsync("turnstile/v0/siteverify", new FormUrlEncodedContent(campos), ct);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Turnstile respondeu {Status}; verificação recusada.", (int)resp.StatusCode);
                return false;
            }
            using var json = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
            var ok = json.RootElement.TryGetProperty("success", out var s) && s.ValueKind == JsonValueKind.True;
            if (!ok) _logger.LogInformation("Turnstile recusou um token.");
            return ok;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or OperationCanceledException or JsonException)
        {
            _logger.LogWarning("Turnstile indisponível ({Erro}); verificação recusada.", ex.GetType().Name);
            return false;
        }
    }
}

/// <summary>Sem as chaves (dev, testes): verificação desligada, tudo passa e o front não mostra o widget.</summary>
public sealed class SemVerificacaoHumana : IVerificadorHumano
{
    public static readonly SemVerificacaoHumana Instancia = new();
    public bool Ligado => false;
    public string? ChaveDoSite => null;
    public Task<bool> ConfereAsync(string? token, string? ip, CancellationToken ct = default) => Task.FromResult(true);
}
