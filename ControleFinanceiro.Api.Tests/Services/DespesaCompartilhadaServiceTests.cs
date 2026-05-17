using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class DespesaCompartilhadaServiceTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static Guid SeedUsuario(AppDbContext ctx, string email, string nome = "User")
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = email, Nome = nome, PasswordHash = "x" };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u.Id;
    }

    /// <summary>Cria família com o dono como admin e retorna o id da família.</summary>
    private static async Task<Guid> SeedFamilia(AppDbContext ctx, Guid donoId)
    {
        var familia = await new FamiliaService(ctx).CriarAsync(new CriarFamiliaDto("F"), donoId);
        return familia.Id;
    }

    private static void AddMembro(AppDbContext ctx, Guid familiaId, Guid usuarioId)
    {
        ctx.MembrosFamilia.Add(new MembroFamilia
        {
            Id = Guid.NewGuid(), FamiliaId = familiaId, UsuarioId = usuarioId,
            Papel = "Membro", EntrouEm = DateTime.UtcNow, Ativo = true,
        });
        ctx.SaveChanges();
    }

    private static Guid SeedTransacao(
        AppDbContext ctx, Guid criadoPor, decimal valor,
        TipoTransacao tipo = TipoTransacao.Despesa, Guid? familiaId = null)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Despesa", Valor = valor, Tipo = tipo,
            CriadoPor = criadoPor, Data = new DateTime(2026, 5, 10),
            Ativo = true, StatusTransacao = StatusTransacao.Executado, FamiliaId = familiaId,
        };
        ctx.Transacoes.Add(t);
        ctx.SaveChanges();
        return t.Id;
    }

    [Fact]
    public async Task CompartilharAsync_NaoDono_LancaUnauthorized()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var txId = SeedTransacao(ctx, dono, 100m);
        var svc = new DespesaCompartilhadaService(ctx);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => svc.CompartilharAsync(txId, familiaId, Guid.NewGuid()));
    }

    [Fact]
    public async Task CompartilharAsync_Receita_LancaInvalidOperation()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var txId = SeedTransacao(ctx, dono, 100m, TipoTransacao.Receita);
        var svc = new DespesaCompartilhadaService(ctx);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CompartilharAsync(txId, familiaId, dono));
    }

    [Fact]
    public async Task CompartilharAsync_NaoMembro_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var estranho = SeedUsuario(ctx, "estranho@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var txId = SeedTransacao(ctx, estranho, 100m);
        var svc = new DespesaCompartilhadaService(ctx);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.CompartilharAsync(txId, familiaId, estranho));
    }

    [Fact]
    public async Task CompartilharAsync_Valido_DefineFamiliaId()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var txId = SeedTransacao(ctx, dono, 100m);
        var svc = new DespesaCompartilhadaService(ctx);

        await svc.CompartilharAsync(txId, familiaId, dono);

        var tx = await ctx.Transacoes.FindAsync(txId);
        Assert.Equal(familiaId, tx!.FamiliaId);
    }

    [Fact]
    public async Task DescompartilharAsync_Valido_LimpaFamiliaId()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var txId = SeedTransacao(ctx, dono, 100m, TipoTransacao.Despesa, familiaId);
        var svc = new DespesaCompartilhadaService(ctx);

        await svc.DescompartilharAsync(txId, dono);

        var tx = await ctx.Transacoes.FindAsync(txId);
        Assert.Null(tx!.FamiliaId);
    }

    [Fact]
    public async Task ListarDespesasAsync_NaoMembro_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = new DespesaCompartilhadaService(ctx);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.ListarDespesasAsync(familiaId, Guid.NewGuid(), 5, 2026));
    }

    [Fact]
    public async Task ObterBalancoAsync_DivideIgualEntreMembros()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);

        SeedTransacao(ctx, ana, 300m, TipoTransacao.Despesa, familiaId);
        SeedTransacao(ctx, bia, 100m, TipoTransacao.Despesa, familiaId);

        var svc = new DespesaCompartilhadaService(ctx);
        var balanco = await svc.ObterBalancoAsync(familiaId, ana, 5, 2026);

        Assert.Equal(400m, balanco.Total);
        Assert.Equal(200m, balanco.Cota);

        var saldoAna = balanco.Saldos.First(s => s.UsuarioId == ana);
        var saldoBia = balanco.Saldos.First(s => s.UsuarioId == bia);
        Assert.Equal(300m, saldoAna.Pagou);
        Assert.Equal(100m, saldoAna.Saldo);   // pagou 300, cota 200
        Assert.Equal(-100m, saldoBia.Saldo);  // pagou 100, cota 200
    }
}
