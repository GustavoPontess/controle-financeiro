using System.Net;
using Microsoft.AspNetCore.Http;

namespace ControleFinanceiro.Api.Infrastructure.Security;

/// <summary>
/// IP real de quem chamou quando o site estiver atrás da Cloudflare (decisão do Gustavo, 2026-10-28).
///
/// Caminho do pedido: pessoa → Cloudflare → kamal-proxy → API. O kamal-proxy põe no X-Forwarded-For o IP de quem
/// conectou NELE, e a API já lê esse valor (ForwardedHeaders, só de rede interna: <see cref="ProxiesConfiaveis"/>). Com a
/// Cloudflare ligada, esse IP passa a ser um IP DA CLOUDFLARE, e todo mundo pareceria vir dos mesmos poucos IPs (o limite
/// de login viraria um só pra milhares de pessoas). A Cloudflare manda o IP real no cabeçalho CF-Connecting-IP.
///
/// Regra: só quando o IP que chegou é da Cloudflare (faixas oficiais abaixo) é que o CF-Connecting-IP vale. Vindo de
/// qualquer outro lugar, o cabeçalho é ignorado: senão qualquer um diria o IP que quisesse. Antes da Cloudflare ligar,
/// nenhum pedido vem dessas faixas, então isto não muda nada.
/// </summary>
public static class IpRealCloudflare
{
    /// <summary>
    /// Faixas oficiais da Cloudflare. Fonte: https://www.cloudflare.com/ips-v4 e https://www.cloudflare.com/ips-v6,
    /// conferidas em 2026-10-28. Mudam raramente; se a Cloudflare anunciar faixa nova, atualizar aqui (o teste
    /// <c>IpRealCloudflareTests</c> confere que a lista não está vazia nem malformada).
    /// </summary>
    public static readonly IReadOnlyList<IPNetwork> Faixas = new[]
    {
        "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18",
        "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17",
        "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
        "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32",
        "2a06:98c0::/29", "2c0f:f248::/32",
    }.Select(IPNetwork.Parse).ToArray();

    public const string Cabecalho = "CF-Connecting-IP";

    public static bool EhDaCloudflare(IPAddress ip)
    {
        if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
        return Faixas.Any(f => f.Contains(ip));
    }

    /// <summary>Troca o IP do pedido pelo CF-Connecting-IP, só se quem entregou o pedido é a Cloudflare.</summary>
    public static void Aplicar(HttpContext ctx)
    {
        var chegou = ctx.Connection.RemoteIpAddress;
        if (chegou is null || !EhDaCloudflare(chegou)) return;
        var valor = ctx.Request.Headers[Cabecalho].FirstOrDefault()?.Trim();
        if (string.IsNullOrEmpty(valor) || !IPAddress.TryParse(valor, out var real)) return;
        ctx.Connection.RemoteIpAddress = real;
    }
}
