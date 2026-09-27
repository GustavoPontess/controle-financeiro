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
/// Pipeline HTTP real do POST /cartoes/{id}/faturas/{id}/pagar: prova que o header
/// Idempotency-Key chega do controller ao service (antes a doc prometia o header, mas nada o lia) —
/// sem chave → 400; mesma chave 2x → 204 duas vezes e um pagamento só. Banco InMemory via
/// CustomWebApplicationFactory.
/// </summary>
// Mesma razão do [Collection] em AuthHttpTests: o login lê a env var global PASSWORD_PEPPER.
[Collection("PasswordHasherEnv")]
public class FaturaPagarHttpTests : IClassFixture<CustomWebApplicationFactory>
{
    private const string Senha = "SenhaForte!2026";
    private readonly CustomWebApplicationFactory _factory;

    public FaturaPagarHttpTests(CustomWebApplicationFactory factory) => _factory = factory;

    private (Guid CartaoId, Guid FaturaId, Guid ContaId) SeedUsuarioComFatura(string email, decimal valorCompra)
    {
        using var scope = _factory.CreateScopeComBanco();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var usuario = new Usuario
        {
            Id = Guid.NewGuid(),
            Email = email,
            Nome = "User Pagar Fatura HTTP",
            PasswordHash = PasswordHasher.HashPassword(Senha),
            Status = StatusUsuario.Ativo,
            CriadoEm = DateTime.UtcNow,
        };
        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Nubank", TemCredito = true, LimiteTotal = 5000,
            CriadoPor = usuario.Id, Ativo = true,
        };
        var fatura = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = cartao.Id,
            DataInicio = DateTime.UtcNow.AddDays(-30), DataFechamento = DateTime.UtcNow,
            DataVencimento = DateTime.UtcNow.AddDays(10), CriadoPor = usuario.Id,
            EstadoCiclo = EstadoCicloFatura.Fechada, EstadoPagamento = EstadoPagamentoFatura.NaoPago,
        };
        var compra = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Compra", Valor = valorCompra, Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = cartao.Id, FaturaId = fatura.Id, UsadoComoCredito = true,
            Data = DateTime.UtcNow, CriadoPor = usuario.Id, Ativo = true,
        };
        var conta = new Conta
        {
            Id = Guid.NewGuid(), Nome = "Conta Corrente", Tipo = TipoConta.ContaCorrente,
            UsuarioIdProprietario = usuario.Id,
        };
        ctx.Usuarios.Add(usuario);
        ctx.CartoesCredito.Add(cartao);
        ctx.Faturas.Add(fatura);
        ctx.Transacoes.Add(compra);
        ctx.Contas.Add(conta);
        ctx.SaveChanges();
        return (cartao.Id, fatura.Id, conta.Id);
    }

    // Mesmo padrão de AutorizacaoHttpTests: client próprio (cookie container) + CSRF do login.
    private async Task<(HttpClient Client, string Csrf)> LoginClientAsync(string email)
    {
        var client = _factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = Senha });
        resp.EnsureSuccessStatusCode();
        string csrf = "";
        foreach (var sc in resp.Headers.GetValues("Set-Cookie"))
        {
            if (sc.StartsWith("X-CSRF-Token=", StringComparison.Ordinal))
                csrf = Uri.UnescapeDataString(sc.Substring("X-CSRF-Token=".Length).Split(';')[0]);
        }
        return (client, csrf);
    }

    private static HttpRequestMessage PagarRequest(
        Guid cartaoId, Guid faturaId, Guid contaId, decimal valor, string csrf, string? idempotencyKey)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/cartoes/{cartaoId}/faturas/{faturaId}/pagar")
        {
            Content = JsonContent.Create(new
            {
                contaId, valor, dataPagamento = DateTime.UtcNow, meioPagamento = (int)MeioPagamento.Pix,
            }),
        };
        req.Headers.Add("X-CSRF-Token", csrf);
        if (idempotencyKey != null)
            req.Headers.Add("Idempotency-Key", idempotencyKey);
        return req;
    }

    private (decimal ValorPago, int Pagamentos) EstadoDaFatura(Guid faturaId)
    {
        using var scope = _factory.Services.CreateScope();
        var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var valorPago = ctx.Faturas.AsNoTracking().Single(f => f.Id == faturaId).ValorPago;
        var pagamentos = ctx.Transacoes.Count(t => t.FaturaPagaId == faturaId);
        return (valorPago, pagamentos);
    }

    [Fact]
    public async Task Pagar_SemIdempotencyKey_Retorna400_ENaoPaga()
    {
        const string email = "pagar-sem-chave@test.com";
        var (cartaoId, faturaId, contaId) = SeedUsuarioComFatura(email, 300m);
        var (client, csrf) = await LoginClientAsync(email);

        var resp = await client.SendAsync(PagarRequest(cartaoId, faturaId, contaId, 100m, csrf, idempotencyKey: null));

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Contains("\"code\":\"VALIDATION_ERROR\"", await resp.Content.ReadAsStringAsync());
        Assert.Equal((0m, 0), EstadoDaFatura(faturaId));
    }

    [Fact]
    public async Task Pagar_MesmaIdempotencyKeyDuasVezes_Retorna204NasDuas_EPagaUmaVez()
    {
        const string email = "pagar-mesma-chave@test.com";
        var (cartaoId, faturaId, contaId) = SeedUsuarioComFatura(email, 300m);
        var (client, csrf) = await LoginClientAsync(email);
        var chave = Guid.NewGuid().ToString();

        var primeira = await client.SendAsync(PagarRequest(cartaoId, faturaId, contaId, 100m, csrf, chave));
        var retry = await client.SendAsync(PagarRequest(cartaoId, faturaId, contaId, 100m, csrf, chave));

        Assert.Equal(HttpStatusCode.NoContent, primeira.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, retry.StatusCode);
        Assert.Equal((100m, 1), EstadoDaFatura(faturaId));
    }
}
