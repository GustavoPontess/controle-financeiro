using System.Security.Claims;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Middleware;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// O fuso da conta (2026-11-02): vem sozinho do aparelho, decide "que dia é hoje" pra pessoa no servidor e, sem ele,
/// vale Brasília. O middleware põe o fuso da pessoa logada no relógio durante a requisição.
/// </summary>
public class FusoHorarioServiceTests
{
    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private static (AppDbContext Ctx, Guid U) Seed()
    {
        var ctx = CreateContext();
        var u = new Usuario { Id = Guid.NewGuid(), Email = Guid.NewGuid() + "@t.com", Nome = "U", PasswordHash = "x" };
        ctx.Add(u);
        ctx.SaveChanges();
        return (ctx, u.Id);
    }

    [Fact]
    public async Task Salvar_GravaOFusoDoAparelho_ERecusaNomeDesconhecido()
    {
        var (ctx, u) = Seed();
        var fusos = new FusoHorarioService(ctx, new MemoryCache(new MemoryCacheOptions()));

        Assert.Null(await fusos.ObterAsync(u)); // conta nova: ainda sem fuso (vale Brasília)
        await fusos.SalvarAsync(u, "America/Rio_Branco");
        Assert.Equal("America/Rio_Branco", await fusos.ObterAsync(u)); // a memória foi limpa ao gravar
        Assert.Equal("America/Rio_Branco", (await ctx.Usuarios.FindAsync(u))!.FusoHorario);

        await Assert.ThrowsAsync<ArgumentException>(() => fusos.SalvarAsync(u, "Marte/Olympus"));
        Assert.Equal("America/Rio_Branco", await fusos.ObterAsync(u)); // o nome errado não apagou o certo
    }

    [Fact]
    public async Task Middleware_HojeNaRequisicaoEhODaPessoaLogada_SemLoginEhBrasilia()
    {
        var (ctx, u) = Seed();
        var fusos = new FusoHorarioService(ctx, new MemoryCache(new MemoryCacheOptions()));
        await fusos.SalvarAsync(u, "America/Rio_Branco");
        // 02/11 às 01h30 UTC: 20h30 de 01/11 no Acre, 22h30 em Brasília.
        using var _ = HorarioBrasil.FixarParaTeste(new DateTime(2026, 11, 2, 1, 30, 0, DateTimeKind.Utc));

        DateTime? agoraNaRequisicao = null;
        var middleware = new FusoDaPessoaMiddleware(_ => { agoraNaRequisicao = HorarioBrasil.Agora(); return Task.CompletedTask; });

        var logado = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, u.ToString())], "teste")) };
        await middleware.InvokeAsync(logado, fusos);
        Assert.Equal(new DateTime(2026, 11, 1, 20, 30, 0), agoraNaRequisicao);
        Assert.Equal(new DateTime(2026, 11, 1, 22, 30, 0), HorarioBrasil.Agora()); // fora da requisição, Brasília de novo

        await middleware.InvokeAsync(new DefaultHttpContext(), fusos);
        Assert.Equal(new DateTime(2026, 11, 1, 22, 30, 0), agoraNaRequisicao); // sem login: Brasília
    }
}
