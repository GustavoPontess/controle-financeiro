using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Fatura;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class FaturaServiceTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static CartaoCredito CriarCartao(Guid usuarioId, int? diaFechamento = null, int? diaVencimento = null) => new()
    {
        Id = Guid.NewGuid(),
        Nome = "Nubank",
        TemCredito = true,
        LimiteTotal = 5000,
        DiaFechamento = diaFechamento,
        DiaVencimento = diaVencimento,
        CriadoPor = usuarioId,
        Ativo = true,
    };

    private static Conta CriarConta(Guid usuarioId) => new()
    {
        Id = Guid.NewGuid(),
        Nome = "Conta Corrente",
        Tipo = TipoConta.ContaCorrente,
        UsuarioIdProprietario = usuarioId,
    };

    /// <summary>Idempotency-Key nova (o front gera um UUID por abertura do modal de pagar).</summary>
    private static string Chave() => Guid.NewGuid().ToString();

    /// <summary>
    /// Contexto sobre um banco InMemory NOMEADO e compartilhável (mesmo root) — pra simular duas
    /// requisições em conexões diferentes batendo no mesmo banco (testes de corrida).
    /// </summary>
    private static AppDbContext CreateContext(InMemoryDatabaseRoot root, string nome, IInterceptor? interceptor = null)
    {
        var builder = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(nome, root)
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning));
        if (interceptor != null)
            builder.AddInterceptors(interceptor);
        return new AppDbContext(builder.Options);
    }

    /// <summary>Quanto a conta foi debitada (Conta.Saldo é calculado, não gravado).</summary>
    private static Task<decimal> DebitadoDaContaAsync(AppDbContext ctx, Guid contaId) =>
        ctx.Transacoes
            .Where(t => t.ContaId == contaId && t.Tipo == TipoTransacao.Despesa)
            .SumAsync(t => t.Valor);

    /// <summary>
    /// Simula a corrida que o InMemory não reproduz sozinho (não tem índice único nem xmin): no
    /// SaveChanges do pagamento, roda antes a requisição "concorrente" (em outro contexto, que
    /// termina primeiro) e aí lança a exceção que o Postgres daria pra requisição perdedora.
    /// </summary>
    private sealed class SimulaCorridaNoPagamento : SaveChangesInterceptor
    {
        public Func<Task<Exception>>? Concorrente { get; set; }

        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            var ehPagamento = eventData.Context!.ChangeTracker.Entries<RegistroIdempotencia>()
                .Any(e => e.State == EntityState.Added);
            if (ehPagamento && Concorrente != null)
            {
                var disparar = Concorrente;
                Concorrente = null; // só a 1ª tentativa perde a corrida
                throw await disparar();
            }
            return result;
        }
    }

    // ── CalcularPeriodo ──────────────────────────────────────────────────────

    [Fact]
    public void CalcularPeriodo_SemDiaFechamento_RetornaMesCalendarioCompleto()
    {
        var (inicio, fechamento) = FaturaService.CalcularPeriodo(new DateTime(2026, 3, 15), null);

        Assert.Equal(new DateTime(2026, 3, 1), inicio);
        Assert.Equal(new DateTime(2026, 3, 31), fechamento);
    }

    [Fact]
    public void CalcularPeriodo_AntesDoFechamento_PertenceAFaturaQueFechaNesteMes()
    {
        // Dia 5, fechamento dia 10 → ainda não fechou: cai na fatura que fecha em 10/03.
        var (inicio, fechamento) = FaturaService.CalcularPeriodo(new DateTime(2026, 3, 5), 10);

        Assert.Equal(new DateTime(2026, 2, 10), inicio);
        Assert.Equal(new DateTime(2026, 3, 10), fechamento);
    }

    [Fact]
    public void CalcularPeriodo_NoDiaDoFechamento_PertenceANovaFatura()
    {
        // Dia exatamente igual ao fechamento → já abre a fatura seguinte.
        var (inicio, fechamento) = FaturaService.CalcularPeriodo(new DateTime(2026, 3, 10), 10);

        Assert.Equal(new DateTime(2026, 3, 10), inicio);
        Assert.Equal(new DateTime(2026, 4, 10), fechamento);
    }

    [Fact]
    public void CalcularPeriodo_AposFechamento_PertenceANovaFatura()
    {
        var (inicio, fechamento) = FaturaService.CalcularPeriodo(new DateTime(2026, 3, 15), 10);

        Assert.Equal(new DateTime(2026, 3, 10), inicio);
        Assert.Equal(new DateTime(2026, 4, 10), fechamento);
    }

    [Fact]
    public void CalcularPeriodo_DiaFechamentoMaiorQueDiasDoMes_UsaUltimoDiaValidoDoMes()
    {
        // DiaFechamento=31 em fevereiro/2026 (28 dias, não bissexto) → usa dia 28.
        // Transação no dia 15 (antes do fechamento efetivo) → mês anterior tem 31 dias.
        var (inicio, fechamento) = FaturaService.CalcularPeriodo(new DateTime(2026, 2, 15), 31);

        Assert.Equal(new DateTime(2026, 1, 31), inicio);
        Assert.Equal(new DateTime(2026, 2, 28), fechamento);
    }

    [Fact]
    public void CalcularPeriodo_DiaFechamentoMaiorQueDiasDoMes_NovaFaturaUsaDiaCheioDoProximoMes()
    {
        // Transação no próprio dia de fechamento efetivo (28/02) → nova fatura fecha em 31/03
        // (março tem dias suficientes pro dia 31 cheio).
        var (inicio, fechamento) = FaturaService.CalcularPeriodo(new DateTime(2026, 2, 28), 31);

        Assert.Equal(new DateTime(2026, 2, 28), inicio);
        Assert.Equal(new DateTime(2026, 3, 31), fechamento);
    }

    // ── CalcularVencimento ───────────────────────────────────────────────────

    [Fact]
    public void CalcularVencimento_SemDiaVencimento_RetornaFechamentoMais10Dias()
    {
        var vencimento = FaturaService.CalcularVencimento(new DateTime(2026, 3, 10), null);

        Assert.Equal(new DateTime(2026, 3, 20), vencimento);
    }

    [Fact]
    public void CalcularVencimento_DiaVencimentoAposFechamento_UsaMesmoMes()
    {
        var vencimento = FaturaService.CalcularVencimento(new DateTime(2026, 3, 10), 20);

        Assert.Equal(new DateTime(2026, 3, 20), vencimento);
    }

    [Fact]
    public void CalcularVencimento_DiaVencimentoAntesOuIgualFechamento_VaiParaProximoMes()
    {
        var vencimento = FaturaService.CalcularVencimento(new DateTime(2026, 3, 10), 5);

        Assert.Equal(new DateTime(2026, 4, 5), vencimento);
    }

    // ── ObterOuCriarFaturaAsync ──────────────────────────────────────────────

    [Fact]
    public async Task ObterOuCriarFaturaAsync_CartaoInexistente_LancaKeyNotFoundException()
    {
        var ctx = CreateContext();
        var service = new FaturaService(ctx);
        var usuarioId = Guid.NewGuid();

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.ObterOuCriarFaturaAsync(Guid.NewGuid(), DateTime.UtcNow, usuarioId));
    }

    [Fact]
    public async Task ObterOuCriarFaturaAsync_CartaoDeOutroUsuario_LancaKeyNotFoundException_NaoCriaFatura()
    {
        // Isolamento entre usuários (fix P0): cartão EXISTE, mas pertence a outro usuário —
        // defesa em profundidade além do dono já ser sempre passado pelos chamadores.
        var ctx = CreateContext();
        var donoId = Guid.NewGuid();
        var atacanteId = Guid.NewGuid();
        var cartao = CriarCartao(donoId, diaFechamento: 10, diaVencimento: 20);
        ctx.CartoesCredito.Add(cartao);
        await ctx.SaveChangesAsync();

        var service = new FaturaService(ctx);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.ObterOuCriarFaturaAsync(cartao.Id, new DateTime(2026, 3, 5), atacanteId));

        Assert.Empty(ctx.Faturas);
    }

    [Fact]
    public async Task ObterOuCriarFaturaAsync_SemFaturaExistente_CriaNovaFaturaAberta()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var cartao = CriarCartao(usuarioId, diaFechamento: 10, diaVencimento: 20);
        ctx.CartoesCredito.Add(cartao);
        await ctx.SaveChangesAsync();

        var service = new FaturaService(ctx);
        var fatura = await service.ObterOuCriarFaturaAsync(cartao.Id, new DateTime(2026, 3, 5), usuarioId);

        Assert.Equal(new DateTime(2026, 2, 10), fatura.DataInicio);
        Assert.Equal(new DateTime(2026, 3, 10), fatura.DataFechamento);
        Assert.Equal(new DateTime(2026, 3, 20), fatura.DataVencimento);
        Assert.Equal(EstadoCicloFatura.Aberta, fatura.EstadoCiclo);
        Assert.Equal(EstadoPagamentoFatura.NaoPago, fatura.EstadoPagamento);
        Assert.False(fatura.EstaAtrasada);
        Assert.Equal(0, fatura.ValorPago);
        Assert.Equal(usuarioId, fatura.CriadoPor);
        Assert.Single(ctx.Faturas);
    }

    [Fact]
    public async Task ObterOuCriarFaturaAsync_ComFaturaExistenteNoMesmoPeriodo_RetornaAMesmaSemDuplicar()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var cartao = CriarCartao(usuarioId, diaFechamento: 10, diaVencimento: 20);
        ctx.CartoesCredito.Add(cartao);
        await ctx.SaveChangesAsync();

        var service = new FaturaService(ctx);
        var primeira = await service.ObterOuCriarFaturaAsync(cartao.Id, new DateTime(2026, 3, 5), usuarioId);
        // Outra transação, dia diferente, mesmo período de fatura (fecha em 10/03).
        var segunda = await service.ObterOuCriarFaturaAsync(cartao.Id, new DateTime(2026, 3, 8), usuarioId);

        Assert.Equal(primeira.Id, segunda.Id);
        Assert.Single(ctx.Faturas);
    }

    [Fact]
    public async Task ObterOuCriarFaturaAsync_DataInicioDivergenteDaSalva_CorrigeAoBuscar()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var cartao = CriarCartao(usuarioId, diaFechamento: 10, diaVencimento: 20);
        ctx.CartoesCredito.Add(cartao);

        // Fatura já existente com DataInicio "errada" (ex.: bug legado +1 dia), mas
        // DataFechamento correta — é por ela que a busca casa.
        var faturaExistente = new Fatura
        {
            Id = Guid.NewGuid(),
            CartaoCreditoId = cartao.Id,
            DataInicio = new DateTime(2026, 2, 11),
            DataFechamento = new DateTime(2026, 3, 10),
            DataVencimento = new DateTime(2026, 3, 20),
            CriadoPor = usuarioId,
        };
        ctx.Faturas.Add(faturaExistente);
        await ctx.SaveChangesAsync();

        var service = new FaturaService(ctx);
        var fatura = await service.ObterOuCriarFaturaAsync(cartao.Id, new DateTime(2026, 3, 5), usuarioId);

        Assert.Equal(faturaExistente.Id, fatura.Id);
        Assert.Equal(new DateTime(2026, 2, 10), fatura.DataInicio); // corrigida
        Assert.Single(ctx.Faturas); // não duplicou
    }

    // ── CriarParcelamentoAsync ───────────────────────────────────────────────

    [Fact]
    public async Task CriarParcelamentoAsync_MenosDeDuasParcelas_LancaArgumentException()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var cartao = CriarCartao(usuarioId);
        ctx.CartoesCredito.Add(cartao);
        await ctx.SaveChangesAsync();

        var service = new FaturaService(ctx);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.CriarParcelamentoAsync(
            cartao.Id, null, "Compra", 100m, 1, DateTime.UtcNow.Date, usuarioId));
        Assert.Contains("mínimo 2 parcelas", ex.Message);
    }

    [Fact]
    public async Task CriarParcelamentoAsync_CriaTransacoesDistribuidasEmFaturasConsecutivas()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var cartao = CriarCartao(usuarioId); // sem dia de fechamento → mês calendário
        ctx.CartoesCredito.Add(cartao);
        await ctx.SaveChangesAsync();

        var service = new FaturaService(ctx);
        var dataBase = new DateTime(2026, 1, 15);

        var transacoes = await service.CriarParcelamentoAsync(
            cartao.Id, null, "Notebook", 300m, 3, dataBase, usuarioId);

        Assert.Equal(3, transacoes.Count);
        Assert.All(transacoes, t =>
        {
            Assert.Equal(100m, t.Valor);
            Assert.True(t.UsadoComoCredito);
            Assert.Equal(MeioPagamento.Credito, t.MeioPagamento);
            Assert.Equal(TipoTransacao.Despesa, t.Tipo);
            Assert.Equal(cartao.Id, t.CartaoCreditoId);
        });
        Assert.Equal("Notebook (1/3)", transacoes[0].Descricao);
        Assert.Equal("Notebook (2/3)", transacoes[1].Descricao);
        Assert.Equal("Notebook (3/3)", transacoes[2].Descricao);

        // 3 parcelas consecutivas → 3 faturas distintas.
        var faturaIds = transacoes.Select(t => t.FaturaId).Distinct().ToList();
        Assert.Equal(3, faturaIds.Count);
        Assert.Equal(3, await ctx.Faturas.CountAsync());

        var faturas = await ctx.Faturas.OrderBy(f => f.DataFechamento).ToListAsync();
        Assert.Equal(new DateTime(2026, 1, 31), faturas[0].DataFechamento);
        Assert.Equal(new DateTime(2026, 2, 28), faturas[1].DataFechamento);
        Assert.Equal(new DateTime(2026, 3, 31), faturas[2].DataFechamento);
    }

    [Fact]
    public async Task CriarParcelamentoAsync_ResiduoDeArredondamentoVaiParaUltimaParcela()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var cartao = CriarCartao(usuarioId);
        ctx.CartoesCredito.Add(cartao);
        await ctx.SaveChangesAsync();

        var service = new FaturaService(ctx);

        var transacoes = await service.CriarParcelamentoAsync(
            cartao.Id, null, "Compra", 100m, 3, new DateTime(2026, 1, 15), usuarioId);

        Assert.Equal(33.33m, transacoes[0].Valor);
        Assert.Equal(33.33m, transacoes[1].Valor);
        Assert.Equal(33.34m, transacoes[2].Valor); // 0.01 residual na última
        Assert.Equal(100m, transacoes.Sum(t => t.Valor));
    }

    // ── PagarFaturaAsync ─────────────────────────────────────────────────────

    private static async Task<(FaturaService service, CartaoCredito cartao, Fatura fatura, Conta conta)>
        SetupFaturaComCompraAsync(AppDbContext ctx, Guid usuarioId, decimal valorCompra = 300m)
    {
        var cartao = CriarCartao(usuarioId);
        var fatura = new Fatura
        {
            Id = Guid.NewGuid(),
            CartaoCreditoId = cartao.Id,
            DataInicio = DateTime.UtcNow.AddDays(-30),
            DataFechamento = DateTime.UtcNow,
            DataVencimento = DateTime.UtcNow.AddDays(10),
            CriadoPor = usuarioId,
            EstadoCiclo = EstadoCicloFatura.Fechada,
            EstadoPagamento = EstadoPagamentoFatura.NaoPago,
        };
        var compra = new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = "Compra",
            Valor = valorCompra,
            Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = cartao.Id,
            FaturaId = fatura.Id,
            UsadoComoCredito = true,
            Data = DateTime.UtcNow,
            CriadoPor = usuarioId,
            Ativo = true,
        };
        var conta = CriarConta(usuarioId);

        ctx.CartoesCredito.Add(cartao);
        ctx.Faturas.Add(fatura);
        ctx.Transacoes.Add(compra);
        ctx.Contas.Add(conta);
        await ctx.SaveChangesAsync();

        return (new FaturaService(ctx), cartao, fatura, conta);
    }

    [Fact]
    public async Task PagarFaturaAsync_FaturaInexistente_LancaKeyNotFoundException()
    {
        var ctx = CreateContext();
        var service = new FaturaService(ctx);
        var usuarioId = Guid.NewGuid();

        var dto = new PagarFaturaDto { ContaId = Guid.NewGuid(), Valor = 100, DataPagamento = DateTime.UtcNow };

        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.PagarFaturaAsync(Guid.NewGuid(), dto, usuarioId, Chave()));
    }

    [Fact]
    public async Task PagarFaturaAsync_CartaoDeOutroUsuario_Lanca404IgualAInexistente_NaoPaga()
    {
        // Cross-tenant / IDOR: fatura pertence a um cartão de outro usuário. Tem que dar o MESMO 404
        // (tipo e mensagem) da fatura inexistente — antes era 403, o que confirmava que o id existe.
        var ctx = CreateContext();
        var donoId = Guid.NewGuid();
        var atacanteId = Guid.NewGuid();
        var (_, _, fatura, _) = await SetupFaturaComCompraAsync(ctx, donoId);

        // Conta pertence ao "atacante" pra isolar exatamente a checagem de dono do cartão.
        var contaAtacante = CriarConta(atacanteId);
        ctx.Contas.Add(contaAtacante);
        await ctx.SaveChangesAsync();

        var service = new FaturaService(ctx);
        var dto = new PagarFaturaDto { ContaId = contaAtacante.Id, Valor = 100, DataPagamento = DateTime.UtcNow };

        var deOutro = await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.PagarFaturaAsync(fatura.Id, dto, atacanteId, Chave()));
        var inexistente = await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.PagarFaturaAsync(Guid.NewGuid(), dto, atacanteId, Chave()));

        Assert.Equal(inexistente.Message, deOutro.Message);
        Assert.Equal(0m, (await ctx.Faturas.AsNoTracking().SingleAsync(f => f.Id == fatura.Id)).ValorPago);
        Assert.Equal(0m, await DebitadoDaContaAsync(ctx, contaAtacante.Id));
    }

    [Fact]
    public async Task PagarFaturaAsync_FaturaJaPaga_LancaInvalidOperationException()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var (service, _, fatura, conta) = await SetupFaturaComCompraAsync(ctx, usuarioId);
        fatura.EstadoPagamento = EstadoPagamentoFatura.Pago;
        fatura.ValorPago = 300;
        await ctx.SaveChangesAsync();

        var dto = new PagarFaturaDto { ContaId = conta.Id, Valor = 50, DataPagamento = DateTime.UtcNow };

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.PagarFaturaAsync(fatura.Id, dto, usuarioId, Chave()));
        Assert.Contains("já foi paga", ex.Message);
    }

    [Fact]
    public async Task PagarFaturaAsync_ContaInexistenteOuDeOutroUsuario_LancaKeyNotFoundException()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var (service, _, fatura, _) = await SetupFaturaComCompraAsync(ctx, usuarioId);

        var dto = new PagarFaturaDto { ContaId = Guid.NewGuid(), Valor = 50, DataPagamento = DateTime.UtcNow };

        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.PagarFaturaAsync(fatura.Id, dto, usuarioId, Chave()));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-10)]
    public async Task PagarFaturaAsync_ValorZeroOuNegativo_LancaArgumentException(decimal valor)
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var (service, _, fatura, conta) = await SetupFaturaComCompraAsync(ctx, usuarioId);

        var dto = new PagarFaturaDto { ContaId = conta.Id, Valor = valor, DataPagamento = DateTime.UtcNow };

        await Assert.ThrowsAsync<ArgumentException>(() => service.PagarFaturaAsync(fatura.Id, dto, usuarioId, Chave()));
    }

    [Fact]
    public async Task PagarFaturaAsync_ValorMaiorQueRestante_LancaArgumentException()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var (service, _, fatura, conta) = await SetupFaturaComCompraAsync(ctx, usuarioId, valorCompra: 300m);

        var dto = new PagarFaturaDto { ContaId = conta.Id, Valor = 301m, DataPagamento = DateTime.UtcNow };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.PagarFaturaAsync(fatura.Id, dto, usuarioId, Chave()));
        Assert.Contains("Valor inválido", ex.Message);
    }

    [Fact]
    public async Task PagarFaturaAsync_PagamentoTotal_MarcaFaturaComoPaga()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var (service, cartao, fatura, conta) = await SetupFaturaComCompraAsync(ctx, usuarioId, valorCompra: 300m);
        var dataPagamento = DateTime.UtcNow;

        var dto = new PagarFaturaDto { ContaId = conta.Id, Valor = 300m, DataPagamento = dataPagamento, MeioPagamento = 4 };

        var pagamento = await service.PagarFaturaAsync(fatura.Id, dto, usuarioId, Chave());

        Assert.Equal(conta.Id, pagamento.ContaId);
        Assert.Equal(300m, pagamento.Valor);
        Assert.True(pagamento.EhPagamentoFatura);
        Assert.Equal(fatura.Id, pagamento.FaturaPagaId);
        Assert.Null(pagamento.FaturaId); // pagamento NÃO conta como transação da própria fatura
        Assert.Equal(dataPagamento, pagamento.Data);

        var faturaDb = await ctx.Faturas.FindAsync(fatura.Id);
        Assert.Equal(300m, faturaDb!.ValorPago);
        Assert.Equal(EstadoPagamentoFatura.Pago, faturaDb.EstadoPagamento);
        Assert.False(faturaDb.EstaAtrasada);
        Assert.NotNull(faturaDb.DataPagamentoTotal);
    }

    [Fact]
    public async Task PagarFaturaAsync_PagamentoParcial_MarcaFaturaComoParcial()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var (service, _, fatura, conta) = await SetupFaturaComCompraAsync(ctx, usuarioId, valorCompra: 300m);

        var dto = new PagarFaturaDto { ContaId = conta.Id, Valor = 100m, DataPagamento = DateTime.UtcNow };
        await service.PagarFaturaAsync(fatura.Id, dto, usuarioId, Chave());

        var faturaDb = await ctx.Faturas.FindAsync(fatura.Id);
        Assert.Equal(100m, faturaDb!.ValorPago);
        Assert.Equal(EstadoPagamentoFatura.Parcial, faturaDb.EstadoPagamento);
        Assert.Null(faturaDb.DataPagamentoTotal);
    }

    [Fact]
    public async Task PagarFaturaAsync_GravaFinancialEventLogDoPagamento()
    {
        // Pagar fatura muda saldo → audit trail obrigatório (CLAUDE.md), igual ao pagamento de parcela.
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var (service, _, fatura, conta) = await SetupFaturaComCompraAsync(ctx, usuarioId, valorCompra: 300m);

        var dto = new PagarFaturaDto { ContaId = conta.Id, Valor = 100m, DataPagamento = DateTime.UtcNow };
        await service.PagarFaturaAsync(fatura.Id, dto, usuarioId, Chave());

        var log = Assert.Single(await ctx.FinancialEventLogs.ToListAsync());
        Assert.Equal(FinancialEventType.FaturaPagaParcial, log.Tipo);
        Assert.Equal(fatura.Id, log.EntidadeId);
        Assert.Equal(usuarioId, log.CriadoPor);
        Assert.Equal(0m, log.ValorAntes);
        Assert.Equal(100m, log.ValorDepois);
    }

    // ── PagarFaturaAsync — idempotência (Idempotency-Key) ───────────────────

    [Fact]
    public async Task PagarFaturaAsync_MesmaChaveDuasVezes_PagaEDebitaUmaVezSo()
    {
        // O bug: duplo clique / retry de rede com pagamento PARCIAL passava de novo pela validação
        // (ainda havia restante) → 2 transações, conta debitada 2x, ValorPago somado 2x.
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var (service, _, fatura, conta) = await SetupFaturaComCompraAsync(ctx, usuarioId, valorCompra: 300m);
        var chave = Chave();
        var dto = new PagarFaturaDto { ContaId = conta.Id, Valor = 100m, DataPagamento = DateTime.UtcNow };

        var primeiro = await service.PagarFaturaAsync(fatura.Id, dto, usuarioId, chave);
        var segundo = await service.PagarFaturaAsync(fatura.Id, dto, usuarioId, chave);

        Assert.Equal(primeiro.Id, segundo.Id); // replay devolve o MESMO pagamento
        var faturaDb = await ctx.Faturas.AsNoTracking().SingleAsync(f => f.Id == fatura.Id);
        Assert.Equal(100m, faturaDb.ValorPago);
        Assert.Equal(EstadoPagamentoFatura.Parcial, faturaDb.EstadoPagamento);
        Assert.Single(await ctx.Transacoes.Where(t => t.FaturaPagaId == fatura.Id).ToListAsync());
        Assert.Equal(100m, await DebitadoDaContaAsync(ctx, conta.Id));
        var registro = Assert.Single(await ctx.RegistrosIdempotencia.ToListAsync());
        Assert.Equal(FaturaService.OperacaoPagarFatura, registro.Operacao);
        Assert.Equal(chave, registro.Chave);
        Assert.Equal(primeiro.Id, registro.ReferenciaId);
        Assert.Single(await ctx.FinancialEventLogs.ToListAsync()); // replay não audita de novo
    }

    [Fact]
    public async Task PagarFaturaAsync_MesmaChaveAposQuitar_ReplayDaSucessoEmVezDeJaPaga()
    {
        // Retry de um pagamento TOTAL: a fatura já está Pago, mas a mesma chave é o mesmo pedido —
        // devolve sucesso (o cliente não pode achar que falhou), não o 409 "já foi paga".
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var (service, _, fatura, conta) = await SetupFaturaComCompraAsync(ctx, usuarioId, valorCompra: 300m);
        var chave = Chave();
        var dto = new PagarFaturaDto { ContaId = conta.Id, Valor = 300m, DataPagamento = DateTime.UtcNow };

        var primeiro = await service.PagarFaturaAsync(fatura.Id, dto, usuarioId, chave);
        var segundo = await service.PagarFaturaAsync(fatura.Id, dto, usuarioId, chave);

        Assert.Equal(primeiro.Id, segundo.Id);
        var faturaDb = await ctx.Faturas.AsNoTracking().SingleAsync(f => f.Id == fatura.Id);
        Assert.Equal(300m, faturaDb.ValorPago);
        Assert.Equal(EstadoPagamentoFatura.Pago, faturaDb.EstadoPagamento);
        Assert.Equal(300m, await DebitadoDaContaAsync(ctx, conta.Id));
    }

    [Fact]
    public async Task PagarFaturaAsync_ChavesDiferentes_SaoDoisPagamentos()
    {
        // Dois pagamentos parciais legítimos (duas aberturas do modal) → duas chaves → dois débitos.
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var (service, _, fatura, conta) = await SetupFaturaComCompraAsync(ctx, usuarioId, valorCompra: 300m);
        var dto = new PagarFaturaDto { ContaId = conta.Id, Valor = 100m, DataPagamento = DateTime.UtcNow };

        var primeiro = await service.PagarFaturaAsync(fatura.Id, dto, usuarioId, Chave());
        var segundo = await service.PagarFaturaAsync(fatura.Id, dto, usuarioId, Chave());

        Assert.NotEqual(primeiro.Id, segundo.Id);
        var faturaDb = await ctx.Faturas.AsNoTracking().SingleAsync(f => f.Id == fatura.Id);
        Assert.Equal(200m, faturaDb.ValorPago);
        Assert.Equal(2, await ctx.Transacoes.CountAsync(t => t.FaturaPagaId == fatura.Id));
        Assert.Equal(200m, await DebitadoDaContaAsync(ctx, conta.Id));
        Assert.Equal(2, await ctx.RegistrosIdempotencia.CountAsync());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task PagarFaturaAsync_SemChave_LancaArgumentException_NaoPaga(string? chave)
    {
        // Decisão: chave OBRIGATÓRIA (o único chamador, o modal do front, sempre manda) → 400.
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var (service, _, fatura, conta) = await SetupFaturaComCompraAsync(ctx, usuarioId, valorCompra: 300m);
        var dto = new PagarFaturaDto { ContaId = conta.Id, Valor = 100m, DataPagamento = DateTime.UtcNow };

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => service.PagarFaturaAsync(fatura.Id, dto, usuarioId, chave));

        Assert.Contains("Idempotency-Key", ex.Message);
        Assert.Equal(0m, (await ctx.Faturas.AsNoTracking().SingleAsync(f => f.Id == fatura.Id)).ValorPago);
        Assert.Equal(0m, await DebitadoDaContaAsync(ctx, conta.Id));
    }

    [Fact]
    public async Task PagarFaturaAsync_ChaveMaiorQueOLimite_LancaArgumentException()
    {
        // Sem o limite, a chave estouraria o varchar(100) no INSERT → 500 em vez de 400.
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var (service, _, fatura, conta) = await SetupFaturaComCompraAsync(ctx, usuarioId);
        var dto = new PagarFaturaDto { ContaId = conta.Id, Valor = 100m, DataPagamento = DateTime.UtcNow };

        await Assert.ThrowsAsync<ArgumentException>(() => service.PagarFaturaAsync(
            fatura.Id, dto, usuarioId, new string('k', RegistroIdempotencia.ChaveMaxLength + 1)));

        Assert.Empty(await ctx.RegistrosIdempotencia.ToListAsync());
    }

    [Fact]
    public async Task PagarFaturaAsync_TentativaInvalida_NaoGastaAChave()
    {
        // A chave só é gravada junto com o pagamento (mesmo SaveChanges): um 400 de validação não a
        // consome — o usuário corrige o valor e o retry com a mesma chave paga normalmente.
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var (service, _, fatura, conta) = await SetupFaturaComCompraAsync(ctx, usuarioId, valorCompra: 300m);
        var chave = Chave();

        await Assert.ThrowsAsync<ArgumentException>(() => service.PagarFaturaAsync(fatura.Id,
            new PagarFaturaDto { ContaId = conta.Id, Valor = 301m, DataPagamento = DateTime.UtcNow }, usuarioId, chave));
        var pagamento = await service.PagarFaturaAsync(fatura.Id,
            new PagarFaturaDto { ContaId = conta.Id, Valor = 100m, DataPagamento = DateTime.UtcNow }, usuarioId, chave);

        Assert.Equal(100m, pagamento.Valor);
        Assert.Equal(100m, (await ctx.Faturas.AsNoTracking().SingleAsync(f => f.Id == fatura.Id)).ValorPago);
    }

    [Fact]
    public async Task PagarFaturaAsync_MesmaChaveEmOutraFatura_LancaInvalidOperation_NaoPaga()
    {
        // Chave reaproveitada em outra fatura (bug de cliente): nem devolve o pagamento da 1ª como se
        // fosse da 2ª, nem paga a 2ª com uma chave já consumida.
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var (service, _, fatura1, conta) = await SetupFaturaComCompraAsync(ctx, usuarioId, valorCompra: 300m);
        var (_, _, fatura2, _) = await SetupFaturaComCompraAsync(ctx, usuarioId, valorCompra: 300m);
        var chave = Chave();
        var dto = new PagarFaturaDto { ContaId = conta.Id, Valor = 100m, DataPagamento = DateTime.UtcNow };

        await service.PagarFaturaAsync(fatura1.Id, dto, usuarioId, chave);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.PagarFaturaAsync(fatura2.Id, dto, usuarioId, chave));

        Assert.Contains("Idempotency-Key", ex.Message);
        Assert.Equal(0m, (await ctx.Faturas.AsNoTracking().SingleAsync(f => f.Id == fatura2.Id)).ValorPago);
        Assert.Equal(100m, await DebitadoDaContaAsync(ctx, conta.Id));
    }

    [Fact]
    public async Task PagarFaturaAsync_MesmaChaveDeOutroUsuario_NaoInterfere()
    {
        // A chave é única POR usuário: a de outra pessoa não vira replay (nem vaza o pagamento dela).
        var ctx = CreateContext();
        var usuarioA = Guid.NewGuid();
        var usuarioB = Guid.NewGuid();
        var (service, _, faturaA, contaA) = await SetupFaturaComCompraAsync(ctx, usuarioA, valorCompra: 300m);
        var (_, _, faturaB, contaB) = await SetupFaturaComCompraAsync(ctx, usuarioB, valorCompra: 300m);
        var chave = Chave();

        var pagA = await service.PagarFaturaAsync(faturaA.Id,
            new PagarFaturaDto { ContaId = contaA.Id, Valor = 100m, DataPagamento = DateTime.UtcNow }, usuarioA, chave);
        var pagB = await service.PagarFaturaAsync(faturaB.Id,
            new PagarFaturaDto { ContaId = contaB.Id, Valor = 50m, DataPagamento = DateTime.UtcNow }, usuarioB, chave);

        Assert.NotEqual(pagA.Id, pagB.Id);
        Assert.Equal(50m, (await ctx.Faturas.AsNoTracking().SingleAsync(f => f.Id == faturaB.Id)).ValorPago);
        Assert.Equal(50m, await DebitadoDaContaAsync(ctx, contaB.Id));
    }

    [Theory]
    [InlineData("valor")]
    [InlineData("conta")]
    [InlineData("data")]
    [InlineData("meio")]
    public async Task PagarFaturaAsync_MesmaChaveComOutrosDados_Lanca409_NaoPagaDeNovo(string campoAlterado)
    {
        // O bug: pagou R$300 da conta A, a resposta se perdeu, o usuário trocou pra R$100 da conta B
        // no modal ainda aberto (MESMA chave) e confirmou → 204 "sucesso", mas o que saiu foram os
        // R$300 da A. Payload diferente com a mesma chave não é replay: é 409, e nada é pago de novo.
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var (service, _, fatura, contaA) = await SetupFaturaComCompraAsync(ctx, usuarioId, valorCompra: 500m);
        var contaB = CriarConta(usuarioId);
        ctx.Contas.Add(contaB);
        await ctx.SaveChangesAsync();
        var chave = Chave();
        var hoje = DateTime.UtcNow;
        await service.PagarFaturaAsync(fatura.Id, new PagarFaturaDto
        {
            ContaId = contaA.Id, Valor = 300m, DataPagamento = hoje, MeioPagamento = (int)MeioPagamento.Pix,
        }, usuarioId, chave);

        var outrosDados = new PagarFaturaDto
        {
            ContaId = campoAlterado == "conta" ? contaB.Id : contaA.Id,
            Valor = campoAlterado == "valor" ? 100m : 300m,
            DataPagamento = campoAlterado == "data" ? hoje.AddDays(-1) : hoje,
            MeioPagamento = campoAlterado == "meio" ? (int)MeioPagamento.Boleto : (int)MeioPagamento.Pix,
        };
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.PagarFaturaAsync(fatura.Id, outrosDados, usuarioId, chave));

        Assert.Equal(FaturaService.MensagemChaveComOutrosDados, ex.Message);
        Assert.Equal(300m, (await ctx.Faturas.AsNoTracking().SingleAsync(f => f.Id == fatura.Id)).ValorPago);
        Assert.Single(await ctx.Transacoes.Where(t => t.FaturaPagaId == fatura.Id).ToListAsync());
        Assert.Equal(300m, await DebitadoDaContaAsync(ctx, contaA.Id));
        Assert.Equal(0m, await DebitadoDaContaAsync(ctx, contaB.Id));
        Assert.Single(await ctx.FinancialEventLogs.ToListAsync());
    }

    [Fact]
    public async Task PagarFaturaAsync_MesmaChaveMesmosDadosOutroHorarioNoMesmoDia_ViraReplay()
    {
        // O front grava a hora do clique ("hoje → agora"): o retry do MESMO pedido chega com outro
        // horário. Só a data conta na comparação — senão todo retry legítimo viraria 409.
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var (service, _, fatura, conta) = await SetupFaturaComCompraAsync(ctx, usuarioId, valorCompra: 300m);
        var chave = Chave();
        var manha = DateTime.UtcNow.Date.AddHours(9);

        var primeiro = await service.PagarFaturaAsync(fatura.Id,
            new PagarFaturaDto { ContaId = conta.Id, Valor = 100m, DataPagamento = manha }, usuarioId, chave);
        var retry = await service.PagarFaturaAsync(fatura.Id,
            new PagarFaturaDto { ContaId = conta.Id, Valor = 100m, DataPagamento = manha.AddHours(3) }, usuarioId, chave);

        Assert.Equal(primeiro.Id, retry.Id);
        Assert.Equal(100m, (await ctx.Faturas.AsNoTracking().SingleAsync(f => f.Id == fatura.Id)).ValorPago);
        Assert.Equal(100m, await DebitadoDaContaAsync(ctx, conta.Id));
    }

    // ── PagarFaturaAsync — corrida entre requisições simultâneas ────────────

    [Fact]
    public async Task PagarFaturaAsync_CorridaMesmaChave_ViolacaoDoIndiceUnico_ViraReplay()
    {
        // Duplo clique em paralelo: as duas passam pela consulta de replay (nenhuma gravou ainda); a
        // gêmea commita primeiro e a nossa estoura o índice único (23505) → devolve o pagamento dela.
        var root = new InMemoryDatabaseRoot();
        var nome = Guid.NewGuid().ToString();
        var corrida = new SimulaCorridaNoPagamento();
        var ctx = CreateContext(root, nome, corrida);
        var usuarioId = Guid.NewGuid();
        var (service, _, fatura, conta) = await SetupFaturaComCompraAsync(ctx, usuarioId, valorCompra: 300m);
        var chave = Chave();
        var dto = new PagarFaturaDto { ContaId = conta.Id, Valor = 100m, DataPagamento = DateTime.UtcNow };

        Transacao? pagamentoDaGemea = null;
        corrida.Concorrente = async () =>
        {
            await using var outraConexao = CreateContext(root, nome);
            pagamentoDaGemea = await new FaturaService(outraConexao).PagarFaturaAsync(fatura.Id, dto, usuarioId, chave);
            return new DbUpdateException("duplicate key",
                new PostgresException("duplicate key value violates unique constraint", "ERROR", "ERROR",
                    PostgresErrorCodes.UniqueViolation));
        };

        var resultado = await service.PagarFaturaAsync(fatura.Id, dto, usuarioId, chave);

        Assert.NotNull(pagamentoDaGemea);
        Assert.Equal(pagamentoDaGemea!.Id, resultado.Id);
        await using var leitura = CreateContext(root, nome);
        Assert.Equal(100m, (await leitura.Faturas.SingleAsync(f => f.Id == fatura.Id)).ValorPago);
        Assert.Single(await leitura.Transacoes.Where(t => t.FaturaPagaId == fatura.Id).ToListAsync());
        Assert.Equal(100m, await DebitadoDaContaAsync(leitura, conta.Id));
    }

    [Fact]
    public async Task PagarFaturaAsync_CorridaMesmaChave_ConflitoDeConcorrencia_ViraReplay()
    {
        // Mesma corrida, mas o Postgres pode barrar a perdedora antes no UPDATE da Fatura (xmin mudou)
        // em vez do índice único — também é o mesmo pedido, então também é replay (não 409).
        var root = new InMemoryDatabaseRoot();
        var nome = Guid.NewGuid().ToString();
        var corrida = new SimulaCorridaNoPagamento();
        var ctx = CreateContext(root, nome, corrida);
        var usuarioId = Guid.NewGuid();
        var (service, _, fatura, conta) = await SetupFaturaComCompraAsync(ctx, usuarioId, valorCompra: 300m);
        var chave = Chave();
        var dto = new PagarFaturaDto { ContaId = conta.Id, Valor = 100m, DataPagamento = DateTime.UtcNow };

        Transacao? pagamentoDaGemea = null;
        corrida.Concorrente = async () =>
        {
            await using var outraConexao = CreateContext(root, nome);
            pagamentoDaGemea = await new FaturaService(outraConexao).PagarFaturaAsync(fatura.Id, dto, usuarioId, chave);
            return new DbUpdateConcurrencyException("The database operation was expected to affect 1 row(s).");
        };

        var resultado = await service.PagarFaturaAsync(fatura.Id, dto, usuarioId, chave);

        Assert.Equal(pagamentoDaGemea!.Id, resultado.Id);
        await using var leitura = CreateContext(root, nome);
        Assert.Equal(100m, (await leitura.Faturas.SingleAsync(f => f.Id == fatura.Id)).ValorPago);
        Assert.Equal(100m, await DebitadoDaContaAsync(leitura, conta.Id));
    }

    [Fact]
    public async Task PagarFaturaAsync_CorridaMesmaChaveComOutrosDados_Lanca409_NaoViraReplay()
    {
        // A comparação de dados vale também no caminho da corrida (dentro do catch): a gêmea com a
        // mesma chave commitou R$100; a nossa pedia R$50 → 409, não o pagamento dela como se fosse o nosso.
        var root = new InMemoryDatabaseRoot();
        var nome = Guid.NewGuid().ToString();
        var corrida = new SimulaCorridaNoPagamento();
        var ctx = CreateContext(root, nome, corrida);
        var usuarioId = Guid.NewGuid();
        var (service, _, fatura, conta) = await SetupFaturaComCompraAsync(ctx, usuarioId, valorCompra: 300m);
        var chave = Chave();
        var hoje = DateTime.UtcNow;

        corrida.Concorrente = async () =>
        {
            await using var outraConexao = CreateContext(root, nome);
            await new FaturaService(outraConexao).PagarFaturaAsync(fatura.Id,
                new PagarFaturaDto { ContaId = conta.Id, Valor = 100m, DataPagamento = hoje }, usuarioId, chave);
            return new DbUpdateException("duplicate key",
                new PostgresException("duplicate key value violates unique constraint", "ERROR", "ERROR",
                    PostgresErrorCodes.UniqueViolation));
        };

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.PagarFaturaAsync(fatura.Id,
            new PagarFaturaDto { ContaId = conta.Id, Valor = 50m, DataPagamento = hoje }, usuarioId, chave));

        Assert.Equal(FaturaService.MensagemChaveComOutrosDados, ex.Message);
        await using var leitura = CreateContext(root, nome);
        Assert.Equal(100m, (await leitura.Faturas.SingleAsync(f => f.Id == fatura.Id)).ValorPago);
        Assert.Single(await leitura.Transacoes.Where(t => t.FaturaPagaId == fatura.Id).ToListAsync());
        Assert.Equal(100m, await DebitadoDaContaAsync(leitura, conta.Id));
    }

    [Fact]
    public async Task PagarFaturaAsync_CorridaComOutroPagamento_PropagaConcorrencia_NaoSobrescreve()
    {
        // Dois pagamentos DIFERENTES ao mesmo tempo: antes, o 2º lia o ValorPago velho e sobrescrevia
        // o 1º (lost update → pagamento acima do restante). Agora o 2º perde no xmin e a exceção sobe
        // (o middleware devolve 409) sem persistir nada dele.
        var root = new InMemoryDatabaseRoot();
        var nome = Guid.NewGuid().ToString();
        var corrida = new SimulaCorridaNoPagamento();
        var ctx = CreateContext(root, nome, corrida);
        var usuarioId = Guid.NewGuid();
        var (service, _, fatura, conta) = await SetupFaturaComCompraAsync(ctx, usuarioId, valorCompra: 300m);
        var dto = new PagarFaturaDto { ContaId = conta.Id, Valor = 250m, DataPagamento = DateTime.UtcNow };

        corrida.Concorrente = async () =>
        {
            await using var outraConexao = CreateContext(root, nome);
            await new FaturaService(outraConexao).PagarFaturaAsync(fatura.Id, dto, usuarioId, Chave());
            return new DbUpdateConcurrencyException("The database operation was expected to affect 1 row(s).");
        };

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(
            () => service.PagarFaturaAsync(fatura.Id, dto, usuarioId, Chave()));

        await using var leitura = CreateContext(root, nome);
        Assert.Equal(250m, (await leitura.Faturas.SingleAsync(f => f.Id == fatura.Id)).ValorPago); // não 500
        Assert.Single(await leitura.Transacoes.Where(t => t.FaturaPagaId == fatura.Id).ToListAsync());
        Assert.Equal(250m, await DebitadoDaContaAsync(leitura, conta.Id));
        Assert.Single(await leitura.RegistrosIdempotencia.ToListAsync());
    }

    // ── ListarPorCartaoAsync ─────────────────────────────────────────────────

    [Fact]
    public async Task ListarPorCartaoAsync_CartaoInexistente_LancaKeyNotFoundException()
    {
        var ctx = CreateContext();
        var service = new FaturaService(ctx);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.ListarPorCartaoAsync(Guid.NewGuid(), Guid.NewGuid()));
    }

    [Fact]
    public async Task ListarPorCartaoAsync_CartaoDeOutroUsuario_LancaKeyNotFoundException()
    {
        // Cross-tenant / IDOR: cartão existe, mas pertence a outro usuário.
        var ctx = CreateContext();
        var donoId = Guid.NewGuid();
        var atacanteId = Guid.NewGuid();
        var cartao = CriarCartao(donoId);
        ctx.CartoesCredito.Add(cartao);
        await ctx.SaveChangesAsync();

        var service = new FaturaService(ctx);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.ListarPorCartaoAsync(cartao.Id, atacanteId));
    }

    [Fact]
    public async Task ListarPorCartaoAsync_RetornaFaturasOrdenadasPorFechamentoDesc_ComValorTotalCorreto()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var cartao = CriarCartao(usuarioId);
        ctx.CartoesCredito.Add(cartao);

        var faturaAntiga = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = cartao.Id,
            DataInicio = new DateTime(2026, 1, 1), DataFechamento = new DateTime(2026, 1, 31),
            DataVencimento = new DateTime(2026, 2, 10), CriadoPor = usuarioId,
        };
        var faturaRecente = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = cartao.Id,
            DataInicio = new DateTime(2026, 2, 1), DataFechamento = new DateTime(2026, 2, 28),
            DataVencimento = new DateTime(2026, 3, 10), CriadoPor = usuarioId,
            EstadoPagamento = EstadoPagamentoFatura.Parcial, ValorPago = 40,
        };
        ctx.Faturas.AddRange(faturaAntiga, faturaRecente);

        // Fatura recente: 50 (compra legacy ativa) + 20 (compra legacy inativa, soft-deleted, não conta)
        // + 30 (parcela sem juros) + 25 (parcela com juros, prevalece sobre Valor=20) = 105.
        ctx.Transacoes.AddRange(
            new Transacao
            {
                Id = Guid.NewGuid(), Descricao = "Compra ativa", Valor = 50, Tipo = TipoTransacao.Despesa,
                CartaoCreditoId = cartao.Id, FaturaId = faturaRecente.Id, UsadoComoCredito = true,
                Data = DateTime.UtcNow, CriadoPor = usuarioId, Ativo = true,
            },
            new Transacao
            {
                Id = Guid.NewGuid(), Descricao = "Compra cancelada", Valor = 20, Tipo = TipoTransacao.Despesa,
                CartaoCreditoId = cartao.Id, FaturaId = faturaRecente.Id, UsadoComoCredito = true,
                Data = DateTime.UtcNow, CriadoPor = usuarioId, Ativo = false,
            });
        ctx.ParcelasTransacao.AddRange(
            new ParcelaTransacao
            {
                Id = Guid.NewGuid(), ParcelamentoId = Guid.NewGuid(), Numero = 1, QuantidadeTotal = 2,
                DataVencimento = faturaRecente.DataVencimento, Valor = 30, FaturaId = faturaRecente.Id,
                CriadoPor = usuarioId,
            },
            new ParcelaTransacao
            {
                Id = Guid.NewGuid(), ParcelamentoId = Guid.NewGuid(), Numero = 2, QuantidadeTotal = 2,
                DataVencimento = faturaRecente.DataVencimento, Valor = 20, ValorComJuros = 25, FaturaId = faturaRecente.Id,
                CriadoPor = usuarioId,
            });
        await ctx.SaveChangesAsync();

        var service = new FaturaService(ctx);
        var resultado = await service.ListarPorCartaoAsync(cartao.Id, usuarioId);

        Assert.Equal(2, resultado.Count);
        // Mais recente (fechamento maior) primeiro.
        Assert.Equal(faturaRecente.Id, resultado[0].Id);
        Assert.Equal(faturaAntiga.Id, resultado[1].Id);
        Assert.Equal("Nubank", resultado[0].CartaoCreditoNome);

        var dtoRecente = resultado[0];
        Assert.Equal(105m, dtoRecente.ValorTotal);
        Assert.Equal(40m, dtoRecente.ValorPago);
        Assert.Equal(65m, dtoRecente.ValorRestante);
    }

    [Fact]
    public async Task ListarPorCartaoAsync_FaturaVencidaNaoPaga_MarcaVencidaTrue()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var cartao = CriarCartao(usuarioId);
        var fatura = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = cartao.Id,
            DataInicio = DateTime.UtcNow.AddDays(-40), DataFechamento = DateTime.UtcNow.AddDays(-10),
            DataVencimento = DateTime.UtcNow.AddDays(-5), CriadoPor = usuarioId,
            EstadoPagamento = EstadoPagamentoFatura.NaoPago,
        };
        ctx.CartoesCredito.Add(cartao);
        ctx.Faturas.Add(fatura);
        await ctx.SaveChangesAsync();

        var service = new FaturaService(ctx);
        var resultado = await service.ListarPorCartaoAsync(cartao.Id, usuarioId);

        Assert.True(resultado.Single().Vencida);
    }

    [Fact]
    public async Task ListarPorCartaoAsync_FaturaPagaMesmoAposVencimento_NaoMarcaVencida()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var cartao = CriarCartao(usuarioId);
        var fatura = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = cartao.Id,
            DataInicio = DateTime.UtcNow.AddDays(-40), DataFechamento = DateTime.UtcNow.AddDays(-10),
            DataVencimento = DateTime.UtcNow.AddDays(-5), CriadoPor = usuarioId,
            EstadoPagamento = EstadoPagamentoFatura.Pago, ValorPago = 0,
        };
        ctx.CartoesCredito.Add(cartao);
        ctx.Faturas.Add(fatura);
        await ctx.SaveChangesAsync();

        var service = new FaturaService(ctx);
        var resultado = await service.ListarPorCartaoAsync(cartao.Id, usuarioId);

        Assert.False(resultado.Single().Vencida);
    }

    // ── DetalheAsync ─────────────────────────────────────────────────────────

    [Fact]
    public async Task DetalheAsync_FaturaInexistente_LancaKeyNotFoundException()
    {
        var ctx = CreateContext();
        var service = new FaturaService(ctx);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.DetalheAsync(Guid.NewGuid(), Guid.NewGuid()));
    }

    [Fact]
    public async Task DetalheAsync_FaturaDeOutroUsuario_LancaKeyNotFoundException()
    {
        // Cross-tenant / IDOR: fatura existe, mas o cartão pertence a outro usuário.
        var ctx = CreateContext();
        var donoId = Guid.NewGuid();
        var atacanteId = Guid.NewGuid();
        var (_, _, fatura, _) = await SetupFaturaComCompraAsync(ctx, donoId);

        var service = new FaturaService(ctx);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.DetalheAsync(fatura.Id, atacanteId));
    }

    [Fact]
    public async Task DetalheAsync_RetornaTransacoesECategoriaCorretas()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var cartao = CriarCartao(usuarioId);
        var categoria = new Categoria { Id = Guid.NewGuid(), Descricao = "Mercado", Finalidade = Finalidade.Despesa };
        var fatura = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = cartao.Id,
            DataInicio = DateTime.UtcNow.AddDays(-30), DataFechamento = DateTime.UtcNow,
            DataVencimento = DateTime.UtcNow.AddDays(10), CriadoPor = usuarioId,
        };
        var compra = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Compra no mercado", Valor = 80, Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = cartao.Id, FaturaId = fatura.Id, UsadoComoCredito = true,
            CategoriaId = categoria.Id, Data = DateTime.UtcNow, CriadoPor = usuarioId, Ativo = true,
        };
        // Transação de conta corrente (não é crédito) associada por engano à fatura não deve aparecer.
        var naoCredito = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Não é crédito", Valor = 10, Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = cartao.Id, FaturaId = fatura.Id, UsadoComoCredito = false,
            Data = DateTime.UtcNow, CriadoPor = usuarioId, Ativo = true,
        };
        ctx.CartoesCredito.Add(cartao);
        ctx.Categorias.Add(categoria);
        ctx.Faturas.Add(fatura);
        ctx.Transacoes.AddRange(compra, naoCredito);
        await ctx.SaveChangesAsync();

        var service = new FaturaService(ctx);
        var detalhe = await service.DetalheAsync(fatura.Id, usuarioId);

        Assert.Equal(fatura.Id, detalhe.Id);
        Assert.Equal("Nubank", detalhe.CartaoCreditoNome);
        var transacaoDto = Assert.Single(detalhe.Transacoes);
        Assert.Equal(compra.Id, transacaoDto.Id);
        Assert.Equal("Mercado", transacaoDto.CategoriaDescricao);
        Assert.Empty(detalhe.Pagamentos);
    }

    [Fact]
    public async Task DetalheAsync_RetornaPagamentosComMeioPagamentoDescricao()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var (_, cartao, fatura, conta) = await SetupFaturaComCompraAsync(ctx, usuarioId, valorCompra: 300m);

        var service = new FaturaService(ctx);
        var dto = new PagarFaturaDto { ContaId = conta.Id, Valor = 300m, DataPagamento = DateTime.UtcNow, MeioPagamento = (int)MeioPagamento.Pix };
        await service.PagarFaturaAsync(fatura.Id, dto, usuarioId, Chave());

        var detalhe = await service.DetalheAsync(fatura.Id, usuarioId);

        var pagamentoDto = Assert.Single(detalhe.Pagamentos);
        Assert.Equal(300m, pagamentoDto.Valor);
        Assert.Equal((int)MeioPagamento.Pix, pagamentoDto.MeioPagamento);
        Assert.Equal("Pix", pagamentoDto.MeioPagamentoDescricao);
    }
}
