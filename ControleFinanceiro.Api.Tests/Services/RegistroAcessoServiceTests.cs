using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Store de retenção Marco Civil (Art. 15). Cobre: gravação do acesso, purga da retenção vencida
/// (6 meses), e a garantia central — o registro NÃO tem FK pro usuário, então sobrevive à purga
/// da conta (é o ponto todo da retenção legal).
/// </summary>
public class RegistroAcessoServiceTests
{
    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    [Fact]
    public async Task RegistrarLogin_gravaAcessoComIdentificadorIpETimestamp()
    {
        using var ctx = CreateContext();
        var svc = new RegistroAcessoService(ctx);
        var usuarioId = Guid.NewGuid();

        await svc.RegistrarLoginAsync(usuarioId, "user@test.com", "203.0.113.7");

        var reg = Assert.Single(ctx.RegistrosAcesso);
        Assert.Equal(usuarioId, reg.UsuarioId);
        Assert.Equal("user@test.com", reg.Email);
        Assert.Equal("203.0.113.7", reg.Ip);
        Assert.Equal(TipoEventoAcesso.Login, reg.Tipo);
        Assert.NotEqual(default, reg.CriadoEm);
    }

    [Fact]
    public async Task RegistrarLogin_ipVazio_gravaPlaceholderNuncaVazio()
    {
        using var ctx = CreateContext();
        var svc = new RegistroAcessoService(ctx);

        await svc.RegistrarLoginAsync(Guid.NewGuid(), "user@test.com", "   ");

        var reg = Assert.Single(ctx.RegistrosAcesso);
        Assert.Equal("desconhecido", reg.Ip);
    }

    [Fact]
    public async Task PurgarExpirados_removeVencidosMantemDentroDoPrazo()
    {
        using var ctx = CreateContext();
        var svc = new RegistroAcessoService(ctx);
        var agora = DateTime.UtcNow;

        // Vencido (> 180 dias) e recente (< 180 dias).
        ctx.RegistrosAcesso.AddRange(
            new RegistroAcesso { Id = Guid.NewGuid(), UsuarioId = Guid.NewGuid(), Email = "old@test.com", Ip = "1.1.1.1", CriadoEm = agora.AddDays(-181) },
            new RegistroAcesso { Id = Guid.NewGuid(), UsuarioId = Guid.NewGuid(), Email = "new@test.com", Ip = "2.2.2.2", CriadoEm = agora.AddDays(-179) });
        await ctx.SaveChangesAsync();

        var removidos = await svc.PurgarExpiradosAsync();

        Assert.Equal(1, removidos);
        var restante = Assert.Single(ctx.RegistrosAcesso);
        Assert.Equal("new@test.com", restante.Email);
    }

    [Fact]
    public async Task PurgarExpirados_semVencidos_naoRemoveNada()
    {
        using var ctx = CreateContext();
        var svc = new RegistroAcessoService(ctx);
        ctx.RegistrosAcesso.Add(new RegistroAcesso { Id = Guid.NewGuid(), UsuarioId = Guid.NewGuid(), Email = "x@test.com", Ip = "1.1.1.1", CriadoEm = DateTime.UtcNow });
        await ctx.SaveChangesAsync();

        var removidos = await svc.PurgarExpiradosAsync();

        Assert.Equal(0, removidos);
        Assert.Single(ctx.RegistrosAcesso);
    }

    [Fact]
    public async Task RegistroAcesso_semFk_sobreviveAPurgaDoUsuario()
    {
        // Prova da retenção Marco Civil: apagar o usuário NÃO leva o registro de acesso junto.
        using var ctx = CreateContext();
        var svc = new RegistroAcessoService(ctx);

        var usuario = new Usuario { Id = Guid.NewGuid(), Email = "bye@test.com", Nome = "U", PasswordHash = "x" };
        ctx.Usuarios.Add(usuario);
        await ctx.SaveChangesAsync();

        await svc.RegistrarLoginAsync(usuario.Id, usuario.Email, "198.51.100.9");

        // Purga da conta (como no Módulo C).
        ctx.Usuarios.Remove(usuario);
        await ctx.SaveChangesAsync();

        var reg = Assert.Single(ctx.RegistrosAcesso);
        Assert.Equal(usuario.Id, reg.UsuarioId);           // Guid órfão, retido de propósito
        Assert.Equal("bye@test.com", reg.Email);            // identificador sobrevive
        Assert.Empty(ctx.Usuarios);                         // usuário foi de fato apagado
    }
}
