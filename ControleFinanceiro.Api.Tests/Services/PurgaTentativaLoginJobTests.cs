using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Jobs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>As senhas erradas do login somem do banco 24 h depois da última (minimização, LGPD).</summary>
public class PurgaTentativaLoginJobTests
{
    [Fact]
    public async Task ApagaSoAsVencidas()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        using var ctx = new AppDbContext(options);
        ctx.TentativasLogin.AddRange(
            new TentativaLogin { Id = Guid.NewGuid(), ChaveEmail = "vencida", Falhas = 3, UltimaFalhaEm = DateTime.UtcNow.AddHours(-25) },
            new TentativaLogin { Id = Guid.NewGuid(), ChaveEmail = "valendo", Falhas = 3, UltimaFalhaEm = DateTime.UtcNow.AddHours(-23) });
        await ctx.SaveChangesAsync();

        var apagadas = await new PurgaTentativaLoginJob(ctx, NullLogger<PurgaTentativaLoginJob>.Instance).ExecuteAsync();

        Assert.Equal(1, apagadas);
        Assert.Equal("valendo", Assert.Single(ctx.TentativasLogin).ChaveEmail);
    }
}
