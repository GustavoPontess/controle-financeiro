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
/// Pipeline HTTP real do POST /faturas/pagamentos/{id}/estornar: a rota versionada chega ao service com o
/// header Idempotency-Key, a mesma chave 2x estorna uma vez só, e o pagamento de outro usuário dá 404.
/// </summary>
// Mesma razão do [Collection] em AuthHttpTests: o login lê a env var global PASSWORD_PEPPER.
[Collection("PasswordHasherEnv")]
public class EstornoPagamentoHttpTests : IClassFixture<CustomWebApplicationFactory>
{
    private const string Senha = "SenhaForte!2026";
    private readonly CustomWebApplicationFactory _factory;

    public EstornoPagamentoHttpTests(CustomWebApplicationFactory factory) => _factory = factory;

    /// <summary>Usuário com uma fatura de 300 já paga por inteiro; devolve o id do pagamento.</summary>
    private (Guid PagamentoId, Guid FaturaId) SeedUsuarioComPagamento(string email)
    {
        using var scope = _factory.CreateScopeComBanco();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var usuario = new Usuario
        {
            Id = Guid.NewGuid(), Email = email, Nome = "User Estorno HTTP",
            PasswordHash = PasswordHasher.HashPassword(Senha), Status = StatusUsuario.Ativo, CriadoEm = DateTime.UtcNow,
        };
        var cartao = new CartaoCredito { Id = Guid.NewGuid(), Nome = "Nubank", TemCredito = true, LimiteTotal = 5000, CriadoPor = usuario.Id, Ativo = true };
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Corrente", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuario.Id };
        var fatura = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = cartao.Id, CriadoPor = usuario.Id, ValorPago = 300m,
            DataInicio = new DateTime(2025, 9, 1), DataFechamento = new DateTime(2025, 10, 1), DataVencimento = new DateTime(2025, 10, 8),
            EstadoCiclo = EstadoCicloFatura.Fechada, EstadoPagamento = EstadoPagamentoFatura.Pago, DataPagamentoTotal = new DateTime(2025, 10, 5),
        };
        var pagamento = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Pagamento fatura Nubank", Valor = 300m, Tipo = TipoTransacao.Despesa,
            ContaId = conta.Id, EhPagamentoFatura = true, FaturaPagaId = fatura.Id, Data = new DateOnly(2025, 10, 5), CriadoPor = usuario.Id,
        };
        ctx.AddRange(usuario, cartao, conta, fatura, pagamento, new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Compra", Valor = 300m, Tipo = TipoTransacao.Despesa, CartaoCreditoId = cartao.Id,
            FaturaId = fatura.Id, UsadoComoCredito = true, Data = new DateOnly(2025, 9, 15), CriadoPor = usuario.Id,
        });
        ctx.SaveChanges();
        return (pagamento.Id, fatura.Id);
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

    private static HttpRequestMessage EstornarRequest(Guid pagamentoId, string csrf, string? chave)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/faturas/pagamentos/{pagamentoId}/estornar")
        {
            Content = JsonContent.Create(new { motivo = "Paguei errado" }),
        };
        req.Headers.Add("X-CSRF-Token", csrf);
        if (chave != null)
            req.Headers.Add("Idempotency-Key", chave);
        return req;
    }

    private decimal ValorPago(Guid faturaId)
    {
        using var scope = _factory.Services.CreateScope();
        return scope.ServiceProvider.GetRequiredService<AppDbContext>().Faturas.AsNoTracking().Single(f => f.Id == faturaId).ValorPago;
    }

    [Fact]
    public async Task Estornar_MesmaChaveDuasVezes_200NasDuas_EEstornaUmaVez()
    {
        const string email = "estorno-mesma-chave@test.com";
        var (pagamentoId, faturaId) = SeedUsuarioComPagamento(email);
        var (client, csrf) = await LoginClientAsync(email);
        var chave = Guid.NewGuid().ToString();

        var primeira = await client.SendAsync(EstornarRequest(pagamentoId, csrf, chave));
        var retry = await client.SendAsync(EstornarRequest(pagamentoId, csrf, chave));

        Assert.Equal(HttpStatusCode.OK, primeira.StatusCode);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        var corpo = JsonDocument.Parse(await primeira.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(300m, corpo.GetProperty("restanteFatura").GetDecimal());
        Assert.Equal(0m, ValorPago(faturaId));
    }

    [Fact]
    public async Task Estornar_SemChave_400_NaoEstorna()
    {
        const string email = "estorno-sem-chave@test.com";
        var (pagamentoId, faturaId) = SeedUsuarioComPagamento(email);
        var (client, csrf) = await LoginClientAsync(email);

        var resp = await client.SendAsync(EstornarRequest(pagamentoId, csrf, chave: null));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Equal(300m, ValorPago(faturaId));
    }

    [Fact]
    public async Task Estornar_PagamentoDeOutroUsuario_404_NaoEstorna()
    {
        var (pagamentoAlheio, faturaAlheia) = SeedUsuarioComPagamento("estorno-dono@test.com");
        SeedUsuarioComPagamento("estorno-intruso@test.com");
        var (intruso, csrf) = await LoginClientAsync("estorno-intruso@test.com");

        var resp = await intruso.SendAsync(EstornarRequest(pagamentoAlheio, csrf, Guid.NewGuid().ToString()));

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
        Assert.Equal(300m, ValorPago(faturaAlheia));
    }
}
