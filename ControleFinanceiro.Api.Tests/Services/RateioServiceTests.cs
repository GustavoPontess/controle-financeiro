using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class RateioServiceTests
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

    private static void AddMembro(AppDbContext ctx, Guid familiaId, Guid usuarioId, decimal? renda = null)
    {
        ctx.MembrosFamilia.Add(new MembroFamilia
        {
            Id = Guid.NewGuid(), FamiliaId = familiaId, UsuarioId = usuarioId,
            Papel = "Membro", EntrouEm = DateTime.UtcNow, Ativo = true, RendaMensal = renda,
        });
        ctx.SaveChanges();
    }

    private static Guid SeedDespesa(
        AppDbContext ctx, Guid criadoPor, decimal valor, Guid familiaId,
        ModoRateio? modo = null)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Despesa", Valor = valor,
            Tipo = TipoTransacao.Despesa, CriadoPor = criadoPor,
            Data = new DateOnly(2026, 5, 10), Ativo = true,
            StatusTransacao = StatusTransacao.Executado, FamiliaId = familiaId,
            ModoRateio = modo,
        };
        ctx.Transacoes.Add(t);
        ctx.SaveChanges();
        return t.Id;
    }

    // ── DefinirModoFamiliaAsync ──

    [Fact]
    public async Task DefinirModoFamiliaAsync_NaoMembro_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = new RateioService(ctx);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.DefinirModoFamiliaAsync(familiaId, Guid.NewGuid(), ModoRateio.Proporcional));
    }

    [Fact]
    public async Task DefinirModoFamiliaAsync_Valido_AtualizaModo()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = new RateioService(ctx);

        await svc.DefinirModoFamiliaAsync(familiaId, dono, ModoRateio.Proporcional);

        var familia = await ctx.Familias.FindAsync(familiaId);
        Assert.Equal(ModoRateio.Proporcional, familia!.ModoRateioPadrao);
    }

    // ── DefinirRendaAsync ──

    [Fact]
    public async Task DefinirRendaAsync_Negativa_LancaArgument()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var membroId = ctx.MembrosFamilia.First(m => m.FamiliaId == familiaId).Id;
        var svc = new RateioService(ctx);

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.DefinirRendaAsync(familiaId, membroId, dono, -1m));
    }

    [Fact]
    public async Task DefinirRendaAsync_Valida_AtualizaRenda()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var membroId = ctx.MembrosFamilia.First(m => m.FamiliaId == familiaId).Id;
        var svc = new RateioService(ctx);

        await svc.DefinirRendaAsync(familiaId, membroId, dono, 5000m);

        var membro = await ctx.MembrosFamilia.FindAsync(membroId);
        Assert.Equal(5000m, membro!.RendaMensal);
    }

    // ── DefinirRateioTransacaoAsync ──

    [Fact]
    public async Task DefinirRateioTransacaoAsync_NaoDono_LancaUnauthorized()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var txId = SeedDespesa(ctx, dono, 100m, familiaId);
        var svc = new RateioService(ctx);

        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.DefinirRateioTransacaoAsync(
                txId, Guid.NewGuid(), new DefinirRateioTransacaoDto(ModoRateio.Igualitario, null)));
    }

    [Fact]
    public async Task DefinirRateioTransacaoAsync_NaoCompartilhada_LancaInvalidOperation()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var tx = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Pessoal", Valor = 100m,
            Tipo = TipoTransacao.Despesa, CriadoPor = dono, Data = new DateOnly(2026, 5, 10),
            Ativo = true, StatusTransacao = StatusTransacao.Executado,
        };
        ctx.Transacoes.Add(tx);
        ctx.SaveChanges();
        var svc = new RateioService(ctx);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.DefinirRateioTransacaoAsync(
                tx.Id, dono, new DefinirRateioTransacaoDto(ModoRateio.Igualitario, null)));
    }

    [Fact]
    public async Task DefinirRateioTransacaoAsync_PersonalizadoSemItens_LancaArgument()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var txId = SeedDespesa(ctx, dono, 100m, familiaId);
        var svc = new RateioService(ctx);

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.DefinirRateioTransacaoAsync(
                txId, dono, new DefinirRateioTransacaoDto(ModoRateio.Personalizado, null)));
    }

    [Fact]
    public async Task DefinirRateioTransacaoAsync_PercentuaisNaoSomam100_LancaArgument()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var txId = SeedDespesa(ctx, dono, 100m, familiaId);
        var svc = new RateioService(ctx);

        var itens = new List<RateioItemDto> { new(dono, 70m) };

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.DefinirRateioTransacaoAsync(
                txId, dono, new DefinirRateioTransacaoDto(ModoRateio.Personalizado, itens)));
    }

    [Fact]
    public async Task DefinirRateioTransacaoAsync_MembroForaDaFamilia_LancaArgument()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var estranho = SeedUsuario(ctx, "estranho@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var txId = SeedDespesa(ctx, dono, 100m, familiaId);
        var svc = new RateioService(ctx);

        var itens = new List<RateioItemDto> { new(estranho, 100m) };

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.DefinirRateioTransacaoAsync(
                txId, dono, new DefinirRateioTransacaoDto(ModoRateio.Personalizado, itens)));
    }

    [Fact]
    public async Task DefinirRateioTransacaoAsync_Personalizado_PersisteItens()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        var txId = SeedDespesa(ctx, ana, 100m, familiaId);
        var svc = new RateioService(ctx);

        var itens = new List<RateioItemDto> { new(ana, 60m), new(bia, 40m) };
        await svc.DefinirRateioTransacaoAsync(
            txId, ana, new DefinirRateioTransacaoDto(ModoRateio.Personalizado, itens));

        var tx = await ctx.Transacoes.FindAsync(txId);
        Assert.Equal(ModoRateio.Personalizado, tx!.ModoRateio);
        Assert.Equal(2, ctx.RateiosTransacao.Count(r => r.TransacaoId == txId));
    }

    [Fact]
    public async Task RemoverRateioTransacaoAsync_LimpaModoEItens()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var txId = SeedDespesa(ctx, dono, 100m, familiaId, ModoRateio.Personalizado);
        ctx.RateiosTransacao.Add(new RateioTransacao
        {
            Id = Guid.NewGuid(), TransacaoId = txId, UsuarioId = dono, Percentual = 100m,
        });
        ctx.SaveChanges();
        var svc = new RateioService(ctx);

        await svc.RemoverRateioTransacaoAsync(txId, dono);

        var tx = await ctx.Transacoes.FindAsync(txId);
        Assert.Null(tx!.ModoRateio);
        Assert.Empty(ctx.RateiosTransacao.Where(r => r.TransacaoId == txId));
    }

    // ── Balanço por modo (DespesaCompartilhadaService) ──

    [Fact]
    public async Task ObterBalanco_Proporcional_DivideProporcionalARenda()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        // Ana é membro admin já criado; define renda dela e adiciona Bia.
        ctx.MembrosFamilia.First(m => m.UsuarioId == ana).RendaMensal = 3000m;
        ctx.SaveChanges();
        AddMembro(ctx, familiaId, bia, renda: 1000m);

        ctx.Familias.First(f => f.Id == familiaId).ModoRateioPadrao = ModoRateio.Proporcional;
        ctx.SaveChanges();

        SeedDespesa(ctx, ana, 400m, familiaId); // total 400, renda 3000+1000

        var balanco = await new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx))
            .ObterBalancoAsync(familiaId, ana, 5, 2026);

        var ax = balanco.Saldos.First(s => s.UsuarioId == ana);
        var bx = balanco.Saldos.First(s => s.UsuarioId == bia);
        Assert.Equal(300m, ax.Cota); // 400 * 3000/4000
        Assert.Equal(100m, bx.Cota); // 400 * 1000/4000
        Assert.Equal(100m, ax.Saldo); // pagou 400, cota 300
        Assert.Equal(-100m, bx.Saldo); // pagou 0, cota 100
    }

    [Fact]
    public async Task ObterBalanco_ProporcionalSemRenda_FazFallbackIgualitario()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        ctx.Familias.First(f => f.Id == familiaId).ModoRateioPadrao = ModoRateio.Proporcional;
        ctx.SaveChanges();

        SeedDespesa(ctx, ana, 200m, familiaId);

        var balanco = await new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx))
            .ObterBalancoAsync(familiaId, ana, 5, 2026);

        Assert.All(balanco.Saldos, s => Assert.Equal(100m, s.Cota)); // 200/2
    }

    [Fact]
    public async Task ObterBalanco_Personalizado_UsaPercentuaisDaDespesa()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);

        var txId = SeedDespesa(ctx, ana, 100m, familiaId, ModoRateio.Personalizado);
        ctx.RateiosTransacao.AddRange(
            new RateioTransacao { Id = Guid.NewGuid(), TransacaoId = txId, UsuarioId = ana, Percentual = 25m },
            new RateioTransacao { Id = Guid.NewGuid(), TransacaoId = txId, UsuarioId = bia, Percentual = 75m });
        ctx.SaveChanges();

        var balanco = await new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx))
            .ObterBalancoAsync(familiaId, ana, 5, 2026);

        Assert.Equal(25m, balanco.Saldos.First(s => s.UsuarioId == ana).Cota);
        Assert.Equal(75m, balanco.Saldos.First(s => s.UsuarioId == bia).Cota);
    }
}
