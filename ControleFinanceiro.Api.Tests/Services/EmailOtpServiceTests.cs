using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// OTP (PIN) por e-mail — 2º fator de reserva. Cobre: geração+envio (só hash no banco), uso único,
/// código errado conta tentativa e queima ao estourar o teto, expiração, e invalidar os anteriores.
/// </summary>
public class EmailOtpServiceTests
{
    // Sender stub que captura o último código enviado (pra o teste conhecer o PIN gerado).
    private sealed class SenderSpy : IContaEmailSender
    {
        public Task EnviarAcessoLiberadoAsync(string email, CancellationToken ct = default) => Task.CompletedTask;
        public string? UltimoCodigo;
        public int Avisos;
        public Task EnviarCodigoAsync(string email, string codigo, TipoOtpEmail finalidade, DateTime expiraEm, CancellationToken ct = default)
        { UltimoCodigo = codigo; return Task.CompletedTask; }
        public Task EnviarAvisoExclusaoAsync(string email, DateTime marcadoEm, int diasCarencia, CancellationToken ct = default)
        { Avisos++; return Task.CompletedTask; }
    }

    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static Usuario Seed(AppDbContext ctx)
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = "u@test.com", Nome = "U", PasswordHash = "x" };
        ctx.Usuarios.Add(u); ctx.SaveChanges();
        return u;
    }

    [Fact]
    public async Task GerarEnviar_guardaSoHash_eEnviaOCodigo()
    {
        using var ctx = CreateContext();
        var spy = new SenderSpy();
        var svc = new EmailOtpService(ctx, spy);
        var u = Seed(ctx);

        await svc.GerarEnviarAsync(u, TipoOtpEmail.ExcluirConta);

        var otp = Assert.Single(ctx.EmailOtps);
        Assert.NotNull(spy.UltimoCodigo);
        Assert.Equal(6, spy.UltimoCodigo!.Length);
        Assert.NotEqual(spy.UltimoCodigo, otp.CodigoHash); // no banco é hash, não o código
        Assert.False(otp.Usado);
    }

    [Fact]
    public async Task Validar_codigoCerto_true_eUsoUnico()
    {
        using var ctx = CreateContext();
        var spy = new SenderSpy();
        var svc = new EmailOtpService(ctx, spy);
        var u = Seed(ctx);
        await svc.GerarEnviarAsync(u, TipoOtpEmail.ExcluirConta);

        Assert.True(await svc.ValidarAsync(u.Id, TipoOtpEmail.ExcluirConta, spy.UltimoCodigo));
        // uso único: segunda vez falha
        Assert.False(await svc.ValidarAsync(u.Id, TipoOtpEmail.ExcluirConta, spy.UltimoCodigo));
    }

    [Fact]
    public async Task Validar_codigoErrado_false_eQueimaAposTeto()
    {
        using var ctx = CreateContext();
        var spy = new SenderSpy();
        var svc = new EmailOtpService(ctx, spy);
        var u = Seed(ctx);
        await svc.GerarEnviarAsync(u, TipoOtpEmail.ExcluirConta);
        var certo = spy.UltimoCodigo!;

        for (var i = 0; i < EmailOtpService.MaxTentativas; i++)
            Assert.False(await svc.ValidarAsync(u.Id, TipoOtpEmail.ExcluirConta, "000000" == certo ? "111111" : "000000"));

        // queimou após o teto: nem o código certo passa mais
        Assert.False(await svc.ValidarAsync(u.Id, TipoOtpEmail.ExcluirConta, certo));
    }

    [Fact]
    public async Task Validar_expirado_false()
    {
        using var ctx = CreateContext();
        var svc = new EmailOtpService(ctx, new SenderSpy());
        var u = Seed(ctx);
        ctx.EmailOtps.Add(new EmailOtp
        {
            Id = Guid.NewGuid(), UsuarioId = u.Id, Finalidade = TipoOtpEmail.ExcluirConta,
            CodigoHash = OpaqueTokenHasher.Hash("123456"), ExpiraEm = DateTime.UtcNow.AddMinutes(-1), Usado = false,
        });
        await ctx.SaveChangesAsync();

        Assert.False(await svc.ValidarAsync(u.Id, TipoOtpEmail.ExcluirConta, "123456"));
    }

    [Fact]
    public async Task GerarEnviar_invalidaOsAnteriores()
    {
        using var ctx = CreateContext();
        var spy = new SenderSpy();
        var svc = new EmailOtpService(ctx, spy);
        var u = Seed(ctx);

        await svc.GerarEnviarAsync(u, TipoOtpEmail.ExcluirConta);
        var primeiro = spy.UltimoCodigo!;
        await svc.GerarEnviarAsync(u, TipoOtpEmail.ExcluirConta); // novo invalida o primeiro

        Assert.False(await svc.ValidarAsync(u.Id, TipoOtpEmail.ExcluirConta, primeiro)); // antigo não vale
        Assert.True(await svc.ValidarAsync(u.Id, TipoOtpEmail.ExcluirConta, spy.UltimoCodigo)); // só o último
    }
}
