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
/// Senha nova que já vazou é recusada nos três caminhos (cadastro, troca, redefinição) com o motivo, e nada é
/// gravado. O verificador é falso aqui (a chamada ao Pwned Passwords tem teste próprio).
/// </summary>
[Collection("PasswordHasherEnv")]
public class AuthSenhaVazadaTests
{
    private const string Senha = "SenhaForteDeTeste2026!";
    private const string Vazada = "uma frase que ja vazou";

    private sealed class VerificadorFalso : IVerificadorSenhaVazada
    {
        public Task<bool> EstaVazadaAsync(string senha, CancellationToken ct = default) => Task.FromResult(senha == Vazada);
    }

    private static AppDbContext CreateContext() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
        .Options);

    private static AuthService CreateService(AppDbContext ctx) => new(ctx,
        new JwtTokenProvider("chave-de-teste-suficientemente-grande-0123456789", "test", "test"),
        new Mock<IPasswordResetDispatcher>().Object, new MfaService(ctx), TestHelpers.NotifAdmin(ctx),
        verificadorSenha: new VerificadorFalso());

    [Fact]
    public async Task Cadastro_ComSenhaVazada_Recusa_ComOMotivo_ENaoCriaConta()
    {
        using var ctx = CreateContext();
        var auth = CreateService(ctx);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => auth.RegisterAsync(new RegisterDto
        {
            Email = "nova@test.com", Nome = "Nova", Password = Vazada, ConfirmPassword = Vazada,
        }));

        Assert.Equal(PasswordPolicyService.MensagemVazada, ex.Message);
        Assert.False(await ctx.Usuarios.AnyAsync());
    }

    [Fact]
    public async Task TrocaDeSenha_PraUmaVazada_Recusa_EMantemASenhaAntiga()
    {
        using var ctx = CreateContext();
        var u = new Usuario { Id = Guid.NewGuid(), Email = "troca@test.com", Nome = "T", PasswordHash = PasswordHasher.HashPassword(Senha), Status = StatusUsuario.Ativo };
        ctx.Usuarios.Add(u);
        await ctx.SaveChangesAsync();
        var auth = CreateService(ctx);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => auth.ChangePasswordAsync(u.Id, Senha, Vazada));

        Assert.Equal(PasswordPolicyService.MensagemVazada, ex.Message);
        Assert.True(PasswordHasher.VerifyPassword(Senha, (await ctx.Usuarios.SingleAsync()).PasswordHash));
    }

    [Fact]
    public async Task Redefinir_PraUmaVazada_Recusa_ComOMotivo()
    {
        using var ctx = CreateContext();
        var auth = CreateService(ctx);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => auth.ResetSenhaAsync(new ResetPasswordDto
        {
            Token = "qualquer", NovaSenha = Vazada, ConfirmarNovaSenha = Vazada,
        }));

        Assert.Equal(PasswordPolicyService.MensagemVazada, ex.Message);
    }

    [Fact]
    public async Task Cadastro_ComOProprioEmailComoSenha_Recusa()
    {
        using var ctx = CreateContext();
        var auth = CreateService(ctx);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => auth.RegisterAsync(new RegisterDto
        {
            Email = "joaozinho.da.silva@test.com", Nome = "J", Password = "joaozinho.da.silva", ConfirmPassword = "joaozinho.da.silva",
        }));

        Assert.Equal(PasswordPolicyService.MensagemEmail, ex.Message);
    }
}
