using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class FamiliaServiceTests
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

    private static Guid SeedUsuario(AppDbContext ctx, string email = "u@test.com", string nome = "User")
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = email, Nome = nome, PasswordHash = "x" };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u.Id;
    }

    /// <summary>Adiciona um membro ativo com o papel de permissão dado; retorna o usuarioId.</summary>
    private static Guid SeedMembro(AppDbContext ctx, Guid familiaId, string email, PapelFamilia papel)
    {
        var uid = SeedUsuario(ctx, email);
        ctx.MembrosFamilia.Add(new MembroFamilia
        {
            Id = Guid.NewGuid(), FamiliaId = familiaId, UsuarioId = uid,
            Papel = "Membro", PapelPermissao = papel, EntrouEm = DateTime.UtcNow, Ativo = true,
        });
        ctx.SaveChanges();
        return uid;
    }

    private static Guid MembroIdDe(AppDbContext ctx, Guid familiaId, Guid usuarioId) =>
        ctx.MembrosFamilia.First(m => m.FamiliaId == familiaId && m.UsuarioId == usuarioId).Id;

    [Fact]
    public async Task CriarAsync_CriaFamiliaComMembroAdmin()
    {
        var ctx = CreateContext();
        var svc = new FamiliaService(ctx);
        var uid = SeedUsuario(ctx);

        var result = await svc.CriarAsync(new CriarFamiliaDto("Família Teste"), uid);

        Assert.Equal("Família Teste", result.Nome);
        Assert.True(result.EhAdmin);
        Assert.Equal(1, result.TotalMembros);

        var membro = await ctx.MembrosFamilia.FirstAsync();
        Assert.Equal("Administrador", membro.Papel);
        Assert.Equal(uid, membro.UsuarioId);
    }

    [Fact]
    public async Task CriarAsync_NomeVazio_LancaArgumentException()
    {
        var ctx = CreateContext();
        var svc = new FamiliaService(ctx);

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.CriarAsync(new CriarFamiliaDto("  "), Guid.NewGuid()));
    }

    [Fact]
    public async Task ListarAsync_RetornaApenasFamiliasDoUsuario()
    {
        var ctx = CreateContext();
        var svc = new FamiliaService(ctx);
        var uid = SeedUsuario(ctx, "a@test.com");
        var outro = SeedUsuario(ctx, "b@test.com");

        await svc.CriarAsync(new CriarFamiliaDto("Minha"), uid);
        await svc.CriarAsync(new CriarFamiliaDto("Do Outro"), outro);

        var familias = await svc.ListarAsync(uid);

        Assert.Single(familias);
        Assert.Equal("Minha", familias[0].Nome);
    }

    [Fact]
    public async Task ObterDetalheAsync_NaoMembro_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var svc = new FamiliaService(ctx);
        var dono = SeedUsuario(ctx, "dono@test.com");
        var estranho = SeedUsuario(ctx, "estranho@test.com");

        var familia = await svc.CriarAsync(new CriarFamiliaDto("Privada"), dono);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.ObterDetalheAsync(familia.Id, estranho));
    }

    // Renda é dado pessoal: "o sistema sabe o peso, não o valor — só o próprio vê" (familia/visao.md).
    // Antes o detalhe devolvia a RendaMensal de todo mundo pra todo mundo (bug P1 2026-09-28).
    private static void DefinirRenda(AppDbContext ctx, Guid familiaId, Guid usuarioId, decimal? renda)
    {
        ctx.MembrosFamilia.First(m => m.FamiliaId == familiaId && m.UsuarioId == usuarioId).RendaMensal = renda;
        ctx.SaveChanges();
    }

    [Fact]
    public async Task ObterDetalheAsync_RendaDosOutros_NaoVemNemProAdmin_SoSeFoiInformada()
    {
        var ctx = CreateContext();
        var svc = new FamiliaService(ctx);
        var admin = SeedUsuario(ctx, "admin@test.com");
        var familia = await svc.CriarAsync(new CriarFamiliaDto("Casa"), admin);
        var ana = SeedMembro(ctx, familia.Id, "ana@test.com", PapelFamilia.Membro);
        var bia = SeedMembro(ctx, familia.Id, "bia@test.com", PapelFamilia.Membro);
        DefinirRenda(ctx, familia.Id, admin, 8000m);
        DefinirRenda(ctx, familia.Id, ana, 3000m);
        // bia não informou

        var visaoAdmin = await svc.ObterDetalheAsync(familia.Id, admin);

        var proprio = visaoAdmin.Membros.Single(m => m.UsuarioId == admin);
        Assert.Equal(8000m, proprio.RendaMensal);                       // a própria: vê o valor
        Assert.True(proprio.RendaInformada);
        var daAna = visaoAdmin.Membros.Single(m => m.UsuarioId == ana);
        Assert.Null(daAna.RendaMensal);                                 // a de outro: nem o admin vê
        Assert.True(daAna.RendaInformada);                              // só sabe que existe (o peso)
        var daBia = visaoAdmin.Membros.Single(m => m.UsuarioId == bia);
        Assert.Null(daBia.RendaMensal);
        Assert.False(daBia.RendaInformada);
    }

    [Fact]
    public async Task ObterDetalheAsync_CadaMembroVeSoAPropriaRenda()
    {
        var ctx = CreateContext();
        var svc = new FamiliaService(ctx);
        var admin = SeedUsuario(ctx, "admin@test.com");
        var familia = await svc.CriarAsync(new CriarFamiliaDto("Casa"), admin);
        var ana = SeedMembro(ctx, familia.Id, "ana@test.com", PapelFamilia.Membro);
        DefinirRenda(ctx, familia.Id, admin, 8000m);
        DefinirRenda(ctx, familia.Id, ana, 3000m);

        var visaoAna = await svc.ObterDetalheAsync(familia.Id, ana);

        Assert.Equal(3000m, visaoAna.Membros.Single(m => m.UsuarioId == ana).RendaMensal);
        Assert.Null(visaoAna.Membros.Single(m => m.UsuarioId == admin).RendaMensal);
        Assert.DoesNotContain(visaoAna.Membros, m => m.UsuarioId != ana && m.RendaMensal != null);
    }

    [Fact]
    public async Task EditarPapelEPermissao_AdminEditandoOutro_NaoDevolveARendaDele()
    {
        var ctx = CreateContext();
        var svc = new FamiliaService(ctx);
        var admin = SeedUsuario(ctx, "admin@test.com");
        var familia = await svc.CriarAsync(new CriarFamiliaDto("Casa"), admin);
        var ana = SeedMembro(ctx, familia.Id, "ana@test.com", PapelFamilia.Membro);
        DefinirRenda(ctx, familia.Id, ana, 3000m);
        var membroAna = MembroIdDe(ctx, familia.Id, ana);

        var aposPapel = await svc.EditarPapelAsync(familia.Id, membroAna, new EditarPapelDto("Esposa"), admin);
        var aposPermissao = await svc.EditarPermissaoAsync(familia.Id, membroAna, new EditarPermissaoDto(PapelFamilia.Admin), admin);

        Assert.Null(aposPapel.RendaMensal);
        Assert.True(aposPapel.RendaInformada);
        Assert.Null(aposPermissao.RendaMensal);
        Assert.True(aposPermissao.RendaInformada);
    }

    [Fact]
    public async Task DissolverAsync_NaoAdmin_LancaUnauthorized()
    {
        var ctx = CreateContext();
        var svc = new FamiliaService(ctx);
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familia = await svc.CriarAsync(new CriarFamiliaDto("F"), dono);

        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.DissolverAsync(familia.Id, Guid.NewGuid()));
    }

    [Fact]
    public async Task DissolverAsync_Admin_MarcaInativa()
    {
        var ctx = CreateContext();
        var svc = new FamiliaService(ctx);
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familia = await svc.CriarAsync(new CriarFamiliaDto("F"), dono);

        await svc.DissolverAsync(familia.Id, dono);

        var entidade = await ctx.Familias.FindAsync(familia.Id);
        Assert.False(entidade!.Ativa);
    }

    [Fact]
    public async Task RemoverMembroAsync_AdminTentaSair_LancaInvalidOperation()
    {
        var ctx = CreateContext();
        var svc = new FamiliaService(ctx);
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familia = await svc.CriarAsync(new CriarFamiliaDto("F"), dono);
        var membroAdmin = await ctx.MembrosFamilia.FirstAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.RemoverMembroAsync(familia.Id, membroAdmin.Id, dono));
    }

    // ── Feature 2.4 — limite de aprovação ──────────────────────────────────────

    [Fact]
    public async Task DefinirLimiteAprovacaoAsync_Admin_Persiste()
    {
        var ctx = CreateContext();
        var svc = new FamiliaService(ctx);
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familia = await svc.CriarAsync(new CriarFamiliaDto("F"), dono);

        await svc.DefinirLimiteAprovacaoAsync(familia.Id, dono, 250m);

        var entidade = await ctx.Familias.FindAsync(familia.Id);
        Assert.Equal(250m, entidade!.LimiteAprovacao);

        // Limpar (null) desliga a aprovação.
        await svc.DefinirLimiteAprovacaoAsync(familia.Id, dono, null);
        entidade = await ctx.Familias.FindAsync(familia.Id);
        Assert.Null(entidade!.LimiteAprovacao);
    }

    [Fact]
    public async Task DefinirLimiteAprovacaoAsync_MembroComum_LancaForbidden()
    {
        var ctx = CreateContext();
        var svc = new FamiliaService(ctx);
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familia = await svc.CriarAsync(new CriarFamiliaDto("F"), dono);
        var membro = SeedMembro(ctx, familia.Id, "membro@test.com", PapelFamilia.Membro);

        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.DefinirLimiteAprovacaoAsync(familia.Id, membro, 100m));
    }

    [Fact]
    public async Task DefinirLimiteAprovacaoAsync_NaoMembro_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var svc = new FamiliaService(ctx);
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familia = await svc.CriarAsync(new CriarFamiliaDto("F"), dono);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.DefinirLimiteAprovacaoAsync(familia.Id, Guid.NewGuid(), 100m));
    }

    // ── Feature 2.3 — papéis de permissão ──────────────────────────────────────

    [Fact]
    public async Task CriarAsync_CriadorEhAdmin()
    {
        var ctx = CreateContext();
        var svc = new FamiliaService(ctx);
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familia = await svc.CriarAsync(new CriarFamiliaDto("F"), dono);

        var membro = await ctx.MembrosFamilia.FirstAsync(m => m.UsuarioId == dono);
        Assert.Equal(PapelFamilia.Admin, membro.PapelPermissao);
        Assert.True(familia.EhAdmin);
    }

    [Fact]
    public async Task EditarPermissaoAsync_AdminPromoveMembro_ViraAdmin()
    {
        var ctx = CreateContext();
        var svc = new FamiliaService(ctx);
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familia = await svc.CriarAsync(new CriarFamiliaDto("F"), dono);
        var membro = SeedMembro(ctx, familia.Id, "membro@test.com", PapelFamilia.Membro);
        var membroId = MembroIdDe(ctx, familia.Id, membro);

        await svc.EditarPermissaoAsync(
            familia.Id, membroId, new EditarPermissaoDto(PapelFamilia.Admin), dono);

        var atualizado = await ctx.MembrosFamilia.FindAsync(membroId);
        Assert.Equal(PapelFamilia.Admin, atualizado!.PapelPermissao);
    }

    [Fact]
    public async Task EditarPermissaoAsync_MembroComum_LancaForbidden()
    {
        var ctx = CreateContext();
        var svc = new FamiliaService(ctx);
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familia = await svc.CriarAsync(new CriarFamiliaDto("F"), dono);
        var a = SeedMembro(ctx, familia.Id, "a@test.com", PapelFamilia.Membro);
        var b = SeedMembro(ctx, familia.Id, "b@test.com", PapelFamilia.Membro);
        var bId = MembroIdDe(ctx, familia.Id, b);

        // 'a' é membro comum → não pode promover ninguém.
        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.EditarPermissaoAsync(familia.Id, bId, new EditarPermissaoDto(PapelFamilia.Admin), a));
    }

    [Fact]
    public async Task EditarPermissaoAsync_NoCriador_LancaInvalidOperation()
    {
        var ctx = CreateContext();
        var svc = new FamiliaService(ctx);
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familia = await svc.CriarAsync(new CriarFamiliaDto("F"), dono);
        var donoMembroId = MembroIdDe(ctx, familia.Id, dono);

        // O dono é sempre Admin e não pode ser rebaixado, nem por si mesmo.
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.EditarPermissaoAsync(
                familia.Id, donoMembroId, new EditarPermissaoDto(PapelFamilia.Membro), dono));
    }

    [Fact]
    public async Task DefinirLimiteAprovacaoAsync_Negativo_LancaArgument()
    {
        var ctx = CreateContext();
        var svc = new FamiliaService(ctx);
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familia = await svc.CriarAsync(new CriarFamiliaDto("F"), dono);

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.DefinirLimiteAprovacaoAsync(familia.Id, dono, -1m));
    }
}
