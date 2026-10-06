using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class DependenteServiceTests
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

    private static async Task<Guid> SeedFamilia(AppDbContext ctx, Guid donoId)
    {
        var familia = await new FamiliaService(ctx).CriarAsync(new CriarFamiliaDto("F"), donoId);
        return familia.Id;
    }

    private static Guid SeedTransacao(
        AppDbContext ctx, Guid criadoPor, decimal valor,
        TipoTransacao tipo = TipoTransacao.Despesa,
        Guid? dependenteId = null, DateTime? data = null)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Despesa", Valor = valor, Tipo = tipo,
            CriadoPor = criadoPor, Data = DateOnly.FromDateTime(data ?? new DateTime(2026, 5, 10)),
            Ativo = true, StatusTransacao = StatusTransacao.Executado, DependenteId = dependenteId,
        };
        ctx.Transacoes.Add(t);
        ctx.SaveChanges();
        return t.Id;
    }

    private static CriarDependenteDto NovoDep(string nome = "Filho") =>
        new(nome, null, null, TipoDependente.Crianca);

    [Fact]
    public async Task CriarAsync_NaoMembro_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = new DependenteService(ctx);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.CriarAsync(familiaId, Guid.NewGuid(), NovoDep()));
    }

    [Fact]
    public async Task CriarAsync_Valido_PersisteAtivo()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = new DependenteService(ctx);

        var dto = await svc.CriarAsync(familiaId, dono, NovoDep("Pet"));

        Assert.True(dto.Ativo);
        Assert.Equal("Pet", dto.Nome);
        Assert.Equal(familiaId, dto.FamiliaId);
    }

    [Fact]
    public async Task ListarAsync_RetornaApenasAtivos()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = new DependenteService(ctx);

        var d1 = await svc.CriarAsync(familiaId, dono, NovoDep("Ativo"));
        await svc.CriarAsync(familiaId, dono, NovoDep("Inativo"));
        await svc.InativarAsync(familiaId,
            (await svc.ListarAsync(familiaId, dono)).First(x => x.Nome == "Inativo").Id, dono);

        var lista = await svc.ListarAsync(familiaId, dono);

        Assert.Single(lista);
        Assert.Equal(d1.Id, lista[0].Id);
    }

    [Fact]
    public async Task InativarAsync_NaoRemove_PreservaRegistro()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = new DependenteService(ctx);
        var dep = await svc.CriarAsync(familiaId, dono, NovoDep());

        await svc.InativarAsync(familiaId, dep.Id, dono);

        var registro = await ctx.Dependentes.FindAsync(dep.Id);
        Assert.NotNull(registro);
        Assert.False(registro!.Ativo);
    }

    [Fact]
    public async Task AtribuirAsync_Receita_LancaInvalidOperation()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = new DependenteService(ctx);
        var dep = await svc.CriarAsync(familiaId, dono, NovoDep());
        var txId = SeedTransacao(ctx, dono, 100m, TipoTransacao.Receita);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.AtribuirAsync(txId, dono, dep.Id));
    }

    [Fact]
    public async Task AtribuirAsync_NaoDono_LancaUnauthorized()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = new DependenteService(ctx);
        var dep = await svc.CriarAsync(familiaId, dono, NovoDep());
        var txId = SeedTransacao(ctx, dono, 100m);

        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.AtribuirAsync(txId, Guid.NewGuid(), dep.Id));
    }

    [Fact]
    public async Task AtribuirAsync_DonoNaoMembroDaFamiliaDoDependente_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var estranho = SeedUsuario(ctx, "estranho@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = new DependenteService(ctx);
        var dep = await svc.CriarAsync(familiaId, dono, NovoDep());
        var txId = SeedTransacao(ctx, estranho, 100m);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.AtribuirAsync(txId, estranho, dep.Id));
    }

    [Fact]
    public async Task AtribuirAsync_Valido_DefineDependenteId()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = new DependenteService(ctx);
        var dep = await svc.CriarAsync(familiaId, dono, NovoDep());
        var txId = SeedTransacao(ctx, dono, 100m);

        await svc.AtribuirAsync(txId, dono, dep.Id);

        var tx = await ctx.Transacoes.FindAsync(txId);
        Assert.Equal(dep.Id, tx!.DependenteId);
    }

    [Fact]
    public async Task AtribuirAsync_Null_LimpaDependenteId()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = new DependenteService(ctx);
        var dep = await svc.CriarAsync(familiaId, dono, NovoDep());
        var txId = SeedTransacao(ctx, dono, 100m, TipoTransacao.Despesa, dep.Id);

        await svc.AtribuirAsync(txId, dono, null);

        var tx = await ctx.Transacoes.FindAsync(txId);
        Assert.Null(tx!.DependenteId);
    }

    [Fact]
    public async Task ObterGastoAsync_SomaApenasDespesasDoMes()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = new DependenteService(ctx);
        var dep = await svc.CriarAsync(familiaId, dono, NovoDep());

        SeedTransacao(ctx, dono, 100m, TipoTransacao.Despesa, dep.Id, new DateTime(2026, 5, 3));
        SeedTransacao(ctx, dono, 50m, TipoTransacao.Despesa, dep.Id, new DateTime(2026, 5, 20));
        SeedTransacao(ctx, dono, 999m, TipoTransacao.Despesa, dep.Id, new DateTime(2026, 4, 10));

        var gasto = await svc.ObterGastoAsync(familiaId, dep.Id, dono, 5, 2026);

        Assert.Equal(150m, gasto.Total);
        Assert.Equal(dep.Id, gasto.DependenteId);
    }
}
