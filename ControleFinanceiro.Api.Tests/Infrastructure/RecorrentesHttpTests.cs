using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Pipeline HTTP real do POST /recorrentes (criar conta fixa): a rota versionada exige o header
/// Idempotency-Key, e a mesma chave 2x cria uma conta fixa só (o retry recebe a original).
/// </summary>
// Mesma razão do [Collection] em AuthHttpTests: o login lê a env var global PASSWORD_PEPPER.
[Collection("PasswordHasherEnv")]
public class RecorrentesHttpTests : IClassFixture<CustomWebApplicationFactory>
{
    private const string Senha = "SenhaForte!2026";
    private readonly CustomWebApplicationFactory _factory;

    public RecorrentesHttpTests(CustomWebApplicationFactory factory) => _factory = factory;

    /// <summary>Usuário com uma conta corrente; devolve (usuário, conta).</summary>
    private (Guid UsuarioId, Guid ContaId) SeedUsuarioComConta(string email)
    {
        using var scope = _factory.CreateScopeComBanco();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var usuario = new Usuario
        {
            Id = Guid.NewGuid(), Email = email, Nome = "User Conta Fixa HTTP",
            PasswordHash = PasswordHasher.HashPassword(Senha), Status = StatusUsuario.Ativo, CriadoEm = DateTime.UtcNow,
        };
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Corrente", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuario.Id };
        ctx.AddRange(usuario, conta);
        ctx.SaveChanges();
        return (usuario.Id, conta.Id);
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

    private static HttpRequestMessage CriarRequest(Guid contaId, string csrf, string? chave)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/recorrentes")
        {
            Content = JsonContent.Create(new
            {
                descricao = "Internet", valor = 120m, tipo = (int)TipoTransacao.Despesa, contaId,
                frequencia = (int)FrequenciaRecorrencia.Mensal, dia = 10,
                dataInicio = DateTime.UtcNow.Date.AddDays(1),
            }),
        };
        req.Headers.Add("X-CSRF-Token", csrf);
        if (chave != null)
            req.Headers.Add("Idempotency-Key", chave);
        return req;
    }

    private int ContasFixas(Guid usuarioId)
    {
        using var scope = _factory.Services.CreateScope();
        return scope.ServiceProvider.GetRequiredService<AppDbContext>().Recorrentes.AsNoTracking().Count(r => r.CriadoPor == usuarioId);
    }

    [Fact]
    public async Task Criar_MesmaChaveDuasVezes_201NasDuas_MesmoId_ECriaUmaSo()
    {
        const string email = "conta-fixa-mesma-chave@test.com";
        var (usuarioId, contaId) = SeedUsuarioComConta(email);
        var (client, csrf) = await LoginClientAsync(email);
        var chave = Guid.NewGuid().ToString();

        var primeira = await client.SendAsync(CriarRequest(contaId, csrf, chave));
        var retry = await client.SendAsync(CriarRequest(contaId, csrf, chave));

        Assert.Equal(HttpStatusCode.Created, primeira.StatusCode);
        Assert.Equal(HttpStatusCode.Created, retry.StatusCode);
        var idPrimeira = JsonDocument.Parse(await primeira.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetGuid();
        var idRetry = JsonDocument.Parse(await retry.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetGuid();
        Assert.Equal(idPrimeira, idRetry);
        Assert.Equal(1, ContasFixas(usuarioId));
    }

    [Fact]
    public async Task Criar_SemChave_400_NaoCria()
    {
        const string email = "conta-fixa-sem-chave@test.com";
        var (usuarioId, contaId) = SeedUsuarioComConta(email);
        var (client, csrf) = await LoginClientAsync(email);

        var resp = await client.SendAsync(CriarRequest(contaId, csrf, chave: null));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Equal(0, ContasFixas(usuarioId));
    }
}
