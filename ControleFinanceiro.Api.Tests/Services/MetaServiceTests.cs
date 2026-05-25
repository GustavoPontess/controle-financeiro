using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.DTOs.Meta;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class MetaServiceTests
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

    private static CriarMetaDto MetaDto(string nome = "Viagem", decimal alvo = 5000m,
        Guid? familiaId = null) =>
        new(nome, null, alvo, null, familiaId, null);

    // ── Criar ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CriarAsync_Valido_PersisteComValorAtualZero()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com", "User");
        var svc = new MetaService(ctx);

        var dto = await svc.CriarAsync(MetaDto("Casa", 100_000m), user);

        Assert.Equal("Casa", dto.Nome);
        Assert.Equal(100_000m, dto.ValorAlvo);
        Assert.Equal(0m, dto.ValorAtual);
        Assert.Equal(0m, dto.PercentualConcluido);
        Assert.False(dto.Concluida);
        Assert.Equal(user, dto.UsuarioId);
    }

    [Fact]
    public async Task CriarAsync_FamiliaIdSemMembro_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var estranho = SeedUsuario(ctx, "estranho@test.com");
        var svc = new MetaService(ctx);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.CriarAsync(MetaDto(familiaId: familiaId), estranho));
    }

    [Fact]
    public async Task CriarAsync_FamiliaIdMembro_Persiste()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = new MetaService(ctx);

        var dto = await svc.CriarAsync(MetaDto("Viagem", 3000m, familiaId), dono);

        Assert.Equal(familiaId, dto.FamiliaId);
    }

    // ── Listar ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListarAsync_RetornaPessoaisEFamiliares()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        ctx.MembrosFamilia.Add(new MembroFamilia
        {
            Id = Guid.NewGuid(), FamiliaId = familiaId, UsuarioId = bia,
            Papel = "Membro", EntrouEm = DateTime.UtcNow, Ativo = true,
        });
        ctx.SaveChanges();
        var svc = new MetaService(ctx);

        await svc.CriarAsync(MetaDto("Pessoal Ana"), ana);           // pessoal de Ana
        await svc.CriarAsync(MetaDto("Conjunta", familiaId: familiaId), ana); // conjunta

        // Bia deve ver a conjunta mas não a pessoal de Ana
        var listaBia = await svc.ListarAsync(bia);
        Assert.Single(listaBia);
        Assert.Equal("Conjunta", listaBia[0].Nome);

        // Ana vê as duas
        var listaAna = await svc.ListarAsync(ana);
        Assert.Equal(2, listaAna.Count);
    }

    [Fact]
    public async Task ListarAsync_NaoRetornaInativas()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var svc = new MetaService(ctx);

        var criada = await svc.CriarAsync(MetaDto(), user);
        await svc.ExcluirAsync(criada.Id, user);

        var lista = await svc.ListarAsync(user);
        Assert.Empty(lista);
    }

    // ── Atualizar ────────────────────────────────────────────────────────────

    [Fact]
    public async Task AtualizarAsync_Valido_AlteraDados()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var svc = new MetaService(ctx);
        var criada = await svc.CriarAsync(MetaDto("Velha", 1000m), user);

        var atualizada = await svc.AtualizarAsync(
            criada.Id, new CriarMetaDto("Nova", "desc", 2000m, null, null, null), user);

        Assert.Equal("Nova", atualizada.Nome);
        Assert.Equal(2000m, atualizada.ValorAlvo);
    }

    [Fact]
    public async Task AtualizarAsync_NaoCriador_LancaUnauthorized()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var outro = SeedUsuario(ctx, "outro@test.com");
        var svc = new MetaService(ctx);
        var criada = await svc.CriarAsync(MetaDto(), dono);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => svc.AtualizarAsync(criada.Id, MetaDto(), outro));
    }

    // ── Contribuir ───────────────────────────────────────────────────────────

    [Fact]
    public async Task ContribuirAsync_AcumulaValor()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var svc = new MetaService(ctx);
        var meta = await svc.CriarAsync(MetaDto("Viagem", 1000m), user);

        await svc.ContribuirAsync(meta.Id, new ContribuirMetaDto(300m), user);
        var result = await svc.ContribuirAsync(meta.Id, new ContribuirMetaDto(200m), user);

        Assert.Equal(500m, result.ValorAtual);
        Assert.Equal(50m, result.PercentualConcluido);
        Assert.False(result.Concluida);
    }

    [Fact]
    public async Task ContribuirAsync_AtingeAlvo_MarcaConcluida()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var svc = new MetaService(ctx);
        var meta = await svc.CriarAsync(MetaDto("Viagem", 500m), user);

        var result = await svc.ContribuirAsync(meta.Id, new ContribuirMetaDto(500m), user);

        Assert.Equal(100m, result.PercentualConcluido);
        Assert.True(result.Concluida);
    }

    [Fact]
    public async Task ContribuirAsync_ValorAtualNaoFicaNegativo()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var svc = new MetaService(ctx);
        var meta = await svc.CriarAsync(MetaDto("Viagem", 1000m), user);

        // Contribui 100, depois "retira" 500 — deve ficar em 0, não negativo
        await svc.ContribuirAsync(meta.Id, new ContribuirMetaDto(100m), user);
        var result = await svc.ContribuirAsync(meta.Id, new ContribuirMetaDto(-500m), user);

        Assert.Equal(0m, result.ValorAtual);
    }

    [Fact]
    public async Task ContribuirAsync_MembroFamiliaConsegue()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var bia = SeedUsuario(ctx, "bia@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        ctx.MembrosFamilia.Add(new MembroFamilia
        {
            Id = Guid.NewGuid(), FamiliaId = familiaId, UsuarioId = bia,
            Papel = "Membro", EntrouEm = DateTime.UtcNow, Ativo = true,
        });
        ctx.SaveChanges();
        var svc = new MetaService(ctx);
        var meta = await svc.CriarAsync(MetaDto("Conjunta", 1000m, familiaId), dono);

        // Bia contribui para meta da família
        var result = await svc.ContribuirAsync(meta.Id, new ContribuirMetaDto(400m), bia);

        Assert.Equal(400m, result.ValorAtual);
    }

    // ── Excluir (soft delete) ────────────────────────────────────────────────

    [Fact]
    public async Task ExcluirAsync_SoftDelete_PreservaRegistro()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var svc = new MetaService(ctx);
        var meta = await svc.CriarAsync(MetaDto(), user);

        await svc.ExcluirAsync(meta.Id, user);

        var registro = await ctx.Metas.FindAsync(meta.Id);
        Assert.NotNull(registro);
        Assert.False(registro!.Ativo);
    }

    [Fact]
    public async Task ExcluirAsync_NaoCriador_LancaUnauthorized()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var outro = SeedUsuario(ctx, "outro@test.com");
        var svc = new MetaService(ctx);
        var meta = await svc.CriarAsync(MetaDto(), dono);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => svc.ExcluirAsync(meta.Id, outro));
    }

    // ── Percentual ───────────────────────────────────────────────────────────

    [Fact]
    public async Task PercentualConcluido_CapadoEm100_QuandoUltrapassado()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var svc = new MetaService(ctx);
        var meta = await svc.CriarAsync(MetaDto("X", 100m), user);

        var result = await svc.ContribuirAsync(meta.Id, new ContribuirMetaDto(150m), user);

        Assert.Equal(100m, result.PercentualConcluido);
        Assert.True(result.Concluida);
    }
}
