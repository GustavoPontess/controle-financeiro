using System.Net;
using System.Net.Http.Json;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Pipeline HTTP real do POST /transferencias: o JSON do front ("data": "yyyy-MM-dd", "hora": "HH:mm:ss")
/// chega como dia + hora nas duas pernas, e data futura dá 400 sem gravar nada.
/// </summary>
// Mesma razão do [Collection] em AuthHttpTests: o login lê a env var global PASSWORD_PEPPER.
[Collection("PasswordHasherEnv")]
public class TransferenciasHttpTests : IClassFixture<CustomWebApplicationFactory>
{
    private const string Senha = "SenhaForte!2026";
    private readonly CustomWebApplicationFactory _factory;

    public TransferenciasHttpTests(CustomWebApplicationFactory factory) => _factory = factory;

    /// <summary>Usuário com duas contas; devolve (usuário, origem, destino).</summary>
    private (Guid UsuarioId, Guid OrigemId, Guid DestinoId) SeedUsuarioComContas(string email)
    {
        using var scope = _factory.CreateScopeComBanco();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var usuario = new Usuario
        {
            Id = Guid.NewGuid(), Email = email, Nome = "User Transferência HTTP",
            PasswordHash = PasswordHasher.HashPassword(Senha), Status = StatusUsuario.Ativo, CriadoEm = DateTime.UtcNow,
        };
        var origem = new Conta { Id = Guid.NewGuid(), Nome = "Corrente", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuario.Id };
        var destino = new Conta { Id = Guid.NewGuid(), Nome = "Reserva", Tipo = TipoConta.ContaPoupanca, UsuarioIdProprietario = usuario.Id };
        ctx.AddRange(usuario, origem, destino);
        ctx.SaveChanges();
        return (usuario.Id, origem.Id, destino.Id);
    }

    private async Task<(HttpClient Client, string Csrf)> LoginClientAsync(string email)
    {
        var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = Senha });
        resp.EnsureSuccessStatusCode();
        string csrf = "";
        foreach (var sc in resp.Headers.GetValues("Set-Cookie"))
            if (sc.StartsWith("X-CSRF-Token=", StringComparison.Ordinal))
                csrf = Uri.UnescapeDataString(sc.Substring("X-CSRF-Token=".Length).Split(';')[0]);
        return (client, csrf);
    }

    private static HttpRequestMessage CriarRequest(Guid origemId, Guid destinoId, string csrf, string data, string? hora)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/transferencias")
        {
            Content = JsonContent.Create(new { contaOrigemId = origemId, contaDestinoId = destinoId, valor = 200m, data, hora, descricao = "" }),
        };
        req.Headers.Add("X-CSRF-Token", csrf);
        return req;
    }

    private List<Transacao> Pernas(Guid usuarioId)
    {
        using var scope = _factory.Services.CreateScope();
        return scope.ServiceProvider.GetRequiredService<AppDbContext>().Transacoes.AsNoTracking()
            .Where(t => t.CriadoPor == usuarioId && t.EhTransferencia).ToList();
    }

    [Fact]
    public async Task Criar_ComDataEHora_201_EAsDuasPernasGuardamAHora()
    {
        const string email = "transferencia-hora@test.com";
        var (usuarioId, origemId, destinoId) = SeedUsuarioComContas(email);
        var (client, csrf) = await LoginClientAsync(email);
        var ontem = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));

        var resp = await client.SendAsync(CriarRequest(origemId, destinoId, csrf, ontem.ToString("yyyy-MM-dd"), "21:40:00"));

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var pernas = Pernas(usuarioId);
        Assert.Equal(2, pernas.Count);
        Assert.All(pernas, t =>
        {
            Assert.Equal(ontem, t.Data);
            Assert.Equal(new TimeOnly(21, 40), t.Hora);
        });
    }

    [Fact]
    public async Task Criar_DataFutura_400_NaoGrava()
    {
        const string email = "transferencia-futura@test.com";
        var (usuarioId, origemId, destinoId) = SeedUsuarioComContas(email);
        var (client, csrf) = await LoginClientAsync(email);
        var depois = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3));

        var resp = await client.SendAsync(CriarRequest(origemId, destinoId, csrf, depois.ToString("yyyy-MM-dd"), "10:00:00"));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Empty(Pernas(usuarioId));
    }
}
