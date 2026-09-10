using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Admin sobre usuários — Módulo A (fila: pendentes/aprovar/recusar/métricas) e Módulo B
/// (gestão: listar, bloquear/reativar, forçar reset). Spec `docs/features/admin/spec.md` §3-§4.
/// </summary>
public class AdminUsuarioServiceTests
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

    private static AdminUsuarioService CreateService(AppDbContext ctx, IPasswordResetDispatcher? dispatcher = null)
        => new(ctx, dispatcher ?? new Mock<IPasswordResetDispatcher>().Object);

    private static Usuario Seed(AppDbContext ctx, StatusUsuario status, string? email = null, DateTime? criadoEm = null)
    {
        var u = new Usuario
        {
            Id = Guid.NewGuid(),
            Email = email ?? $"u{Guid.NewGuid():N}@test.com",
            Nome = "U",
            PasswordHash = "x",
            Status = status,
            CriadoEm = criadoEm ?? DateTime.UtcNow,
        };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u;
    }

    [Fact]
    public async Task ListarPendentes_retornaSoPendentes_maisAntigosPrimeiro()
    {
        using var ctx = CreateContext();
        var antigo = Seed(ctx, StatusUsuario.AguardandoAprovacao, "antigo@test.com", DateTime.UtcNow.AddHours(-2));
        var novo = Seed(ctx, StatusUsuario.AguardandoAprovacao, "novo@test.com", DateTime.UtcNow.AddHours(-1));
        Seed(ctx, StatusUsuario.Ativo, "ativo@test.com");
        Seed(ctx, StatusUsuario.Recusado, "recusado@test.com");
        var svc = CreateService(ctx);

        var pendentes = await svc.ListarPendentesAsync();

        Assert.Equal(2, pendentes.Count);
        Assert.Equal(antigo.Id, pendentes[0].Id); // ordem de chegada
        Assert.Equal(novo.Id, pendentes[1].Id);
    }

    [Fact]
    public async Task Aprovar_pendente_viraAtivo_e_registraQuemEQuando()
    {
        using var ctx = CreateContext();
        var pendente = Seed(ctx, StatusUsuario.AguardandoAprovacao);
        var adminId = Guid.NewGuid();
        var svc = CreateService(ctx);

        var dto = await svc.AprovarAsync(pendente.Id, adminId);

        Assert.Equal(StatusUsuario.Ativo, dto.Status);
        var db = await ctx.Usuarios.FindAsync(pendente.Id);
        Assert.Equal(StatusUsuario.Ativo, db!.Status);
        Assert.Equal(adminId, db.AprovadoPor);
        Assert.NotNull(db.AprovadoEm);
    }

    [Fact]
    public async Task Recusar_pendente_viraRecusado()
    {
        using var ctx = CreateContext();
        var pendente = Seed(ctx, StatusUsuario.AguardandoAprovacao);
        var svc = CreateService(ctx);

        await svc.RecusarAsync(pendente.Id, Guid.NewGuid());

        var db = await ctx.Usuarios.FindAsync(pendente.Id);
        Assert.Equal(StatusUsuario.Recusado, db!.Status);
    }

    [Fact]
    public async Task Aprovar_naoPendente_lancaInvalidOperation()
    {
        using var ctx = CreateContext();
        var jaAtivo = Seed(ctx, StatusUsuario.Ativo);
        var svc = CreateService(ctx);

        // Não deixa "reaprovar"/mexer em quem já saiu da fila (ativo/recusado/bloqueado).
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.AprovarAsync(jaAtivo.Id, Guid.NewGuid()));
    }

    [Fact]
    public async Task Aprovar_inexistente_lancaKeyNotFound()
    {
        using var ctx = CreateContext();
        var svc = CreateService(ctx);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.AprovarAsync(Guid.NewGuid(), Guid.NewGuid()));
    }

    [Fact]
    public async Task Metricas_contaPorStatus_e_recentes()
    {
        using var ctx = CreateContext();
        Seed(ctx, StatusUsuario.AguardandoAprovacao);
        Seed(ctx, StatusUsuario.AguardandoAprovacao);
        var ativoRecente = Seed(ctx, StatusUsuario.Ativo);
        ativoRecente.UltimoAcessoEm = DateTime.UtcNow.AddDays(-1);
        var ativoAntigo = Seed(ctx, StatusUsuario.Ativo);
        ativoAntigo.UltimoAcessoEm = DateTime.UtcNow.AddDays(-30);
        Seed(ctx, StatusUsuario.Recusado);
        await ctx.SaveChangesAsync();
        var svc = CreateService(ctx);

        var m = await svc.ObterMetricasAsync();

        Assert.Equal(5, m.Total);
        Assert.Equal(2, m.Pendentes);
        Assert.Equal(2, m.Ativos);
        Assert.Equal(1, m.Recusados);
        Assert.Equal(1, m.AtivosUltimos7Dias); // só o que logou há 1 dia
    }

    // ── Módulo B — gestão de usuários ─────────────────────────────────────────────

    [Fact]
    public async Task ListarUsuarios_retornaTodos_maisRecentesPrimeiro()
    {
        using var ctx = CreateContext();
        Seed(ctx, StatusUsuario.Ativo, "a@test.com", DateTime.UtcNow.AddHours(-2));
        Seed(ctx, StatusUsuario.Bloqueado, "b@test.com", DateTime.UtcNow.AddHours(-1));
        Seed(ctx, StatusUsuario.AguardandoAprovacao, "c@test.com", DateTime.UtcNow);
        var svc = CreateService(ctx);

        var todos = await svc.ListarUsuariosAsync();

        Assert.Equal(3, todos.Count);
        Assert.Equal("c@test.com", todos[0].Email); // mais recente primeiro
    }

    [Fact]
    public async Task ListarUsuarios_filtraPorBusca()
    {
        using var ctx = CreateContext();
        Seed(ctx, StatusUsuario.Ativo, "gustavo@test.com");
        Seed(ctx, StatusUsuario.Ativo, "outro@test.com");
        var svc = CreateService(ctx);

        var r = await svc.ListarUsuariosAsync("GUSTAVO");

        Assert.Single(r);
        Assert.Equal("gustavo@test.com", r[0].Email);
    }

    [Fact]
    public async Task Bloquear_usuarioAtivo_viraBloqueado()
    {
        using var ctx = CreateContext();
        var u = Seed(ctx, StatusUsuario.Ativo);
        var svc = CreateService(ctx);

        var dto = await svc.BloquearAsync(u.Id, Guid.NewGuid());

        Assert.Equal(StatusUsuario.Bloqueado, dto.Status);
        Assert.Equal(StatusUsuario.Bloqueado, (await ctx.Usuarios.FindAsync(u.Id))!.Status);
    }

    [Fact]
    public async Task Bloquear_aPropriaConta_lancaForbidden()
    {
        using var ctx = CreateContext();
        var admin = Seed(ctx, StatusUsuario.Ativo);
        var svc = CreateService(ctx);

        // §0.6 — admin não bloqueia a si mesmo (evita lockout).
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => svc.BloquearAsync(admin.Id, admin.Id));
    }

    [Fact]
    public async Task Bloquear_naoAtivo_lancaInvalidOperation()
    {
        using var ctx = CreateContext();
        var pendente = Seed(ctx, StatusUsuario.AguardandoAprovacao);
        var svc = CreateService(ctx);

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.BloquearAsync(pendente.Id, Guid.NewGuid()));
    }

    [Fact]
    public async Task Reativar_bloqueado_viraAtivo()
    {
        using var ctx = CreateContext();
        var u = Seed(ctx, StatusUsuario.Bloqueado);
        var svc = CreateService(ctx);

        var dto = await svc.ReativarAsync(u.Id, Guid.NewGuid());

        Assert.Equal(StatusUsuario.Ativo, dto.Status);
    }

    [Fact]
    public async Task Reativar_naoBloqueado_lancaInvalidOperation()
    {
        using var ctx = CreateContext();
        var ativo = Seed(ctx, StatusUsuario.Ativo);
        var svc = CreateService(ctx);

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.ReativarAsync(ativo.Id, Guid.NewGuid()));
    }

    [Fact]
    public async Task ForcarReset_usuarioAtivo_disparaOEmail()
    {
        using var ctx = CreateContext();
        var u = Seed(ctx, StatusUsuario.Ativo, "reset@test.com");
        var dispatcher = new Mock<IPasswordResetDispatcher>();
        var svc = CreateService(ctx, dispatcher.Object);

        await svc.ForcarResetSenhaAsync(u.Id);

        dispatcher.Verify(d => d.Disparar("reset@test.com"), Times.Once);
    }

    [Fact]
    public async Task ForcarReset_naoAtivo_lancaInvalidOperation_e_naoDispara()
    {
        using var ctx = CreateContext();
        var bloqueado = Seed(ctx, StatusUsuario.Bloqueado);
        var dispatcher = new Mock<IPasswordResetDispatcher>();
        var svc = CreateService(ctx, dispatcher.Object);

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.ForcarResetSenhaAsync(bloqueado.Id));
        dispatcher.Verify(d => d.Disparar(It.IsAny<string>()), Times.Never);
    }
}
