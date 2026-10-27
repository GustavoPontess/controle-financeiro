using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Autoatendimento de exclusão da própria conta (step-up: senha + 2º fator; soft-delete + carência).
/// Foca o caminho SEM MFA (PIN por e-mail) — cobre soft-delete, derrubada de sessão, auditoria e aviso —
/// e as guardas (senha errada = 400, código errado, conta não-ativa). A validação do 2º fator MFA em
/// si é coberta por MfaServiceTests.
/// </summary>
[Collection("PasswordHasherEnv")]
public class MinhaContaServiceTests
{
    private sealed class SenderSpy : IContaEmailSender
    {
        public Task EnviarPedidoRecebidoAsync(string email, CancellationToken ct = default) => Task.CompletedTask;
        public Task EnviarAcessoLiberadoAsync(string email, CancellationToken ct = default) => Task.CompletedTask;
        public string? UltimoCodigo;
        public int Avisos;
        public Task EnviarCodigoAsync(string email, string codigo, TipoOtpEmail finalidade, DateTime expiraEm, CancellationToken ct = default)
        { UltimoCodigo = codigo; return Task.CompletedTask; }
        public Task EnviarAvisoExclusaoAsync(string email, DateTime marcadoEm, int diasCarencia, CancellationToken ct = default)
        { Avisos++; return Task.CompletedTask; }
    }

    private const string Senha = "SenhaBemForte2026!";

    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static MinhaContaService Create(AppDbContext ctx, SenderSpy sender) =>
        new(ctx, new EmailOtpService(ctx, sender), new MfaService(ctx), new AdminAuditService(ctx), sender,
            new AdminLgpdService(ctx, new AdminAuditService(ctx), TestHelpers.NotifAdmin(ctx)));

    private static Usuario Seed(AppDbContext ctx, bool mfa = false, StatusUsuario status = StatusUsuario.Ativo)
    {
        var u = new Usuario
        {
            Id = Guid.NewGuid(), Email = "titular@test.com", Nome = "Titular",
            PasswordHash = PasswordHasher.HashPassword(Senha), Status = status, MfaAtivo = mfa,
        };
        ctx.Usuarios.Add(u);
        ctx.RefreshTokens.Add(new RefreshToken { Id = Guid.NewGuid(), UsuarioId = u.Id, Token = "t", ExpiresAt = DateTime.UtcNow.AddDays(7) });
        ctx.SaveChanges();
        return u;
    }

    [Fact]
    public async Task Iniciar_semMfa_enviaPin_eRetornaEmail()
    {
        using var ctx = CreateContext();
        var spy = new SenderSpy();
        var u = Seed(ctx);

        var r = await Create(ctx, spy).IniciarExclusaoAsync(u.Id, Senha);

        Assert.Equal("email", r.Metodo);
        Assert.NotNull(spy.UltimoCodigo);
        Assert.Single(ctx.EmailOtps);
    }

    [Fact]
    public async Task Iniciar_comMfa_retornaTotp_semEnviarEmail()
    {
        using var ctx = CreateContext();
        var spy = new SenderSpy();
        var u = Seed(ctx, mfa: true);

        var r = await Create(ctx, spy).IniciarExclusaoAsync(u.Id, Senha);

        Assert.Equal("totp", r.Metodo);
        Assert.Null(spy.UltimoCodigo);      // não dispara PIN quando tem TOTP
        Assert.Empty(ctx.EmailOtps);
    }

    [Fact]
    public async Task Iniciar_senhaErrada_lanca400_naoEnvia()
    {
        using var ctx = CreateContext();
        var spy = new SenderSpy();
        var u = Seed(ctx);

        await Assert.ThrowsAsync<ArgumentException>(() => Create(ctx, spy).IniciarExclusaoAsync(u.Id, "senha errada"));
        Assert.Empty(ctx.EmailOtps);
    }

    [Fact]
    public async Task Excluir_semMfa_codigoCerto_marca_derrubaTokens_audita_avisa()
    {
        using var ctx = CreateContext();
        var spy = new SenderSpy();
        var svc = Create(ctx, spy);
        var u = Seed(ctx);
        await svc.IniciarExclusaoAsync(u.Id, Senha); // dispara o PIN (spy.UltimoCodigo)

        await svc.ExcluirMinhaContaAsync(u.Id, Senha, spy.UltimoCodigo!);

        var db = await ctx.Usuarios.FindAsync(u.Id);
        Assert.Equal(StatusUsuario.MarcadoParaExclusao, db!.Status);
        Assert.NotNull(db.MarcadoExclusaoEm);
        Assert.Empty(ctx.RefreshTokens);                                   // sessão derrubada
        Assert.Equal(1, spy.Avisos);                                        // aviso out-of-band
        Assert.Contains(ctx.AdminAuditLogs, a => a.Acao == AcaoAdmin.AutoExclusaoConta && a.AlvoId == u.Id); // auditado
    }

    [Fact]
    public async Task Excluir_codigoErrado_lanca_eNaoMarca()
    {
        using var ctx = CreateContext();
        var spy = new SenderSpy();
        var svc = Create(ctx, spy);
        var u = Seed(ctx);
        await svc.IniciarExclusaoAsync(u.Id, Senha);

        await Assert.ThrowsAsync<ArgumentException>(() => svc.ExcluirMinhaContaAsync(u.Id, Senha, "000000"));
        Assert.Equal(StatusUsuario.Ativo, (await ctx.Usuarios.FindAsync(u.Id))!.Status);
    }

    [Fact]
    public async Task Excluir_senhaErrada_lanca400_eNaoMarca()
    {
        using var ctx = CreateContext();
        var spy = new SenderSpy();
        var u = Seed(ctx);

        await Assert.ThrowsAsync<ArgumentException>(() => Create(ctx, spy).ExcluirMinhaContaAsync(u.Id, "errada", "000000"));
        Assert.Equal(StatusUsuario.Ativo, (await ctx.Usuarios.FindAsync(u.Id))!.Status);
    }

    [Fact]
    public async Task Excluir_contaNaoAtiva_lanca409()
    {
        using var ctx = CreateContext();
        var spy = new SenderSpy();
        var u = Seed(ctx, status: StatusUsuario.MarcadoParaExclusao);

        await Assert.ThrowsAsync<InvalidOperationException>(() => Create(ctx, spy).ExcluirMinhaContaAsync(u.Id, Senha, "000000"));
    }

    // ── Reativação na carência ────────────────────────────────────────────────

    [Fact]
    public async Task Reativar_marcada_senhaCerta_voltaAtivo_eAudita()
    {
        using var ctx = CreateContext();
        var u = Seed(ctx, status: StatusUsuario.MarcadoParaExclusao);
        u.MarcadoExclusaoEm = DateTime.UtcNow; await ctx.SaveChangesAsync();

        await Create(ctx, new SenderSpy()).ReativarPorCredenciaisAsync(u.Email, Senha);

        var db = await ctx.Usuarios.FindAsync(u.Id);
        Assert.Equal(StatusUsuario.Ativo, db!.Status);
        Assert.Null(db.MarcadoExclusaoEm);
        Assert.Contains(ctx.AdminAuditLogs, a => a.Acao == AcaoAdmin.AutoReativacaoConta && a.AlvoId == u.Id);
    }

    [Fact]
    public async Task Reativar_naoMarcada_lanca_eNaoMuda()
    {
        using var ctx = CreateContext();
        var u = Seed(ctx); // Ativo

        await Assert.ThrowsAsync<ArgumentException>(() => Create(ctx, new SenderSpy()).ReativarPorCredenciaisAsync(u.Email, Senha));
        Assert.Equal(StatusUsuario.Ativo, (await ctx.Usuarios.FindAsync(u.Id))!.Status);
    }

    [Fact]
    public async Task Reativar_senhaErrada_lanca()
    {
        using var ctx = CreateContext();
        var u = Seed(ctx, status: StatusUsuario.MarcadoParaExclusao);

        await Assert.ThrowsAsync<ArgumentException>(() => Create(ctx, new SenderSpy()).ReativarPorCredenciaisAsync(u.Email, "errada"));
        Assert.Equal(StatusUsuario.MarcadoParaExclusao, (await ctx.Usuarios.FindAsync(u.Id))!.Status);
    }

    [Fact]
    public async Task ExportarMeusDados_retornaOsDados_eAuditaComoTitular()
    {
        using var ctx = CreateContext();
        var u = Seed(ctx);

        var dto = await Create(ctx, new SenderSpy()).ExportarMeusDadosAsync(u.Id);

        Assert.Equal(u.Email, dto.Perfil.Email);
        Assert.Contains(ctx.AdminAuditLogs, a => a.Acao == AcaoAdmin.AutoExportacaoDados && a.AlvoId == u.Id);
    }
}
