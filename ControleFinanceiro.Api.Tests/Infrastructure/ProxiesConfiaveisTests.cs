using System.Net;
using ControleFinanceiro.Api.Infrastructure.Security;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>Só rede interna pode dizer o IP do cliente. A rede do kamal-proxy (hoje 172.20.0.5) pode mudar sem quebrar.</summary>
public class ProxiesConfiaveisTests
{
    [Theory]
    [InlineData("172.20.0.5")]      // kamal-proxy hoje (rede Docker "kamal")
    [InlineData("172.31.255.1")]    // outra rede Docker qualquer
    [InlineData("10.0.3.7")]
    [InlineData("192.168.1.10")]
    [InlineData("127.0.0.1")]       // proxy do vite no dev
    [InlineData("::1")]
    [InlineData("::ffff:172.20.0.5")]
    public void RedeInterna_podeDizerOIp(string ip) => Assert.True(ProxiesConfiaveis.EhRedeInterna(IPAddress.Parse(ip)));

    [Theory]
    [InlineData("1.2.3.4")]
    [InlineData("8.8.8.8")]
    [InlineData("172.32.0.1")]      // fora do 172.16/12
    [InlineData("2804:14c::1")]     // IPv6 público
    public void Internet_naoPode(string ip) => Assert.False(ProxiesConfiaveis.EhRedeInterna(IPAddress.Parse(ip)));
}
