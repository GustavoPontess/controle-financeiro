using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class ConviteServiceTests
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

    [Fact]
    public async Task CriarAsync_NaoAdmin_LancaUnauthorized()
    {
        var ctx = CreateContext();
        var familiaSvc = new FamiliaService(ctx);
        var conviteSvc = new ConviteService(ctx, TestHelpers.Notif(ctx));
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familia = await familiaSvc.CriarAsync(new CriarFamiliaDto("F"), dono);

        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => conviteSvc.CriarAsync(familia.Id, new CriarConviteDto("x@test.com", "Filho"), Guid.NewGuid()));
    }

    [Fact]
    public async Task CriarAsync_Valido_GeraConvitePendenteComToken()
    {
        var ctx = CreateContext();
        var familiaSvc = new FamiliaService(ctx);
        var conviteSvc = new ConviteService(ctx, TestHelpers.Notif(ctx));
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familia = await familiaSvc.CriarAsync(new CriarFamiliaDto("F"), dono);

        var convite = await conviteSvc.CriarAsync(
            familia.Id, new CriarConviteDto("Novo@Test.com", "Filho"), dono);

        Assert.Equal(StatusConvite.Pendente, convite.Status);
        Assert.False(string.IsNullOrEmpty(convite.Token));
        Assert.Equal("novo@test.com", convite.EmailConvidado); // normalizado
    }

    [Fact]
    public async Task CriarAsync_ConviteDuplicado_LancaInvalidOperation()
    {
        var ctx = CreateContext();
        var familiaSvc = new FamiliaService(ctx);
        var conviteSvc = new ConviteService(ctx, TestHelpers.Notif(ctx));
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familia = await familiaSvc.CriarAsync(new CriarFamiliaDto("F"), dono);

        await conviteSvc.CriarAsync(familia.Id, new CriarConviteDto("x@test.com", "Filho"), dono);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => conviteSvc.CriarAsync(familia.Id, new CriarConviteDto("x@test.com", "Filha"), dono));
    }

    [Fact]
    public async Task AceitarAsync_EmailDiferente_LancaUnauthorized()
    {
        var ctx = CreateContext();
        var familiaSvc = new FamiliaService(ctx);
        var conviteSvc = new ConviteService(ctx, TestHelpers.Notif(ctx));
        var dono = SeedUsuario(ctx, "dono@test.com");
        var outro = SeedUsuario(ctx, "outro@test.com");
        var familia = await familiaSvc.CriarAsync(new CriarFamiliaDto("F"), dono);
        var convite = await conviteSvc.CriarAsync(
            familia.Id, new CriarConviteDto("convidado@test.com", "Filho"), dono);

        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => conviteSvc.AceitarAsync(convite.Token, outro));
    }

    [Fact]
    public async Task AceitarAsync_Valido_CriaMembroEMarcaAceito()
    {
        var ctx = CreateContext();
        var familiaSvc = new FamiliaService(ctx);
        var conviteSvc = new ConviteService(ctx, TestHelpers.Notif(ctx));
        var dono = SeedUsuario(ctx, "dono@test.com");
        var convidado = SeedUsuario(ctx, "convidado@test.com");
        var familia = await familiaSvc.CriarAsync(new CriarFamiliaDto("F"), dono);
        var convite = await conviteSvc.CriarAsync(
            familia.Id, new CriarConviteDto("convidado@test.com", "Filho"), dono);

        await conviteSvc.AceitarAsync(convite.Token, convidado);

        var membro = await ctx.MembrosFamilia
            .FirstAsync(m => m.UsuarioId == convidado && m.FamiliaId == familia.Id);
        Assert.True(membro.Ativo);
        Assert.Equal("Filho", membro.Papel);

        var conviteDb = await ctx.ConvitesFamilia.FindAsync(convite.Id);
        Assert.Equal(StatusConvite.Aceito, conviteDb!.Status);
    }

    [Fact]
    public async Task RecusarAsync_Valido_MarcaRecusado()
    {
        var ctx = CreateContext();
        var familiaSvc = new FamiliaService(ctx);
        var conviteSvc = new ConviteService(ctx, TestHelpers.Notif(ctx));
        var dono = SeedUsuario(ctx, "dono@test.com");
        var convidado = SeedUsuario(ctx, "convidado@test.com");
        var familia = await familiaSvc.CriarAsync(new CriarFamiliaDto("F"), dono);
        var convite = await conviteSvc.CriarAsync(
            familia.Id, new CriarConviteDto("convidado@test.com", "Filho"), dono);

        await conviteSvc.RecusarAsync(convite.Token, convidado);

        var conviteDb = await ctx.ConvitesFamilia.FindAsync(convite.Id);
        Assert.Equal(StatusConvite.Recusado, conviteDb!.Status);
    }

    [Fact]
    public async Task RevogarAsync_Valido_MarcaRevogado()
    {
        var ctx = CreateContext();
        var familiaSvc = new FamiliaService(ctx);
        var conviteSvc = new ConviteService(ctx, TestHelpers.Notif(ctx));
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familia = await familiaSvc.CriarAsync(new CriarFamiliaDto("F"), dono);
        var convite = await conviteSvc.CriarAsync(
            familia.Id, new CriarConviteDto("x@test.com", "Filho"), dono);

        await conviteSvc.RevogarAsync(familia.Id, convite.Id, dono);

        var conviteDb = await ctx.ConvitesFamilia.FindAsync(convite.Id);
        Assert.Equal(StatusConvite.Revogado, conviteDb!.Status);
    }
}
