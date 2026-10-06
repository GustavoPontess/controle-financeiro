using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Módulo C — LGPD (exportar + exclusão em 2 estágios + purga). Spec `docs/features/admin/spec.md` §5.
/// Cobre a LÓGICA: guardas (não-a-si, estados, confirmação de e-mail), recusa por vínculo, anonimização
/// do event log, preservação da auditoria, e o job de carência. A CASCADE física de FK (Conta→Transacoes,
/// etc.) é validada ao vivo contra Postgres — o provider InMemory não a força.
/// </summary>
public class AdminLgpdServiceTests
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

    private static AdminLgpdService CreateService(AppDbContext ctx) => new(ctx, new AdminAuditService(ctx), TestHelpers.NotifAdmin(ctx));

    private static Usuario SeedUsuario(AppDbContext ctx, StatusUsuario status = StatusUsuario.Ativo,
        DateTime? marcadoEm = null, string? email = null)
    {
        var u = new Usuario
        {
            Id = Guid.NewGuid(),
            Email = email ?? $"u{Guid.NewGuid():N}@test.com",
            Nome = "U",
            PasswordHash = "x",
            Status = status,
            MarcadoExclusaoEm = marcadoEm,
        };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u;
    }

    /// <summary>Semeia dados financeiros próprios (sem vínculo com terceiro) — conta "limpa".</summary>
    private static void SeedDadosFinanceiros(AppDbContext ctx, Guid usuarioId)
    {
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Conta", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuarioId };
        var cartao = new CartaoCredito { Id = Guid.NewGuid(), Nome = "Cartão", CriadoPor = usuarioId, Ativo = true };
        ctx.Contas.Add(conta);
        ctx.CartoesCredito.Add(cartao);
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "T", Valor = 10, Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DateTime.UtcNow), CriadoPor = usuarioId, CartaoCreditoId = cartao.Id,
        });
        ctx.FinancialEventLogs.Add(new FinancialEventLog
        {
            Id = Guid.NewGuid(), CriadoPor = usuarioId, Tipo = FinancialEventType.FaturaFechada,
            EntidadeAfetada = "Conta", EntidadeId = conta.Id, CorrelationId = Guid.NewGuid(), OrigemAcao = "API",
        });
        ctx.RefreshTokens.Add(new RefreshToken { Id = Guid.NewGuid(), UsuarioId = usuarioId, Token = Guid.NewGuid().ToString(), ExpiresAt = DateTime.UtcNow.AddDays(7) });
        ctx.SaveChanges();
    }

    // ── Exportar ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Exportar_incluiPerfilEDadosFinanceiros_eAudita()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        SeedDadosFinanceiros(ctx, u.Id);
        var svc = CreateService(ctx);

        var export = await svc.ExportarAsync(u.Id, Guid.NewGuid(), "admin@test.com");

        Assert.Equal(u.Email, export.Perfil.Email);
        Assert.Single(export.Contas);
        Assert.Single(export.Cartoes);
        Assert.Single(export.Transacoes);
        Assert.True(await ctx.AdminAuditLogs.AnyAsync(a => a.Acao == AcaoAdmin.ExportarDados && a.AlvoId == u.Id));
    }

    // ── Marcar / cancelar ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Marcar_naPropriaConta_403()
    {
        using var ctx = CreateContext();
        var admin = SeedUsuario(ctx);
        var svc = CreateService(ctx);
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => svc.MarcarExclusaoAsync(admin.Id, admin.Id, admin.Email));
    }

    [Fact]
    public async Task Marcar_pendente_409()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, StatusUsuario.AguardandoAprovacao);
        var svc = CreateService(ctx);
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.MarcarExclusaoAsync(u.Id, Guid.NewGuid(), "a@t.com"));
    }

    [Fact]
    public async Task Marcar_ativo_viraMarcado_carimbaData_derrubaSessoes_audita()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        SeedDadosFinanceiros(ctx, u.Id); // inclui um refresh token
        var svc = CreateService(ctx);

        var dto = await svc.MarcarExclusaoAsync(u.Id, Guid.NewGuid(), "admin@test.com");

        Assert.Equal(StatusUsuario.MarcadoParaExclusao, dto.Status);
        Assert.NotNull(dto.MarcadoExclusaoEm);
        Assert.False(await ctx.RefreshTokens.AnyAsync(t => t.UsuarioId == u.Id)); // sessões derrubadas
        Assert.True(await ctx.AdminAuditLogs.AnyAsync(a => a.Acao == AcaoAdmin.MarcarExclusao && a.AlvoId == u.Id));
    }

    [Fact]
    public async Task Cancelar_marcado_voltaAtivo_limpaData_audita()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, StatusUsuario.MarcadoParaExclusao, DateTime.UtcNow);
        var svc = CreateService(ctx);

        var dto = await svc.CancelarExclusaoAsync(u.Id, Guid.NewGuid(), "admin@test.com");

        Assert.Equal(StatusUsuario.Ativo, dto.Status);
        Assert.Null(dto.MarcadoExclusaoEm);
        Assert.True(await ctx.AdminAuditLogs.AnyAsync(a => a.Acao == AcaoAdmin.CancelarExclusao && a.AlvoId == u.Id));
    }

    [Fact]
    public async Task Cancelar_naoMarcado_409()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, StatusUsuario.Ativo);
        var svc = CreateService(ctx);
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.CancelarExclusaoAsync(u.Id, Guid.NewGuid(), "a@t.com"));
    }

    // ── Vínculos ────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task DetectarVinculos_contaLimpa_vazio()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        SeedDadosFinanceiros(ctx, u.Id);
        var svc = CreateService(ctx);
        Assert.Empty(await svc.DetectarVinculosAsync(u.Id));
    }

    [Fact]
    public async Task DetectarVinculos_comRateio_acusaVinculo()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var transacaoDeOutro = Guid.NewGuid();
        ctx.RateiosTransacao.Add(new RateioTransacao { Id = Guid.NewGuid(), TransacaoId = transacaoDeOutro, UsuarioId = u.Id, Percentual = 50 });
        ctx.SaveChanges();
        var svc = CreateService(ctx);

        var vinculos = await svc.DetectarVinculosAsync(u.Id);
        Assert.NotEmpty(vinculos);
    }

    // ── Purgar (guardas) ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Purgar_naPropriaConta_403()
    {
        using var ctx = CreateContext();
        var admin = SeedUsuario(ctx, StatusUsuario.MarcadoParaExclusao, DateTime.UtcNow);
        var svc = CreateService(ctx);
        await Assert.ThrowsAsync<ForbiddenAccessException>(() => svc.PurgarAsync(admin.Id, admin.Id, admin.Email, admin.Email));
    }

    [Fact]
    public async Task Purgar_naoMarcado_409()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, StatusUsuario.Ativo);
        var svc = CreateService(ctx);
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.PurgarAsync(u.Id, Guid.NewGuid(), "a@t.com", u.Email));
    }

    [Fact]
    public async Task Purgar_emailErrado_400()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, StatusUsuario.MarcadoParaExclusao, DateTime.UtcNow);
        var svc = CreateService(ctx);
        await Assert.ThrowsAsync<ArgumentException>(() => svc.PurgarAsync(u.Id, Guid.NewGuid(), "a@t.com", "errado@test.com"));
    }

    [Fact]
    public async Task Purgar_comVinculo_recusa_409_eNaoApaga()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, StatusUsuario.MarcadoParaExclusao, DateTime.UtcNow);
        ctx.RateiosTransacao.Add(new RateioTransacao { Id = Guid.NewGuid(), TransacaoId = Guid.NewGuid(), UsuarioId = u.Id, Percentual = 50 });
        ctx.SaveChanges();
        var svc = CreateService(ctx);

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.PurgarAsync(u.Id, Guid.NewGuid(), "admin@t.com", u.Email));
        Assert.True(await ctx.Usuarios.AnyAsync(x => x.Id == u.Id)); // continua lá
    }

    // ── Purgar (feliz) ────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Purgar_contaLimpa_apagaGrafo_anonimizaEventLog_preservaAuditoria()
    {
        using var ctx = CreateContext();
        var u = SeedUsuario(ctx, StatusUsuario.MarcadoParaExclusao, DateTime.UtcNow);
        SeedDadosFinanceiros(ctx, u.Id);
        var svc = CreateService(ctx);

        await svc.PurgarAsync(u.Id, Guid.NewGuid(), "admin@test.com", u.Email);

        Assert.False(await ctx.Usuarios.AnyAsync(x => x.Id == u.Id));                    // usuário apagado
        Assert.False(await ctx.CartoesCredito.AnyAsync(c => c.CriadoPor == u.Id));       // cartão apagado
        Assert.False(await ctx.Transacoes.IgnoreQueryFilters().AnyAsync(t => t.CriadoPor == u.Id)); // transações apagadas
        // Event log: retido, mas anonimizado (perdeu o vínculo com o usuário)
        Assert.False(await ctx.FinancialEventLogs.AnyAsync(e => e.CriadoPor == u.Id));
        Assert.True(await ctx.FinancialEventLogs.AnyAsync(e => e.CriadoPor == Guid.Empty));
        // Auditoria da purga preservada, com snapshot do e-mail
        Assert.True(await ctx.AdminAuditLogs.AnyAsync(a => a.Acao == AcaoAdmin.PurgarUsuario && a.AlvoDescricao == u.Email));
    }

    // ── Job de carência ───────────────────────────────────────────────────────────────────

    [Fact]
    public async Task PurgarExpiradas_purgaVencidaLimpa_pulaNaoVencida_e_pulaComVinculo()
    {
        using var ctx = CreateContext();
        var vencida = SeedUsuario(ctx, StatusUsuario.MarcadoParaExclusao, DateTime.UtcNow.AddDays(-31));
        var recente = SeedUsuario(ctx, StatusUsuario.MarcadoParaExclusao, DateTime.UtcNow.AddDays(-1));
        var vencidaComVinculo = SeedUsuario(ctx, StatusUsuario.MarcadoParaExclusao, DateTime.UtcNow.AddDays(-40));
        ctx.RateiosTransacao.Add(new RateioTransacao { Id = Guid.NewGuid(), TransacaoId = Guid.NewGuid(), UsuarioId = vencidaComVinculo.Id, Percentual = 50 });
        ctx.SaveChanges();
        var svc = CreateService(ctx);

        var purgadas = await svc.PurgarExpiradasAsync();

        Assert.Equal(1, purgadas);
        Assert.False(await ctx.Usuarios.AnyAsync(x => x.Id == vencida.Id));         // vencida limpa → apagada
        Assert.True(await ctx.Usuarios.AnyAsync(x => x.Id == recente.Id));          // dentro da carência → fica
        Assert.True(await ctx.Usuarios.AnyAsync(x => x.Id == vencidaComVinculo.Id)); // vencida mas com vínculo → fica
    }
}
