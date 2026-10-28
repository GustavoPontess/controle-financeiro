using System.Net;
using System.Security.Claims;
using ControleFinanceiro.Api.Infrastructure.Security;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>Limite geral de uso da API: conta pela pessoa logada (ou pelo IP sem login), deixa /health de fora.</summary>
public class LimitesDeUsoTests
{
    private static HttpContext Pedido(string? usuarioId = null, string ip = "10.0.0.1", string caminho = "/api/v1/transacoes")
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Path = caminho;
        ctx.Connection.RemoteIpAddress = IPAddress.Parse(ip);
        if (usuarioId is not null)
            ctx.User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, usuarioId) }, "teste"));
        return ctx;
    }

    [Fact]
    public void Chave_logado_ehAPessoa_semLogin_ehOIp()
    {
        Assert.Equal("u:abc", LimitesDeUso.ChaveDoCliente(Pedido("abc", ip: "10.0.0.1")));
        Assert.Equal("u:abc", LimitesDeUso.ChaveDoCliente(Pedido("abc", ip: "10.9.9.9"))); // trocar de IP não muda a conta
        Assert.Equal("ip:10.0.0.1", LimitesDeUso.ChaveDoCliente(Pedido()));
    }

    [Fact]
    public void Logado_passaDoLimite_recusa_eOutraPessoaSegue()
    {
        using var limite = LimitesDeUso.Geral(dev: false);
        for (var i = 0; i < LimitesDeUso.PorMinutoLogado; i++)
            Assert.True(limite.AttemptAcquire(Pedido("ana")).IsAcquired);

        Assert.False(limite.AttemptAcquire(Pedido("ana")).IsAcquired);
        Assert.True(limite.AttemptAcquire(Pedido("bia")).IsAcquired); // cada pessoa tem o seu
    }

    [Fact]
    public void SemLogin_limiteMenor_porIp()
    {
        using var limite = LimitesDeUso.Geral(dev: false);
        for (var i = 0; i < LimitesDeUso.PorMinutoSemLogin; i++)
            Assert.True(limite.AttemptAcquire(Pedido(ip: "10.0.0.2")).IsAcquired);

        Assert.False(limite.AttemptAcquire(Pedido(ip: "10.0.0.2")).IsAcquired);
        Assert.True(limite.AttemptAcquire(Pedido(ip: "10.0.0.3")).IsAcquired);
    }

    [Fact]
    public void Health_ficaForaDoLimite()
    {
        using var limite = LimitesDeUso.Geral(dev: false);
        for (var i = 0; i < LimitesDeUso.PorMinutoSemLogin * 2; i++)
            Assert.True(limite.AttemptAcquire(Pedido(caminho: "/health")).IsAcquired);
    }
}
