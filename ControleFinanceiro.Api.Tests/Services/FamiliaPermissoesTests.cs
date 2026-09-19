using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Feature 2.3 — gate de papéis de família. <see cref="FamiliaPermissoes"/> é a fonte
/// única de authz reutilizada por 6 services; foco em segurança: papel insuficiente
/// barrado (403), papel suficiente liberado, e membro de outra família barrado (404,
/// não vaza existência — isolamento multi-tenant).
/// </summary>
public class FamiliaPermissoesTests
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

    private static Guid SeedFamilia(AppDbContext ctx, Guid criadoPor, string nome = "Família Teste")
    {
        var f = new Familia { Id = Guid.NewGuid(), Nome = nome, CriadoPorUsuarioId = criadoPor };
        ctx.Familias.Add(f);
        ctx.SaveChanges();
        return f.Id;
    }

    /// <summary>Adiciona um membro (ativo por padrão) com o papel de permissão dado.</summary>
    private static void SeedMembro(
        AppDbContext ctx, Guid familiaId, Guid usuarioId, PapelFamilia papel, bool ativo = true)
    {
        ctx.MembrosFamilia.Add(new MembroFamilia
        {
            Id = Guid.NewGuid(),
            FamiliaId = familiaId,
            UsuarioId = usuarioId,
            Papel = papel.ToString(),
            PapelPermissao = papel,
            EntrouEm = DateTime.UtcNow,
            Ativo = ativo,
        });
        ctx.SaveChanges();
    }

    // ── ObterPapelAsync ──────────────────────────────────────────────────────

    [Fact]
    public async Task ObterPapelAsync_MembroAtivo_RetornaPapel()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = SeedFamilia(ctx, dono);
        SeedMembro(ctx, familiaId, dono, PapelFamilia.Admin);

        var papel = await FamiliaPermissoes.ObterPapelAsync(ctx, familiaId, dono);

        Assert.Equal(PapelFamilia.Admin, papel);
    }

    [Fact]
    public async Task ObterPapelAsync_NaoMembro_RetornaNull()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = SeedFamilia(ctx, dono);
        var estranho = SeedUsuario(ctx, "estranho@test.com");

        var papel = await FamiliaPermissoes.ObterPapelAsync(ctx, familiaId, estranho);

        Assert.Null(papel);
    }

    [Fact]
    public async Task ObterPapelAsync_MembroInativo_RetornaNull()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = SeedFamilia(ctx, dono);
        var removido = SeedUsuario(ctx, "removido@test.com");
        SeedMembro(ctx, familiaId, removido, PapelFamilia.Membro, ativo: false);

        var papel = await FamiliaPermissoes.ObterPapelAsync(ctx, familiaId, removido);

        Assert.Null(papel);
    }

    [Fact]
    public async Task ObterPapelAsync_MembroDeOutraFamilia_RetornaNull()
    {
        var ctx = CreateContext();
        var usuario = SeedUsuario(ctx, "usuario@test.com");
        var familiaA = SeedFamilia(ctx, usuario, "Família A");
        SeedMembro(ctx, familiaA, usuario, PapelFamilia.Admin);

        var outroDono = SeedUsuario(ctx, "outro@test.com");
        var familiaB = SeedFamilia(ctx, outroDono, "Família B");

        // Usuário é Admin da família A, mas não é membro da B — não deve vazar papel.
        var papel = await FamiliaPermissoes.ObterPapelAsync(ctx, familiaB, usuario);

        Assert.Null(papel);
    }

    // ── ExigirPapelAsync — caminho feliz (papel suficiente) ─────────────────

    [Fact]
    public async Task ExigirPapelAsync_PapelSuficiente_RetornaPapelEfetivo()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = SeedFamilia(ctx, dono);
        SeedMembro(ctx, familiaId, dono, PapelFamilia.Admin);

        var papel = await FamiliaPermissoes.ExigirPapelAsync(
            ctx, familiaId, dono, PapelFamilia.Membro);

        Assert.Equal(PapelFamilia.Admin, papel);
    }

    [Fact]
    public async Task ExigirPapelAsync_PapelExatamenteIgualAoMinimo_Passa()
    {
        var ctx = CreateContext();
        var uid = SeedUsuario(ctx, "membro@test.com");
        var familiaId = SeedFamilia(ctx, uid);
        SeedMembro(ctx, familiaId, uid, PapelFamilia.Membro);

        var papel = await FamiliaPermissoes.ExigirPapelAsync(
            ctx, familiaId, uid, PapelFamilia.Membro);

        Assert.Equal(PapelFamilia.Membro, papel);
    }

    [Fact]
    public async Task ExigirPapelAsync_AdminComValorDeEnumMenor_AindaTemMaisPoderQueDependente()
    {
        // Guarda de regressão: PapelFamilia.Admin = 1, Dependente = 3 (valores do enum
        // invertidos em relação ao poder). Se ExigirPapelAsync comparasse o valor bruto
        // do enum em vez de usar Poder(), um Admin seria barrado por um mínimo Dependente.
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = SeedFamilia(ctx, dono);
        SeedMembro(ctx, familiaId, dono, PapelFamilia.Admin);

        var papel = await FamiliaPermissoes.ExigirPapelAsync(
            ctx, familiaId, dono, PapelFamilia.Dependente);

        Assert.Equal(PapelFamilia.Admin, papel);
    }

    // ── ExigirPapelAsync — papel insuficiente (403) ─────────────────────────

    [Fact]
    public async Task ExigirPapelAsync_MembroExigindoAdmin_LancaForbidden()
    {
        var ctx = CreateContext();
        var uid = SeedUsuario(ctx, "membro@test.com");
        var familiaId = SeedFamilia(ctx, uid);
        SeedMembro(ctx, familiaId, uid, PapelFamilia.Membro);

        var ex = await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => FamiliaPermissoes.ExigirPapelAsync(ctx, familiaId, uid, PapelFamilia.Admin));

        Assert.Equal("Você não tem permissão para esta ação.", ex.Message);
    }

    [Fact]
    public async Task ExigirPapelAsync_DependenteExigindoMembro_LancaForbidden()
    {
        var ctx = CreateContext();
        var uid = SeedUsuario(ctx, "dependente@test.com");
        var familiaId = SeedFamilia(ctx, uid);
        SeedMembro(ctx, familiaId, uid, PapelFamilia.Dependente);

        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => FamiliaPermissoes.ExigirPapelAsync(ctx, familiaId, uid, PapelFamilia.Membro));
    }

    [Fact]
    public async Task ExigirPapelAsync_DependenteExigindoAdmin_LancaForbidden()
    {
        var ctx = CreateContext();
        var uid = SeedUsuario(ctx, "dependente@test.com");
        var familiaId = SeedFamilia(ctx, uid);
        SeedMembro(ctx, familiaId, uid, PapelFamilia.Dependente);

        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => FamiliaPermissoes.ExigirPapelAsync(ctx, familiaId, uid, PapelFamilia.Admin));
    }

    // ── ExigirPapelAsync — não membro / cross-tenant (404, não 403) ─────────

    [Fact]
    public async Task ExigirPapelAsync_NaoMembro_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = SeedFamilia(ctx, dono);
        var estranho = SeedUsuario(ctx, "estranho@test.com");

        var ex = await Assert.ThrowsAsync<KeyNotFoundException>(
            () => FamiliaPermissoes.ExigirPapelAsync(ctx, familiaId, estranho, PapelFamilia.Dependente));

        Assert.Equal("Família não encontrada.", ex.Message);
    }

    [Fact]
    public async Task ExigirPapelAsync_MembroInativo_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = SeedFamilia(ctx, dono);
        var removido = SeedUsuario(ctx, "removido@test.com");
        SeedMembro(ctx, familiaId, removido, PapelFamilia.Admin, ativo: false);

        // Membro removido (soft delete) não deve conseguir agir mesmo com papel salvo Admin.
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => FamiliaPermissoes.ExigirPapelAsync(ctx, familiaId, removido, PapelFamilia.Dependente));
    }

    [Fact]
    public async Task ExigirPapelAsync_MembroDeOutraFamilia_LancaKeyNotFound_NaoForbidden()
    {
        // Segurança (IDOR): usuário é Admin da família A, mas tenta agir na B, da qual
        // não participa. Deve virar "não encontrado" (não vaza existência da B) — nunca
        // ForbiddenAccessException, que confirmaria que a família B existe.
        var ctx = CreateContext();
        var usuario = SeedUsuario(ctx, "usuario@test.com");
        var familiaA = SeedFamilia(ctx, usuario, "Família A");
        SeedMembro(ctx, familiaA, usuario, PapelFamilia.Admin);

        var outroDono = SeedUsuario(ctx, "outro@test.com");
        var familiaB = SeedFamilia(ctx, outroDono, "Família B");
        SeedMembro(ctx, familiaB, outroDono, PapelFamilia.Admin);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => FamiliaPermissoes.ExigirPapelAsync(ctx, familiaB, usuario, PapelFamilia.Dependente));
    }

    [Fact]
    public async Task ExigirPapelAsync_FamiliaInexistente_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var uid = SeedUsuario(ctx, "usuario@test.com");

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => FamiliaPermissoes.ExigirPapelAsync(ctx, Guid.NewGuid(), uid, PapelFamilia.Dependente));
    }

    // ── ExigirMembroAsync (qualquer papel, inclusive Dependente) ────────────

    [Fact]
    public async Task ExigirMembroAsync_Dependente_Passa()
    {
        var ctx = CreateContext();
        var uid = SeedUsuario(ctx, "dependente@test.com");
        var familiaId = SeedFamilia(ctx, uid);
        SeedMembro(ctx, familiaId, uid, PapelFamilia.Dependente);

        var papel = await FamiliaPermissoes.ExigirMembroAsync(ctx, familiaId, uid);

        Assert.Equal(PapelFamilia.Dependente, papel);
    }

    [Fact]
    public async Task ExigirMembroAsync_Admin_Passa()
    {
        var ctx = CreateContext();
        var uid = SeedUsuario(ctx, "dono@test.com");
        var familiaId = SeedFamilia(ctx, uid);
        SeedMembro(ctx, familiaId, uid, PapelFamilia.Admin);

        var papel = await FamiliaPermissoes.ExigirMembroAsync(ctx, familiaId, uid);

        Assert.Equal(PapelFamilia.Admin, papel);
    }

    [Fact]
    public async Task ExigirMembroAsync_NaoMembro_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = SeedFamilia(ctx, dono);
        var estranho = SeedUsuario(ctx, "estranho@test.com");

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => FamiliaPermissoes.ExigirMembroAsync(ctx, familiaId, estranho));
    }
}
