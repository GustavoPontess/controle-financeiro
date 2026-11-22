using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Importacao;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Passo 2 de docs/features/cartao-credito/fatura-a-detalhar.md: o pagamento de fatura escrito de outros jeitos (cada
/// banco escreve de um) e o "Foi pagamento de cartão" da fila de pendentes.
/// </summary>
public class PagamentoDeCartaoTests
{
    [Theory]
    [InlineData("Pagamento de fatura", true)]
    [InlineData("PAGTO CARTAO CREDITO", true)]
    [InlineData("Pgto fatura cartão", true)]
    [InlineData("PAG FATURA NUBANK", true)]
    [InlineData("Deb Aut Fatura Cartão", true)]
    [InlineData("Pagamento cartão de crédito Itaú", true)]
    [InlineData("Pagamento com cartão de débito - Padaria", false)]
    [InlineData("Compra no cartão de débito", false)]
    [InlineData("Pix enviado - Fulana", false)]
    [InlineData("Pagamento de boleto - Luz", false)]
    [InlineData("Fatura da luz", false)]
    public void ReconhecePagamentoDeFatura(string descricao, bool esperado) =>
        Assert.Equal(esperado, ImportacaoService.EhPagamentoDeFatura(descricao));

    private sealed record Cenario(AppDbContext Ctx, ImportacaoService Servico, Guid U, Guid ContaId);

    private static Cenario Build()
    {
        var ctx = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        var u = Guid.NewGuid();
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Inter", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = u };
        ctx.Contas.Add(conta);
        ctx.SaveChanges();
        var transacoes = new TransacaoService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx));
        return new Cenario(ctx, new ImportacaoService(ctx, new ExtratoImportService(), transacoes), u, conta.Id);
    }

    private static Guid Saida(Cenario c, string descricao, Guid? contaId = null, TipoTransacao tipo = TipoTransacao.Despesa)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = descricao, Valor = 900m, Tipo = tipo, ContaId = contaId ?? c.ContaId,
            CriadoPor = c.U, Data = new DateOnly(2026, 11, 10), StatusTransacao = StatusTransacao.Executado, Ativo = true,
        };
        c.Ctx.Transacoes.Add(t);
        c.Ctx.SaveChanges();
        return t.Id;
    }

    [Fact]
    public async Task FoiPagamentoDeCartao_SaiDosPendentesEViraCartaoADetalhar()
    {
        var c = Build();
        var id = Saida(c, "TED BANCO X CC 1234");
        Saida(c, "Mercado");

        var r = await c.Servico.MarcarPagamentoDeCartaoAsync(c.U, new PagamentoDeCartaoDto([id]));

        Assert.Equal((1, 1), (r.Categorizados, r.Restam));
        var t = c.Ctx.Transacoes.Single(x => x.Id == id);
        Assert.True(t.EhPagamentoFatura);
        Assert.Null(t.CategoriaId);
        var aDetalhar = (await RegrasFinanceiras.GastosPorCategoriaDoMesAsync(c.Ctx, c.U, 2026, 11))
            .GetValueOrDefault(RegrasFinanceiras.CartaoADetalhar).Gasto;
        Assert.Equal(900m, aDetalhar);
    }

    [Fact]
    public async Task SoSaidaPendenteDaPropriaConta_SenaoNadaMuda()
    {
        var c = Build();
        var minha = Saida(c, "TED");
        var entrada = Saida(c, "Salário", tipo: TipoTransacao.Receita);
        var outraConta = new Conta { Id = Guid.NewGuid(), Nome = "Dele", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = Guid.NewGuid() };
        c.Ctx.Contas.Add(outraConta);
        c.Ctx.SaveChanges();
        var deOutro = Saida(c, "TED", outraConta.Id);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => c.Servico.MarcarPagamentoDeCartaoAsync(c.U, new PagamentoDeCartaoDto([minha, deOutro])));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => c.Servico.MarcarPagamentoDeCartaoAsync(c.U, new PagamentoDeCartaoDto([entrada])));
        Assert.False(c.Ctx.Transacoes.Single(x => x.Id == minha).EhPagamentoFatura);
    }
}
