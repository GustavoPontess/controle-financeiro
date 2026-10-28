using System.Net;
using ControleFinanceiro.Api.Infrastructure.Security;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>Atrás da Cloudflare, o IP real vem do CF-Connecting-IP, mas só quando quem entregou o pedido é a Cloudflare.</summary>
public class IpRealCloudflareTests
{
    private static HttpContext Pedido(string chegou, string? cf)
    {
        var ctx = new DefaultHttpContext();
        ctx.Connection.RemoteIpAddress = IPAddress.Parse(chegou);
        if (cf is not null) ctx.Request.Headers[IpRealCloudflare.Cabecalho] = cf;
        return ctx;
    }

    [Theory]
    [InlineData("173.245.48.10")]   // IPv4 da Cloudflare
    [InlineData("104.16.5.5")]
    [InlineData("2606:4700::1")]    // IPv6 da Cloudflare
    public void DaCloudflare_usaOCfConnectingIp(string cloudflare)
    {
        var ctx = Pedido(cloudflare, "200.150.10.20");
        IpRealCloudflare.Aplicar(ctx);
        Assert.Equal(IPAddress.Parse("200.150.10.20"), ctx.Connection.RemoteIpAddress);
    }

    [Fact]
    public void ForaDaCloudflare_ignoraOCabecalho_ninguemForjaOIp()
    {
        var ctx = Pedido("200.150.10.20", "1.2.3.4");
        IpRealCloudflare.Aplicar(ctx);
        Assert.Equal(IPAddress.Parse("200.150.10.20"), ctx.Connection.RemoteIpAddress);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("nao-e-ip")]
    public void DaCloudflare_semCabecalhoValido_ficaComoEsta(string? cf)
    {
        var ctx = Pedido("173.245.48.10", cf);
        IpRealCloudflare.Aplicar(ctx);
        Assert.Equal(IPAddress.Parse("173.245.48.10"), ctx.Connection.RemoteIpAddress);
    }

    [Fact]
    public void ListaDeFaixas_temIpv4EIpv6()
    {
        Assert.True(IpRealCloudflare.Faixas.Count >= 20);
        Assert.Contains(IpRealCloudflare.Faixas, f => f.BaseAddress.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork);
        Assert.Contains(IpRealCloudflare.Faixas, f => f.BaseAddress.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6);
        Assert.False(IpRealCloudflare.EhDaCloudflare(IPAddress.Parse("172.20.0.5"))); // o kamal-proxy não é Cloudflare
    }
}
