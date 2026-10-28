using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Auth;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Geração de notificações de admin nos eventos de origem — as 3 fontes: novo cadastro (register),
/// bloqueio por força bruta (login) e purga automática LGPD (job). Confirma que o evento certo cria
/// a notificação no stream do admin (e não no do usuário).
/// </summary>
[Collection("PasswordHasherEnv")]
public class NotificacaoAdminGeracaoTests
{
    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private static AuthService CreateAuth(AppDbContext ctx)
    {
        var jwt = new JwtTokenProvider("chave-de-teste-suficientemente-grande-0123456789", "test", "test");
        return new AuthService(ctx, jwt, new Mock<IPasswordResetDispatcher>().Object, new MfaService(ctx), TestHelpers.NotifAdmin(ctx));
    }

    [Fact]
    public async Task Register_criaNotificacaoNovoCadastro_noStreamDoAdmin()
    {
        using var ctx = CreateContext();
        var auth = CreateAuth(ctx);

        await auth.RegisterAsync(new RegisterDto
        {
            Email = "novato@test.com", Nome = "Novato",
            Password = "SenhaBemForte2026!", ConfirmPassword = "SenhaBemForte2026!",
        });

        var n = Assert.Single(ctx.NotificacoesAdmin);
        Assert.Equal(TipoNotificacaoAdmin.NovoCadastro, n.Tipo);
        Assert.Equal("/admin/pendentes", n.LinkRelativo);
        // Acionável: ligada ao usuário pendente (AlvoId) pra dar baixa no aprovar/recusar.
        var user = await ctx.Usuarios.SingleAsync(u => u.Email == "novato@test.com");
        Assert.Equal(user.Id, n.AlvoId);
        Assert.Empty(ctx.Notificacoes); // não vaza pro stream do usuário
    }

    [Fact]
    public async Task Login_aoBaterOTetoDeForcaBruta_criaNotificacaoSeguranca()
    {
        using var ctx = CreateContext();
        var auth = CreateAuth(ctx);

        // Conta a uma falha de pedir senha nova (99).
        ctx.Usuarios.Add(new Usuario
        {
            Id = Guid.NewGuid(), Email = "alvo@test.com", Nome = "Alvo",
            PasswordHash = PasswordHasher.HashPassword("SenhaCorreta2026!"),
            Status = StatusUsuario.Ativo,
            FalhasLoginConsecutivas = 99,
            UltimaFalhaLoginEm = DateTime.UtcNow.AddHours(-1),
        });
        await ctx.SaveChangesAsync();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            auth.LoginAsync(new LoginDto { Email = "alvo@test.com", Password = "senha-errada" }));

        var n = Assert.Single(ctx.NotificacoesAdmin);
        Assert.Equal(TipoNotificacaoAdmin.Seguranca, n.Tipo);
    }

    [Fact]
    public async Task PurgaAutomatica_criaNotificacaoExclusaoLgpd()
    {
        using var ctx = CreateContext();
        var lgpd = new AdminLgpdService(ctx, new AdminAuditService(ctx), TestHelpers.NotifAdmin(ctx));

        // Conta marcada, carência vencida, sem vínculo → purgável pelo job.
        ctx.Usuarios.Add(new Usuario
        {
            Id = Guid.NewGuid(), Email = "vencida@test.com", Nome = "Vencida", PasswordHash = "x",
            Status = StatusUsuario.MarcadoParaExclusao,
            MarcadoExclusaoEm = DateTime.UtcNow.AddDays(-(AdminLgpdService.JanelaCarenciaDias + 1)),
        });
        await ctx.SaveChangesAsync();

        var purgadas = await lgpd.PurgarExpiradasAsync();

        Assert.Equal(1, purgadas);
        Assert.Contains(ctx.NotificacoesAdmin, n => n.Tipo == TipoNotificacaoAdmin.ExclusaoLgpd);
    }
}
