using System.Net;

namespace ControleFinanceiro.Api.Infrastructure.Security;

/// <summary>
/// De quem a API aceita o cabeçalho X-Forwarded-For (o IP real de quem chamou): só de rede interna. São as faixas
/// privadas (RFC 1918, onde o Docker cria as redes dele), a própria máquina e as equivalentes em IPv6. Assim a rede do
/// kamal-proxy pode mudar sem configurar nada, e ninguém de fora finge outro IP pra escapar dos limites por IP.
/// </summary>
public static class ProxiesConfiaveis
{
    public static readonly IReadOnlyList<IPNetwork> Redes = new[]
    {
        IPNetwork.Parse("10.0.0.0/8"),
        IPNetwork.Parse("172.16.0.0/12"),
        IPNetwork.Parse("192.168.0.0/16"),
        IPNetwork.Parse("127.0.0.0/8"),
        IPNetwork.Parse("::1/128"),
        IPNetwork.Parse("fc00::/7"),
    };

    public static bool EhRedeInterna(IPAddress ip)
    {
        if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
        return Redes.Any(r => r.Contains(ip));
    }
}
