using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class AcertoServiceTests
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

    private static void AddMembro(AppDbContext ctx, Guid familiaId, Guid usuarioId)
    {
        ctx.MembrosFamilia.Add(new MembroFamilia
        {
            Id = Guid.NewGuid(), FamiliaId = familiaId, UsuarioId = usuarioId,
            Papel = "Membro", EntrouEm = DateTime.UtcNow, Ativo = true,
        });
        ctx.SaveChanges();
    }

    private static Guid SeedDespesa(AppDbContext ctx, Guid criadoPor, decimal valor, Guid familiaId)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Despesa", Valor = valor,
            Tipo = TipoTransacao.Despesa, CriadoPor = criadoPor,
            Data = new DateTime(2026, 5, 10), Ativo = true,
            StatusTransacao = StatusTransacao.Executado, FamiliaId = familiaId,
        };
        ctx.Transacoes.Add(t);
        ctx.SaveChanges();
        return t.Id;
    }

    [Fact]
    public async Task RegistrarAsync_NaoMembro_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = new AcertoService(ctx, TestHelpers.Notif(ctx));

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.RegistrarAsync(familiaId, Guid.NewGuid(),
                new RegistrarAcertoDto(dono, dono, 100m, null, null, null)));
    }

    [Fact]
    public async Task RegistrarAsync_MesmoPagadorRecebedor_LancaArgument()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = new AcertoService(ctx, TestHelpers.Notif(ctx));

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.RegistrarAsync(familiaId, dono,
                new RegistrarAcertoDto(dono, dono, 100m, null, null, null)));
    }

    [Fact]
    public async Task RegistrarAsync_ValorZero_LancaArgument()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        var svc = new AcertoService(ctx, TestHelpers.Notif(ctx));

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.RegistrarAsync(familiaId, ana,
                new RegistrarAcertoDto(ana, bia, 0m, null, null, null)));
    }

    [Fact]
    public async Task RegistrarAsync_RecebedorNaoMembro_LancaArgument()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var estranho = SeedUsuario(ctx, "estranho@test.com", "Estranho");
        var familiaId = await SeedFamilia(ctx, ana);
        var svc = new AcertoService(ctx, TestHelpers.Notif(ctx));

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.RegistrarAsync(familiaId, ana,
                new RegistrarAcertoDto(ana, estranho, 100m, null, null, null)));
    }

    [Fact]
    public async Task RegistrarAsync_Valido_PersisteComMesAnoCorrente()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        var svc = new AcertoService(ctx, TestHelpers.Notif(ctx));

        var dto = await svc.RegistrarAsync(familiaId, ana,
            new RegistrarAcertoDto(ana, bia, 150m, null, null, "PIX"));

        Assert.Equal(150m, dto.Valor);
        Assert.Equal("Ana", dto.DeNome);
        Assert.Equal("Bia", dto.ParaNome);
        Assert.Equal(DateTime.UtcNow.Month, dto.Mes);
        Assert.Equal(DateTime.UtcNow.Year, dto.Ano);
    }

    [Fact]
    public async Task ListarAsync_FiltraPorMesAno_ESomenteAtivos()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        var svc = new AcertoService(ctx, TestHelpers.Notif(ctx));

        await svc.RegistrarAsync(familiaId, ana, new RegistrarAcertoDto(ana, bia, 10m, 5, 2026, null));
        await svc.RegistrarAsync(familiaId, ana, new RegistrarAcertoDto(ana, bia, 20m, 4, 2026, null));

        var maio = await svc.ListarAsync(familiaId, ana, 5, 2026);

        Assert.Single(maio);
        Assert.Equal(10m, maio[0].Valor);
    }

    [Fact]
    public async Task CancelarAsync_SoftDelete_RemoveDaListagem()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        var svc = new AcertoService(ctx, TestHelpers.Notif(ctx));

        var acerto = await svc.RegistrarAsync(
            familiaId, ana, new RegistrarAcertoDto(ana, bia, 10m, 5, 2026, null));

        await svc.CancelarAsync(familiaId, acerto.Id, ana);

        Assert.Empty(await svc.ListarAsync(familiaId, ana, 5, 2026));
        var registro = await ctx.AcertosContas.FindAsync(acerto.Id);
        Assert.NotNull(registro);
        Assert.False(registro!.Ativo);
    }

    [Fact]
    public async Task ObterBalanco_AcertoAbateSaldoDoMes()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);

        // Ana pagou 200, igualitário: cota 100 cada. Bia deve 100 a Ana.
        SeedDespesa(ctx, ana, 200m, familiaId);

        var acertoSvc = new AcertoService(ctx, TestHelpers.Notif(ctx));
        // Bia paga os 100 que devia a Ana.
        await acertoSvc.RegistrarAsync(
            familiaId, ana, new RegistrarAcertoDto(bia, ana, 100m, 5, 2026, null));

        var balanco = await new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx))
            .ObterBalancoAsync(familiaId, ana, 5, 2026);

        // Após o acerto, ambos os saldos vão a zero.
        Assert.Equal(0m, balanco.Saldos.First(s => s.UsuarioId == ana).Saldo);
        Assert.Equal(0m, balanco.Saldos.First(s => s.UsuarioId == bia).Saldo);
    }
}
