using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Parcelamento;
using ControleFinanceiro.Api.DTOs.ParcelaTransacao;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Cobertura de <see cref="ParcelaTransacaoService"/> — pagar antecipado e cancelar parcela.
/// Inclui a REGRESSÃO do bug P1 (2026-09-19): <c>MontarPagarResultadoAsync</c> tinha um ciclo de
/// Include (ParcelaTransacao→Fatura→ParcelasTransacao) sob <c>AsNoTracking</c> que o EF Core rejeita
/// em <c>VerifyNoCycles</c> → <c>InvalidOperationException</c> lançada APÓS o commit: cada pagamento
/// debitava a conta + fechava a fatura no banco e só então devolvia 500 (front achava que falhou).
/// </summary>
public class ParcelaTransacaoServiceTests
{
    private static AppDbContext CreateInMemoryContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private static ParcelaTransacaoService BuildService(AppDbContext context) =>
        new(context, new FinancialEventLogService(context), new LimiteCalculatorService(context));

    /// <summary>
    /// Semeia cartão + categoria + conta (com saldo via Receita) e cria um parcelamento de
    /// <paramref name="parcelas"/>× via <see cref="ParcelamentoService"/> (gera faturas + parcelas
    /// reais). Devolve os ids necessários e a lista de parcelas criadas.
    /// </summary>
    private static async Task<(Guid usuarioId, Guid cartaoId, Guid contaId, ParcelamentoDetalheDto parcelamento)>
        SeedParcelamentoAsync(
            AppDbContext context,
            decimal valorTotal = 6000,
            int parcelas = 3,
            decimal saldoConta = 5000)
    {
        var usuarioId = Guid.NewGuid();
        var cartaoId = Guid.NewGuid();

        context.CartoesCredito.Add(new CartaoCredito
        {
            Id = cartaoId,
            Nome = "Test Card",
            TemCredito = true,
            LimiteTotal = 10000,
            DiaFechamento = 10,
            DiaVencimento = 20,
            CriadoPor = usuarioId,
            Ativo = true,
        });

        var categoria = new Categoria
        {
            Id = Guid.NewGuid(),
            Descricao = "Teste",
            Finalidade = Finalidade.Despesa,
        };
        context.Categorias.Add(categoria);

        var contaId = Guid.NewGuid();
        context.Contas.Add(new Conta
        {
            Id = contaId,
            Nome = "Conta Pagamento",
            Tipo = TipoConta.ContaCorrente,
            UsuarioIdProprietario = usuarioId,
        });

        // Saldo inicial da conta (saldo é dinâmico: Receitas - Despesas, Executado + Ativo)
        if (saldoConta > 0)
        {
            context.Transacoes.Add(new Transacao
            {
                Id = Guid.NewGuid(),
                Descricao = "Saldo inicial",
                Valor = saldoConta,
                Tipo = TipoTransacao.Receita,
                ContaId = contaId,
                Data = DateOnly.FromDateTime(DateTime.UtcNow),
                StatusTransacao = StatusTransacao.Executado,
                Ativo = true,
                CriadoPor = usuarioId,
            });
        }

        await context.SaveChangesAsync();

        var parcelamentoService = new ParcelamentoService(
            context,
            new FinancialEventLogService(context),
            new LimiteCalculatorService(context),
            new FaturaService(context));

        var parcelamento = await parcelamentoService.CriarAsync(new CriarParcelamentoDto
        {
            Descricao = "Notebook",
            Valor = valorTotal,
            Tipo = TipoParcelamento.CompraParcelada,
            CartaoCreditoId = cartaoId,
            DataCompra = DateTime.UtcNow.Date,
            Parcelas = parcelas,
            PrimeiraParcelaMes = TestHelpers.MesDaFatura(DateTime.UtcNow, 10),
            CategoriaId = categoria.Id,
            IdempotencyKey = Guid.NewGuid().ToString(),
        }, usuarioId);

        return (usuarioId, cartaoId, contaId, parcelamento);
    }

    private static PagarParcelaDto Pagar(Guid contaId) => new()
    {
        ContaPagamentoId = contaId,
        IdempotencyKey = Guid.NewGuid().ToString(),
    };

    // ── Pagar antecipado ─────────────────────────────────────────────────────

    [Fact] // REGRESSÃO do 500 pós-débito (ciclo de Include em AsNoTracking)
    public async Task PagarAntecipado_pagaParcela_naoEstoura_eRetornaResultado()
    {
        var context = CreateInMemoryContext();
        var (usuarioId, _, contaId, parcelamento) = await SeedParcelamentoAsync(context);
        var parcela = parcelamento.Parcelas.First();
        var service = BuildService(context);

        // Antes do fix: lançava InvalidOperationException (VerifyNoCycles) DEPOIS de debitar.
        var resultado = await service.PagarAntecipadoAsync(parcela.Id, Pagar(contaId), usuarioId);

        Assert.NotNull(resultado);
        Assert.Equal(parcela.Id, resultado.ParcelaId);
        Assert.Equal(StatusParcela.Paga, resultado.Status);
        Assert.NotEqual(Guid.Empty, resultado.FaturaAtualizada.Id);
        Assert.True(resultado.FaturaAtualizada.ValorPago > 0);
        Assert.NotNull(resultado.NovoLimite);
    }

    [Fact]
    public async Task PagarAntecipado_debitaContaComValorDaParcela()
    {
        var context = CreateInMemoryContext();
        var (usuarioId, _, contaId, parcelamento) = await SeedParcelamentoAsync(context);
        var parcela = parcelamento.Parcelas.First();
        var valorParcela = parcela.ValorComJuros ?? parcela.Valor;
        var service = BuildService(context);

        await service.PagarAntecipadoAsync(parcela.Id, Pagar(contaId), usuarioId);

        var pagamento = await context.Transacoes.SingleOrDefaultAsync(t =>
            t.ContaId == contaId
            && t.Tipo == TipoTransacao.Despesa
            && t.ParcelaTransacaoId == parcela.Id);
        Assert.NotNull(pagamento);
        Assert.Equal(valorParcela, pagamento!.Valor);
        Assert.True(pagamento.EhPagamentoFatura);
        Assert.Null(pagamento.FaturaId);          // não polui o total da fatura
        Assert.NotNull(pagamento.FaturaPagaId);   // rastreia a fatura quitada
    }

    [Fact]
    public async Task PagarAntecipado_idempotente_naoDebitaDuasVezes()
    {
        var context = CreateInMemoryContext();
        var (usuarioId, _, contaId, parcelamento) = await SeedParcelamentoAsync(context);
        var parcela = parcelamento.Parcelas.First();
        var dto = Pagar(contaId); // MESMA chave nas duas chamadas
        var service = BuildService(context);

        var r1 = await service.PagarAntecipadoAsync(parcela.Id, dto, usuarioId);
        var r2 = await service.PagarAntecipadoAsync(parcela.Id, dto, usuarioId); // replay

        Assert.Equal(r1.ParcelaId, r2.ParcelaId);
        Assert.Equal(r1.FaturaAtualizada.ValorPago, r2.FaturaAtualizada.ValorPago);
        var pagamentos = await context.Transacoes.CountAsync(t =>
            t.ParcelaTransacaoId == parcela.Id && t.Tipo == TipoTransacao.Despesa);
        Assert.Equal(1, pagamentos); // débito único apesar do retry
    }

    [Fact]
    public async Task PagarAntecipado_parcelaJaPaga_lanca()
    {
        var context = CreateInMemoryContext();
        var (usuarioId, _, contaId, parcelamento) = await SeedParcelamentoAsync(context);
        var parcela = parcelamento.Parcelas.First();
        var service = BuildService(context);

        await service.PagarAntecipadoAsync(parcela.Id, Pagar(contaId), usuarioId);

        // Nova chave (não é replay) numa parcela que já está Paga → bloqueia
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.PagarAntecipadoAsync(parcela.Id, Pagar(contaId), usuarioId));
    }

    [Fact]
    public async Task PagarAntecipado_saldoInsuficiente_lanca()
    {
        var context = CreateInMemoryContext();
        var (usuarioId, _, contaId, parcelamento) =
            await SeedParcelamentoAsync(context, valorTotal: 6000, parcelas: 3, saldoConta: 100);
        var parcela = parcelamento.Parcelas.First(); // 2000 > saldo 100
        var service = BuildService(context);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.PagarAntecipadoAsync(parcela.Id, Pagar(contaId), usuarioId));
    }

    [Fact]
    public async Task PagarAntecipado_contaDeOutroUsuario_lanca()
    {
        var context = CreateInMemoryContext();
        var (usuarioId, _, _, parcelamento) = await SeedParcelamentoAsync(context);
        var parcela = parcelamento.Parcelas.First();

        // Conta de OUTRO usuário
        var contaOutro = Guid.NewGuid();
        context.Contas.Add(new Conta
        {
            Id = contaOutro,
            Nome = "Conta alheia",
            Tipo = TipoConta.ContaCorrente,
            UsuarioIdProprietario = Guid.NewGuid(),
        });
        await context.SaveChangesAsync();
        var service = BuildService(context);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.PagarAntecipadoAsync(parcela.Id, Pagar(contaOutro), usuarioId));
    }

    [Fact]
    public async Task PagarAntecipado_parcelaDeOutroUsuario_lanca()
    {
        var context = CreateInMemoryContext();
        var (_, _, contaId, parcelamento) = await SeedParcelamentoAsync(context);
        var parcela = parcelamento.Parcelas.First();
        var service = BuildService(context);

        // usuarioId errado → não encontra a parcela (isolamento multi-tenant)
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.PagarAntecipadoAsync(parcela.Id, Pagar(contaId), Guid.NewGuid()));
    }

    [Fact]
    public async Task PagarAntecipado_idempotencyKeyVazio_lanca()
    {
        var context = CreateInMemoryContext();
        var (usuarioId, _, contaId, parcelamento) = await SeedParcelamentoAsync(context);
        var parcela = parcelamento.Parcelas.First();
        var service = BuildService(context);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.PagarAntecipadoAsync(parcela.Id,
                new PagarParcelaDto { ContaPagamentoId = contaId, IdempotencyKey = " " },
                usuarioId));
    }

    // ── Cancelar parcela ─────────────────────────────────────────────────────

    [Fact]
    public async Task Cancelar_parcelaPendente_marcaCancelada()
    {
        var context = CreateInMemoryContext();
        var (usuarioId, _, _, parcelamento) = await SeedParcelamentoAsync(context);
        var parcela = parcelamento.Parcelas.First();
        var service = BuildService(context);

        var resultado = await service.CancelarAsync(parcela.Id,
            new CancelarParcelaDto { Motivo = "erro de compra", IdempotencyKey = Guid.NewGuid().ToString() },
            usuarioId);

        Assert.Equal(StatusParcela.Cancelada, resultado.Status);
        var noBanco = await context.ParcelasTransacao.FindAsync(parcela.Id);
        Assert.Equal(StatusParcela.Cancelada, noBanco!.Status);
    }

    [Fact]
    public async Task Cancelar_idempotente_naoReprocessa()
    {
        var context = CreateInMemoryContext();
        var (usuarioId, _, _, parcelamento) = await SeedParcelamentoAsync(context);
        var parcela = parcelamento.Parcelas.First();
        var dto = new CancelarParcelaDto { Motivo = "x", IdempotencyKey = Guid.NewGuid().ToString() };
        var service = BuildService(context);

        var r1 = await service.CancelarAsync(parcela.Id, dto, usuarioId);
        var r2 = await service.CancelarAsync(parcela.Id, dto, usuarioId); // replay

        Assert.Equal(r1.ParcelaId, r2.ParcelaId);
        Assert.Equal(StatusParcela.Cancelada, r2.Status);
        var eventos = await context.FinancialEventLogs.CountAsync(e =>
            e.Tipo == FinancialEventType.ParcelaCancelada && e.EntidadeId == parcela.Id);
        Assert.Equal(1, eventos); // não gravou de novo
    }

    [Fact]
    public async Task Cancelar_parcelaJaPaga_lanca()
    {
        var context = CreateInMemoryContext();
        var (usuarioId, _, contaId, parcelamento) = await SeedParcelamentoAsync(context);
        var parcela = parcelamento.Parcelas.First();
        var service = BuildService(context);

        await service.PagarAntecipadoAsync(parcela.Id, Pagar(contaId), usuarioId);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CancelarAsync(parcela.Id,
                new CancelarParcelaDto { Motivo = "tarde demais", IdempotencyKey = Guid.NewGuid().ToString() },
                usuarioId));
    }

    [Fact]
    public async Task Cancelar_motivoVazio_lanca()
    {
        var context = CreateInMemoryContext();
        var (usuarioId, _, _, parcelamento) = await SeedParcelamentoAsync(context);
        var parcela = parcelamento.Parcelas.First();
        var service = BuildService(context);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CancelarAsync(parcela.Id,
                new CancelarParcelaDto { Motivo = "", IdempotencyKey = Guid.NewGuid().ToString() },
                usuarioId));
    }
}
