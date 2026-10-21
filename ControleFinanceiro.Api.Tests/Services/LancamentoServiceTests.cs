using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Transacao;
using ControleFinanceiro.Api.DTOs.Transferencia;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Edição completa do lançamento (o mesmo formulário de criar vale pra editar): troca de conta/cartão/status no
/// lugar; virar transferência, conta fixa ou parcelado cancela o antigo e cria o novo; idempotência ao editar e
/// ao criar transação/transferência.
/// </summary>
public class LancamentoServiceTests
{
    private const int DiaFechamento = 10;
    private const int DiaVencimento = 17;

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private sealed record Cenario(AppDbContext Ctx, LancamentoService Svc, TransacaoService Transacoes, TransferenciaService Transferencias,
        Guid UsuarioId, Guid ContaA, Guid ContaB, Guid CartaoId);

    private static async Task<Cenario> Build()
    {
        var ctx = CreateContext();
        var faturas = new FaturaService(ctx);
        var log = new FinancialEventLogService(ctx);
        var transacoes = new TransacaoService(ctx, faturas, log);
        var transferencias = new TransferenciaService(ctx);
        var parcelamentos = new ParcelamentoService(ctx, log, new LimiteCalculatorService(ctx), faturas);
        var svc = new LancamentoService(ctx, transacoes, transferencias, new RecorrenteService(ctx, faturas, log), parcelamentos, log);

        var usuarioId = Guid.NewGuid();
        var contaA = new Conta { Id = Guid.NewGuid(), Nome = "Conta A", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuarioId };
        var contaB = new Conta { Id = Guid.NewGuid(), Nome = "Conta B", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuarioId };
        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Cartão", TemCredito = true, LimiteTotal = 10_000,
            DiaFechamento = DiaFechamento, DiaVencimento = DiaVencimento, CriadoPor = usuarioId, Ativo = true,
        };
        ctx.Contas.AddRange(contaA, contaB);
        ctx.CartoesCredito.Add(cartao);
        await ctx.SaveChangesAsync();
        return new Cenario(ctx, svc, transacoes, transferencias, usuarioId, contaA.Id, contaB.Id, cartao.Id);
    }

    private static DateOnly Hoje => HorarioBrasil.Hoje();

    private static async Task<Transacao> SeedDespesaEmConta(Cenario c, decimal valor = 100m, StatusTransacao status = StatusTransacao.Executado, DateOnly? data = null)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Mercado", Valor = valor, Tipo = TipoTransacao.Despesa,
            ContaId = c.ContaA, CriadoPor = c.UsuarioId, Data = data ?? Hoje, Hora = new TimeOnly(10, 0),
            StatusTransacao = status, MeioPagamento = MeioPagamento.Pix,
        };
        c.Ctx.Transacoes.Add(t);
        await c.Ctx.SaveChangesAsync();
        return t;
    }

    private static async Task<Transacao> SeedCompraNoCartao(Cenario c, decimal valor = 100m)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Compra", Valor = valor, Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = c.CartaoId, UsadoComoCredito = true, MeioPagamento = MeioPagamento.Credito,
            CriadoPor = c.UsuarioId, Data = Hoje, StatusTransacao = StatusTransacao.Executado,
        };
        return await c.Transacoes.CriarTransacaoAsync(t, c.UsuarioId);
    }

    private static EditarLancamentoDto DtoDe(Transacao t) => new()
    {
        Descricao = t.Descricao, Valor = t.Valor, Tipo = (int)t.Tipo, CategoriaId = t.CategoriaId,
        ContaId = t.ContaId, CartaoCreditoId = t.CartaoCreditoId, MeioPagamento = t.MeioPagamento.HasValue ? (int)t.MeioPagamento : null,
        Data = t.Data, Hora = t.Hora,
    };

    private static Task<Transacao?> Original(Cenario c, Guid id) =>
        c.Ctx.Transacoes.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);

    // ── no lugar ────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Editar_TrocaDeConta_MudaNoLugarEMantemOId()
    {
        var c = await Build();
        var t = await SeedDespesaEmConta(c);
        var dto = DtoDe(t);
        dto.ContaId = c.ContaB;
        dto.Descricao = "Mercado (conta B)";

        var r = await c.Svc.EditarAsync(t.Id, dto, c.UsuarioId);

        Assert.Equal(EdicaoLancamentoResultadoDto.TipoTransacao, r.Tipo);
        Assert.Equal(t.Id, r.Id);
        var salva = await Original(c, t.Id);
        Assert.Equal(c.ContaB, salva!.ContaId);
        Assert.Equal("Mercado (conta B)", salva.Descricao);
        Assert.True(salva.Ativo);
    }

    [Fact]
    public async Task Editar_ContaParaCartao_ViraCompraNoCreditoDentroDaFatura()
    {
        var c = await Build();
        var t = await SeedDespesaEmConta(c);
        var dto = DtoDe(t);
        dto.ContaId = null;
        dto.CartaoCreditoId = c.CartaoId;
        dto.MeioPagamento = (int)MeioPagamento.Credito;

        await c.Svc.EditarAsync(t.Id, dto, c.UsuarioId);

        var salva = await Original(c, t.Id);
        Assert.Null(salva!.ContaId);
        Assert.Equal(c.CartaoId, salva.CartaoCreditoId);
        Assert.True(salva.UsadoComoCredito);
        Assert.NotNull(salva.FaturaId);
        Assert.Equal(StatusTransacao.Executado, salva.StatusTransacao);
        Assert.Equal(MeioPagamento.Credito, salva.MeioPagamento);
    }

    [Fact]
    public async Task Editar_CartaoParaConta_SaiDaFatura()
    {
        var c = await Build();
        var t = await SeedCompraNoCartao(c);
        Assert.NotNull(t.FaturaId);
        var dto = DtoDe(t);
        dto.CartaoCreditoId = null;
        dto.ContaId = c.ContaA;
        dto.MeioPagamento = (int)MeioPagamento.Pix;

        await c.Svc.EditarAsync(t.Id, dto, c.UsuarioId);

        var salva = await Original(c, t.Id);
        Assert.Equal(c.ContaA, salva!.ContaId);
        Assert.Null(salva.CartaoCreditoId);
        Assert.Null(salva.FaturaId);
        Assert.False(salva.UsadoComoCredito);
        Assert.Equal(MeioPagamento.Pix, salva.MeioPagamento);
    }

    [Fact]
    public async Task Editar_PrevisaoViraEfetivado_NaoAceitaDataFutura()
    {
        var c = await Build();
        var t = await SeedDespesaEmConta(c, status: StatusTransacao.Previsao, data: Hoje.AddDays(5));
        var dto = DtoDe(t);
        dto.Efetivado = true;

        await Assert.ThrowsAsync<ArgumentException>(() => c.Svc.EditarAsync(t.Id, dto, c.UsuarioId));
        Assert.Equal(StatusTransacao.Previsao, (await Original(c, t.Id))!.StatusTransacao);
    }

    [Fact]
    public async Task Editar_EfetivadoViraPrevisao_PermiteDataFutura()
    {
        var c = await Build();
        var t = await SeedDespesaEmConta(c);
        var dto = DtoDe(t);
        dto.Efetivado = false;
        dto.Data = Hoje.AddDays(5);

        await c.Svc.EditarAsync(t.Id, dto, c.UsuarioId);

        var salva = await Original(c, t.Id);
        Assert.Equal(StatusTransacao.Previsao, salva!.StatusTransacao);
        Assert.Equal(Hoje.AddDays(5), salva.Data);
    }

    [Fact]
    public async Task Editar_SemOrigemNemStatus_MantemOsDois_AppAtualContinuaFuncionando()
    {
        var c = await Build();
        var t = await SeedDespesaEmConta(c, status: StatusTransacao.Previsao, data: Hoje.AddDays(3));
        var dto = new EditarLancamentoDto { Descricao = "Só o texto", Valor = 80m, Tipo = 1, Data = t.Data, MeioPagamento = (int)MeioPagamento.Pix };

        await c.Svc.EditarAsync(t.Id, dto, c.UsuarioId);

        var salva = await Original(c, t.Id);
        Assert.Equal("Só o texto", salva!.Descricao);
        Assert.Equal(80m, salva.Valor);
        Assert.Equal(c.ContaA, salva.ContaId);
        Assert.Equal(StatusTransacao.Previsao, salva.StatusTransacao);
    }

    // ── vira outro registro (tudo ou nada) ──────────────────────────────────────────────────────────

    [Fact]
    public async Task Editar_ViraTransferencia_CancelaOAntigoECriaAsDuasPernas()
    {
        var c = await Build();
        var t = await SeedDespesaEmConta(c, 250m);
        var dto = DtoDe(t);
        dto.Transferencia = new TransferenciaDoLancamentoDto { ContaOrigemId = c.ContaA, ContaDestinoId = c.ContaB };

        var r = await c.Svc.EditarAsync(t.Id, dto, c.UsuarioId);

        Assert.Equal(EdicaoLancamentoResultadoDto.TipoTransferencia, r.Tipo);
        var antiga = await Original(c, t.Id);
        Assert.False(antiga!.Ativo);
        Assert.Equal(StatusTransacao.Cancelado, antiga.StatusTransacao);
        var transferencia = await c.Ctx.Transferencias.SingleAsync(x => x.Id == r.Id);
        Assert.Equal(250m, transferencia.Valor);
        var pernas = await c.Ctx.Transacoes.Where(x => x.EhTransferencia).ToListAsync();
        Assert.Equal(2, pernas.Count);
        Assert.Contains(pernas, p => p.ContaId == c.ContaA && p.Tipo == TipoTransacao.Despesa);
        Assert.Contains(pernas, p => p.ContaId == c.ContaB && p.Tipo == TipoTransacao.Receita);
    }

    [Fact]
    public async Task Editar_ViraContaFixa_CancelaOAntigoECriaARecorrente()
    {
        var c = await Build();
        var t = await SeedDespesaEmConta(c, 59.90m);
        var dto = DtoDe(t);
        dto.ContaFixa = new ContaFixaDoLancamentoDto { Frequencia = (int)FrequenciaRecorrencia.Mensal };

        var r = await c.Svc.EditarAsync(t.Id, dto, c.UsuarioId);

        Assert.Equal(EdicaoLancamentoResultadoDto.TipoContaFixa, r.Tipo);
        Assert.False((await Original(c, t.Id))!.Ativo);
        var recorrente = await c.Ctx.Recorrentes.SingleAsync(x => x.Id == r.Id);
        Assert.Equal(59.90m, recorrente.Valor);
        Assert.Equal(c.ContaA, recorrente.ContaId);
        Assert.Equal(FrequenciaRecorrencia.Mensal, recorrente.Frequencia);
        Assert.True(await c.Ctx.Transacoes.AnyAsync(x => x.RecorrenteOrigemId == r.Id), "a conta fixa gera as previsões");
    }

    [Fact]
    public async Task Editar_ViraParcelado_CancelaOAntigoECriaUmParcelamentoDeVerdade()
    {
        var c = await Build();
        var t = await SeedDespesaEmConta(c, 300m);
        var dto = DtoDe(t);
        dto.ContaId = null;
        dto.CartaoCreditoId = c.CartaoId;
        dto.MeioPagamento = (int)MeioPagamento.Credito;
        dto.Parcelas = 3;

        var r = await c.Svc.EditarAsync(t.Id, dto, c.UsuarioId);

        Assert.Equal(EdicaoLancamentoResultadoDto.TipoParcelamento, r.Tipo);
        Assert.False((await Original(c, t.Id))!.Ativo);
        // Um parcelamento (o resultado aponta pra ele), 3 parcelas nas faturas e nenhum lançamento solto no cartão.
        var p = await c.Ctx.Parcelamentos.Include(x => x.Parcelas).SingleAsync();
        Assert.Equal(p.Id, r.Id);
        Assert.Equal(("Mercado", 300m, 3), (p.Descricao, p.ValorTotal, p.QuantidadeParcelas));
        Assert.Equal(3, p.Parcelas.Count);
        Assert.All(p.Parcelas, x => Assert.NotEqual(Guid.Empty, x.FaturaId));
        Assert.False(await c.Ctx.Transacoes.AnyAsync(x => x.CartaoCreditoId == c.CartaoId));
    }

    [Fact]
    public async Task Editar_ParcelaDoModuloDeParcelamentos_NaoViraOutroTipoNemMudaDeOrigem()
    {
        var c = await Build();
        // Parcela do módulo novo (Parcelamento + ParcelaTransacao): ligada ao grupo, não vira outra coisa.
        var parcelamento = new Parcelamento
        {
            Id = Guid.NewGuid(), CriadoPor = c.UsuarioId, Descricao = "TV", DataCompra = DateTime.UtcNow,
            ValorTotal = 900m, QuantidadeParcelas = 3, CartaoCreditoId = c.CartaoId, Ativo = true,
        };
        var parcela = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "TV (1/3)", Valor = 300m, Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = c.CartaoId, UsadoComoCredito = true, MeioPagamento = MeioPagamento.Credito,
            CriadoPor = c.UsuarioId, Data = Hoje, ParcelamentoId = parcelamento.Id,
        };
        c.Ctx.Parcelamentos.Add(parcelamento);
        c.Ctx.Transacoes.Add(parcela);
        await c.Ctx.SaveChangesAsync();

        var viraTransferencia = DtoDe(parcela);
        viraTransferencia.Transferencia = new TransferenciaDoLancamentoDto { ContaOrigemId = c.ContaA, ContaDestinoId = c.ContaB };
        await Assert.ThrowsAsync<ArgumentException>(() => c.Svc.EditarAsync(parcela.Id, viraTransferencia, c.UsuarioId));

        var mudaDeOrigem = DtoDe(parcela);
        mudaDeOrigem.CartaoCreditoId = null;
        mudaDeOrigem.ContaId = c.ContaA;
        await Assert.ThrowsAsync<ArgumentException>(() => c.Svc.EditarAsync(parcela.Id, mudaDeOrigem, c.UsuarioId));

        var salva = await Original(c, parcela.Id);
        Assert.True(salva!.Ativo);
        Assert.Equal(c.CartaoId, salva.CartaoCreditoId);
    }

    [Fact]
    public async Task Editar_PernaDeTransferencia_Recusa()
    {
        var c = await Build();
        var tr = await c.Transferencias.CriarAsync(new CriarTransferenciaDto
        {
            ContaOrigemId = c.ContaA, ContaDestinoId = c.ContaB, Valor = 10m, Data = Hoje, Descricao = "Reserva",
        }, c.UsuarioId);
        var perna = await c.Ctx.Transacoes.FirstAsync(x => x.EhTransferencia);
        var dto = DtoDe(perna);
        dto.Descricao = "Outra coisa";

        await Assert.ThrowsAsync<InvalidOperationException>(() => c.Svc.EditarAsync(perna.Id, dto, c.UsuarioId));
        Assert.NotNull(await c.Ctx.Transferencias.FindAsync(tr.Id));
    }

    [Fact]
    public async Task Editar_DeOutroUsuario_404()
    {
        var c = await Build();
        var t = await SeedDespesaEmConta(c);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => c.Svc.EditarAsync(t.Id, DtoDe(t), Guid.NewGuid()));
    }

    // ── idempotência ────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Editar_MesmaChave_DevolveOMesmoResultadoSemRepetirAConversao()
    {
        var c = await Build();
        var t = await SeedDespesaEmConta(c, 250m);
        var dto = DtoDe(t);
        dto.Transferencia = new TransferenciaDoLancamentoDto { ContaOrigemId = c.ContaA, ContaDestinoId = c.ContaB };
        var chave = Guid.NewGuid().ToString();

        var primeira = await c.Svc.EditarAsync(t.Id, dto, c.UsuarioId, chave);
        var segunda = await c.Svc.EditarAsync(t.Id, dto, c.UsuarioId, chave);

        Assert.Equal(primeira.Id, segunda.Id);
        Assert.Equal(1, await c.Ctx.Transferencias.CountAsync());
        Assert.Equal(2, await c.Ctx.Transacoes.CountAsync(x => x.EhTransferencia));
    }

    [Fact]
    public async Task Editar_MesmaChaveComOutrosDados_409()
    {
        var c = await Build();
        var t = await SeedDespesaEmConta(c);
        var dto = DtoDe(t);
        dto.Descricao = "Primeira";
        var chave = Guid.NewGuid().ToString();
        await c.Svc.EditarAsync(t.Id, dto, c.UsuarioId, chave);

        dto.Descricao = "Outra";
        await Assert.ThrowsAsync<InvalidOperationException>(() => c.Svc.EditarAsync(t.Id, dto, c.UsuarioId, chave));
    }

    [Fact]
    public async Task CriarTransacao_MesmaChave_NaoLancaDuasVezes()
    {
        var c = await Build();
        var chave = Guid.NewGuid().ToString();
        Transacao Pedido() => new()
        {
            Id = Guid.NewGuid(), Descricao = "Café", Valor = 7m, Tipo = TipoTransacao.Despesa,
            ContaId = c.ContaA, Data = Hoje, MeioPagamento = MeioPagamento.Pix,
        };

        var primeira = await c.Transacoes.CriarTransacaoAsync(Pedido(), c.UsuarioId, chave);
        var segunda = await c.Transacoes.CriarTransacaoAsync(Pedido(), c.UsuarioId, chave);

        Assert.Equal(primeira.Id, segunda.Id);
        Assert.Equal(1, await c.Ctx.Transacoes.CountAsync());
    }

    [Fact]
    public async Task CriarTransacao_MesmaChaveComOutroValor_409()
    {
        var c = await Build();
        var chave = Guid.NewGuid().ToString();
        await c.Transacoes.CriarTransacaoAsync(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Café", Valor = 7m, Tipo = TipoTransacao.Despesa, ContaId = c.ContaA, Data = Hoje,
        }, c.UsuarioId, chave);

        await Assert.ThrowsAsync<InvalidOperationException>(() => c.Transacoes.CriarTransacaoAsync(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Café", Valor = 70m, Tipo = TipoTransacao.Despesa, ContaId = c.ContaA, Data = Hoje,
        }, c.UsuarioId, chave));
        Assert.Equal(1, await c.Ctx.Transacoes.CountAsync());
    }

    [Fact]
    public async Task CriarTransferencia_MesmaChave_NaoMoveODinheiroDuasVezes()
    {
        var c = await Build();
        var chave = Guid.NewGuid().ToString();
        CriarTransferenciaDto Pedido() => new() { ContaOrigemId = c.ContaA, ContaDestinoId = c.ContaB, Valor = 50m, Data = Hoje, Descricao = "Reserva" };

        var primeira = await c.Transferencias.CriarAsync(Pedido(), c.UsuarioId, chave);
        var segunda = await c.Transferencias.CriarAsync(Pedido(), c.UsuarioId, chave);

        Assert.Equal(primeira.Id, segunda.Id);
        Assert.Equal(1, await c.Ctx.Transferencias.CountAsync());
        Assert.Equal(2, await c.Ctx.Transacoes.CountAsync());
    }
}
