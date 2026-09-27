using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Jobs;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure.Jobs;

/// <summary>
/// Com o token de concorrência (xmin) na Fatura, um pagamento que cai entre a leitura e o save de um
/// job de fatura faz o SaveChanges do lote inteiro estourar DbUpdateConcurrencyException. Os jobs
/// refazem uma a uma, relendo cada fatura — o conflito de uma não pode travar as dos outros usuários.
/// InMemory não gera xmin: o interceptor simula a requisição concorrente (grava em outro contexto) e
/// lança o conflito que o Postgres lançaria.
/// </summary>
public class FaturaJobsConcorrenciaTests
{
    private sealed class ConflitoNoPrimeiroSave : SaveChangesInterceptor
    {
        public Func<Task>? Concorrente { get; set; }

        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (Concorrente != null)
            {
                var disparar = Concorrente;
                Concorrente = null; // só o save do lote perde a corrida
                await disparar();
                throw new DbUpdateConcurrencyException("Simula xmin divergente numa das faturas do lote.");
            }
            return result;
        }
    }

    private static (AppDbContext Job, Func<AppDbContext> Outro, ConflitoNoPrimeiroSave Interceptor) CriarContextos()
    {
        var nome = Guid.NewGuid().ToString();
        var interceptor = new ConflitoNoPrimeiroSave();
        var job = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(nome)
            .AddInterceptors(interceptor)
            .Options);
        AppDbContext Outro() => new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(nome).Options);
        return (job, Outro, interceptor);
    }

    /// <summary>Fatura de um usuário próprio com uma compra à vista de <paramref name="valor"/>.</summary>
    private static async Task<Guid> SeedFaturaAsync(
        AppDbContext ctx, DateTime fechamento, DateTime vencimento, decimal valor, decimal valorPago = 0,
        EstadoPagamentoFatura estado = EstadoPagamentoFatura.NaoPago,
        EstadoCicloFatura ciclo = EstadoCicloFatura.Fechada)
    {
        var usuarioId = Guid.NewGuid();
        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Cartão", TemCredito = true, LimiteTotal = 10_000,
            DiaFechamento = 10, DiaVencimento = 20, CriadoPor = usuarioId, Ativo = true,
        };
        var fatura = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = cartao.Id, CriadoPor = usuarioId,
            DataInicio = fechamento.AddMonths(-1), DataFechamento = fechamento, DataVencimento = vencimento,
            EstadoCiclo = ciclo, EstadoPagamento = estado, ValorPago = valorPago,
        };
        ctx.CartoesCredito.Add(cartao);
        ctx.Faturas.Add(fatura);
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Compra", Valor = valor, Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = cartao.Id, FaturaId = fatura.Id, UsadoComoCredito = true,
            MeioPagamento = MeioPagamento.Credito, Data = fechamento.AddDays(-5), CriadoPor = usuarioId,
        });
        await ctx.SaveChangesAsync();
        return fatura.Id;
    }

    private static async Task QuitarEmOutroContextoAsync(Func<AppDbContext> outro, Guid faturaId, decimal valor)
    {
        await using var ctx = outro();
        var fatura = await ctx.Faturas.SingleAsync(f => f.Id == faturaId);
        fatura.ValorPago = valor;
        fatura.EstadoPagamento = EstadoPagamentoFatura.Pago;
        fatura.DataPagamentoTotal = DateTime.UtcNow;
        await ctx.SaveChangesAsync();
    }

    [Fact]
    public async Task Atraso_ConflitoNoLote_RefazUmaAUma_PagaNaCorridaNaoAtrasa_OutraAtrasa()
    {
        var (ctx, outro, interceptor) = CriarContextos();
        var hoje = DateTime.UtcNow.Date;
        var paga = await SeedFaturaAsync(ctx, hoje.AddDays(-20), hoje.AddDays(-10), 300);
        var devendo = await SeedFaturaAsync(ctx, hoje.AddDays(-20), hoje.AddDays(-10), 200);
        ctx.ChangeTracker.Clear();

        // O usuário da 1ª fatura paga tudo enquanto o job roda.
        interceptor.Concorrente = () => QuitarEmOutroContextoAsync(outro, paga, 300);

        await new FaturaAtrasoJob(ctx).ExecuteAsync();

        await using var leitura = outro();
        var faturaPaga = await leitura.Faturas.SingleAsync(f => f.Id == paga);
        Assert.False(faturaPaga.EstaAtrasada); // o pagamento venceu: sem juros sobre fatura quitada
        Assert.Equal(0m, faturaPaga.JurosDeMora);
        Assert.Equal(EstadoPagamentoFatura.Pago, faturaPaga.EstadoPagamento);

        var faturaDevendo = await leitura.Faturas.SingleAsync(f => f.Id == devendo);
        Assert.True(faturaDevendo.EstaAtrasada); // antes o lote todo caía e ninguém era marcado
        Assert.Equal(2.00m, faturaDevendo.JurosDeMora);
    }

    [Fact]
    public async Task Fechamento_ConflitoNoLote_RefazUmaAUma_FechaTodas_SemEventoDuplicado()
    {
        var (ctx, outro, interceptor) = CriarContextos();
        var hoje = DateTime.UtcNow.Date;
        // Coberta: ValorPago = total com o ciclo aberto (cancelamento de parcela) → o fechamento quita e audita.
        var coberta = await SeedFaturaAsync(ctx, hoje, hoje.AddDays(10), 100, valorPago: 100,
            estado: EstadoPagamentoFatura.Parcial, ciclo: EstadoCicloFatura.Aberta);
        var paga = await SeedFaturaAsync(ctx, hoje, hoje.AddDays(10), 300, ciclo: EstadoCicloFatura.Aberta);
        ctx.ChangeTracker.Clear();

        interceptor.Concorrente = () => QuitarEmOutroContextoAsync(outro, paga, 300);

        await new FaturaFechamentoJob(ctx, new FinancialEventLogService(ctx)).ExecuteAsync();

        await using var leitura = outro();
        var faturas = await leitura.Faturas.Where(f => f.Id == coberta || f.Id == paga).ToListAsync();
        Assert.All(faturas, f => Assert.Equal(EstadoCicloFatura.Fechada, f.EstadoCiclo));
        Assert.Equal(EstadoPagamentoFatura.Pago, faturas.Single(f => f.Id == coberta).EstadoPagamento);
        Assert.Equal(300m, faturas.Single(f => f.Id == paga).ValorPago); // o pagamento concorrente não foi sobrescrito

        // O evento da tentativa em lote foi descartado com ela: a quitação fica auditada UMA vez.
        Assert.Single(await leitura.FinancialEventLogs
            .Where(e => e.Tipo == FinancialEventType.FaturaPagaTotal && e.EntidadeId == coberta)
            .ToListAsync());
    }
}
