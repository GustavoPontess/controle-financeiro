using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Fila de aprovação do beta (Módulo A — spec `docs/features/admin/spec.md` §3): listar pendentes,
/// aprovar/recusar (só sobre pendentes, registrando quem/quando), e métricas.
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
        var svc = new AdminUsuarioService(ctx);

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
        var svc = new AdminUsuarioService(ctx);

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
        var svc = new AdminUsuarioService(ctx);

        await svc.RecusarAsync(pendente.Id, Guid.NewGuid());

        var db = await ctx.Usuarios.FindAsync(pendente.Id);
        Assert.Equal(StatusUsuario.Recusado, db!.Status);
    }

    [Fact]
    public async Task Aprovar_naoPendente_lancaInvalidOperation()
    {
        using var ctx = CreateContext();
        var jaAtivo = Seed(ctx, StatusUsuario.Ativo);
        var svc = new AdminUsuarioService(ctx);

        // Não deixa "reaprovar"/mexer em quem já saiu da fila (ativo/recusado/bloqueado).
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.AprovarAsync(jaAtivo.Id, Guid.NewGuid()));
    }

    [Fact]
    public async Task Aprovar_inexistente_lancaKeyNotFound()
    {
        using var ctx = CreateContext();
        var svc = new AdminUsuarioService(ctx);

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
        var svc = new AdminUsuarioService(ctx);

        var m = await svc.ObterMetricasAsync();

        Assert.Equal(5, m.Total);
        Assert.Equal(2, m.Pendentes);
        Assert.Equal(2, m.Ativos);
        Assert.Equal(1, m.Recusados);
        Assert.Equal(1, m.AtivosUltimos7Dias); // só o que logou há 1 dia
    }
}
