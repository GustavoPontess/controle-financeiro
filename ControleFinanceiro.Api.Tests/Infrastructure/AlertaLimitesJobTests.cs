using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Jobs;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>Alerta de limite: avisa uma vez por categoria e mês, no alerta (80%) e quando passa.</summary>
public class AlertaLimitesJobTests
{
    private static readonly DateTime Agora = new(2026, 10, 15, 15, 0, 0); // 12h em Brasília

    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private static AlertaLimitesJob Job(AppDbContext ctx) =>
        new(ctx, new OrcamentoService(ctx), new NotificacaoService(ctx, NullLogger<NotificacaoService>.Instance), NullLogger<AlertaLimitesJob>.Instance);

    private static (Guid Usuario, Guid Categoria) Seed(AppDbContext ctx, decimal limite)
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = Guid.NewGuid() + "@t.com", Nome = "U", PasswordHash = "x" };
        var c = new Categoria { Id = Guid.NewGuid(), Descricao = "Mercado", Finalidade = Finalidade.Despesa };
        ctx.AddRange(u, c, new Orcamento { Id = Guid.NewGuid(), UsuarioId = u.Id, CategoriaId = c.Id, Ano = 2026, Mes = 8, ValorLimite = limite });
        ctx.SaveChanges();
        return (u.Id, c.Id);
    }

    private static void Gasto(AppDbContext ctx, Guid u, Guid c, decimal valor, int mes = 10)
    {
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Mercado", Valor = valor, Tipo = TipoTransacao.Despesa, CategoriaId = c, CriadoPor = u,
            Data = new DateOnly(2026, mes, 5), StatusTransacao = StatusTransacao.Executado, Ativo = true,
        });
        ctx.SaveChanges();
    }

    [Fact]
    public async Task Perto_AvisaUmaVez_DepoisPassou_AvisaDeNovo()
    {
        var ctx = CreateContext();
        var (u, c) = Seed(ctx, 1000m);
        Gasto(ctx, u, c, 850m);

        await Job(ctx).ExecuteAsync(Agora);
        await Job(ctx).ExecuteAsync(Agora); // de hora em hora: não repete

        var perto = Assert.Single(ctx.Notificacoes);
        Assert.Equal(("Mercado chegou a 85% do planejado", "Em outubro: R$ 850,00 de R$ 1.000,00, sobram R$ 150,00.", "/orcamento"),
            (perto.Titulo, perto.Mensagem, perto.LinkRelativo));
        Assert.Equal(TipoNotificacao.OrcamentoEstourado, perto.Tipo);

        Gasto(ctx, u, c, 200m);
        await Job(ctx).ExecuteAsync(Agora);
        await Job(ctx).ExecuteAsync(Agora);

        Assert.Equal(2, ctx.Notificacoes.Count());
        Assert.Contains(ctx.Notificacoes, n => n.Titulo == "Mercado passou do planejado"
            && n.Mensagem == "Em outubro: R$ 1.050,00 de R$ 1.000,00, R$ 50,00 a mais.");
    }

    [Fact]
    public async Task PulouDiretoPraPassou_SoUmAviso_EMesNovoAvisaDeNovo()
    {
        var ctx = CreateContext();
        var (u, c) = Seed(ctx, 100m);
        Gasto(ctx, u, c, 300m);
        Gasto(ctx, u, c, 300m, mes: 11);

        await Job(ctx).ExecuteAsync(Agora);
        Assert.Equal("Mercado passou do planejado", Assert.Single(ctx.Notificacoes).Titulo);

        await Job(ctx).ExecuteAsync(new DateTime(2026, 11, 2, 12, 0, 0));
        Assert.Equal(2, ctx.Notificacoes.Count(n => n.Titulo == "Mercado passou do planejado")); // novembro é outro aviso
    }

    [Fact]
    public async Task DentroDoLimite_NadaSai()
    {
        var ctx = CreateContext();
        var (u, c) = Seed(ctx, 1000m);
        Gasto(ctx, u, c, 100m);

        await Job(ctx).ExecuteAsync(Agora);

        Assert.Empty(ctx.Notificacoes);
    }
}
