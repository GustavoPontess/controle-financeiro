using System.Text;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class RelatorioServiceTests
{
    private static readonly DateTime DataBase = new(2026, 5, 20, 12, 0, 0, DateTimeKind.Utc);

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static async Task SeedTransacaoAsync(
        AppDbContext ctx,
        Guid usuarioId,
        string descricao,
        string categoriaDescricao = "Mercado",
        string contaNome = "Conta Corrente")
    {
        var conta = new Conta
        {
            Id = Guid.NewGuid(),
            Nome = contaNome,
            UsuarioIdProprietario = usuarioId,
            Tipo = TipoConta.ContaCorrente
        };

        var categoria = new Categoria
        {
            Id = Guid.NewGuid(),
            Descricao = categoriaDescricao,
            Finalidade = Finalidade.Despesa,
            UsuarioId = usuarioId
        };

        var transacao = new Transacao
        {
            Id = Guid.NewGuid(),
            ContaId = conta.Id,
            Conta = conta,
            CategoriaId = categoria.Id,
            Categoria = categoria,
            Descricao = descricao,
            Valor = 123.45m,
            Tipo = TipoTransacao.Despesa,
            Data = DateOnly.FromDateTime(DataBase),
            CriadoPor = usuarioId,
            MeioPagamento = MeioPagamento.Pix
        };

        ctx.Contas.Add(conta);
        ctx.Categorias.Add(categoria);
        ctx.Transacoes.Add(transacao);
        await ctx.SaveChangesAsync();
    }

    private static async Task<string> ExportarCsvAsync(AppDbContext ctx, Guid usuarioId)
    {
        var service = new RelatorioService(ctx);
        var bytes = await service.ExportarCsvAsync(usuarioId, DataBase.AddDays(-1), DataBase.AddDays(1));
        return Encoding.UTF8.GetString(bytes);
    }

    [Theory]
    [InlineData("=SOMA(1;1)", "\"'=SOMA(1;1)\"")]
    [InlineData("+SOMA(1;1)", "\"'+SOMA(1;1)\"")]
    [InlineData("-SOMA(1;1)", "\"'-SOMA(1;1)\"")]
    [InlineData("@SOMA(1;1)", "\"'@SOMA(1;1)\"")]
    public async Task ExportarCsvAsync_NeutralizaFormulaNaDescricao(string descricao, string esperado)
    {
        await using var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        await SeedTransacaoAsync(ctx, usuarioId, descricao);

        var csv = await ExportarCsvAsync(ctx, usuarioId);

        Assert.Contains(esperado, csv);
    }

    [Fact]
    public async Task ExportarCsvAsync_NeutralizaFormulaAposEspacoInicial()
    {
        await using var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        await SeedTransacaoAsync(ctx, usuarioId, "  =SOMA(1;1)");

        var csv = await ExportarCsvAsync(ctx, usuarioId);

        Assert.Contains("\"  '=SOMA(1;1)\"", csv);
    }

    [Fact]
    public async Task ExportarCsvAsync_NeutralizaFormulaEmCategoriaEConta()
    {
        await using var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        await SeedTransacaoAsync(ctx, usuarioId, "Compra", "=Categoria", "@Conta");

        var csv = await ExportarCsvAsync(ctx, usuarioId);

        Assert.Contains("\"'=Categoria\"", csv);
        Assert.Contains("\"'@Conta\"", csv);
    }

    [Fact]
    public async Task ExportarCsvAsync_PreservaTextoNormalEEscapaAspas()
    {
        await using var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        await SeedTransacaoAsync(ctx, usuarioId, "Mercado \"Centro\"");

        var csv = await ExportarCsvAsync(ctx, usuarioId);

        Assert.Contains("\"Mercado \"\"Centro\"\"\"", csv);
        Assert.DoesNotContain("\"'Mercado", csv);
    }

    [Fact]
    public async Task GetRelatorioPeriodo_ExcluiTransferenciaPagamentoESaldoInicial()
    {
        await using var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "CC", UsuarioIdProprietario = usuarioId, Tipo = TipoConta.ContaCorrente };
        var cat = new Categoria { Id = Guid.NewGuid(), Descricao = "Mercado", Finalidade = Finalidade.Despesa, UsuarioId = usuarioId };
        ctx.Contas.Add(conta);
        ctx.Categorias.Add(cat);

        Transacao Tx(string desc, decimal valor, TipoTransacao tipo, Action<Transacao>? cfg = null)
        {
            var t = new Transacao
            {
                Id = Guid.NewGuid(), ContaId = conta.Id, Descricao = desc, Valor = valor,
                Tipo = tipo, Data = DateOnly.FromDateTime(DataBase), CriadoPor = usuarioId,
            };
            cfg?.Invoke(t);
            return t;
        }

        ctx.Transacoes.AddRange(
            Tx("Compra mercado", 100m, TipoTransacao.Despesa, t => t.CategoriaId = cat.Id), // real
            Tx("Salário", 200m, TipoTransacao.Receita, t => t.CategoriaId = cat.Id),        // real
            Tx("Transf saída", 500m, TipoTransacao.Despesa, t => t.EhTransferencia = true), // fora
            Tx("Saldo Inicial", 9000m, TipoTransacao.Receita, t => t.EhSaldoInicial = true), // fora
            Tx("Pagamento fatura", 300m, TipoTransacao.Despesa, t => t.EhPagamentoFatura = true), // fora
            Tx("Cancelada", 50m, TipoTransacao.Despesa, t => { t.CategoriaId = cat.Id; t.Ativo = false; }), // fora
            Tx("Prevista", 70m, TipoTransacao.Despesa, t => { t.CategoriaId = cat.Id; t.StatusTransacao = StatusTransacao.Previsao; }), // fora
            Tx("Valor adicionado para Pix no Crédito", 132.50m, TipoTransacao.Receita, t => t.EhPixNoCredito = true), // fora
            Tx("Transferência enviada pelo Pix", 132.50m, TipoTransacao.Despesa, t => { t.CategoriaId = cat.Id; t.EhPixNoCredito = true; }), // fora
            Tx("Ajuste de reconciliação", 40m, TipoTransacao.Receita, t => t.EhAjusteReconciliacao = true) // fora
        );
        await ctx.SaveChangesAsync();

        var rel = await new RelatorioService(ctx)
            .GetRelatorioPeriodoAsync(usuarioId, DataBase.AddDays(-1), DataBase.AddDays(1));

        Assert.Equal(100m, rel.TotalDespesas);   // só a despesa real
        Assert.Equal(200m, rel.TotalReceitas);   // saldo inicial fora
        Assert.Equal(2, rel.TotalTransacoes);    // transferência/pagamento/saldo/cancelada/prevista/Pix no Crédito/ajuste fora
    }

    [Fact]
    public async Task GetRelatorioAsync_SaldoFimDoMes_EhOSaldoRealDasContas_ComOQueVinhaDeAntes()
    {
        // Caso real (dogfood 2026-10-09): abril saiu 916,58 a mais do que entrou, mas a conta terminou
        // com 17,15 porque vinha de março com 933,73. A linha do relatório tem que mostrar os 17,15.
        await using var ctx = CreateContext();
        var eu = Guid.NewGuid();
        var outro = Guid.NewGuid();
        Conta NovaConta(Guid dono, string nome) => new() { Id = Guid.NewGuid(), Nome = nome, UsuarioIdProprietario = dono, Tipo = TipoConta.ContaCorrente };
        var corrente = NovaConta(eu, "Corrente");
        var poupanca = NovaConta(eu, "Poupança");
        var alheia = NovaConta(outro, "Do outro");
        var cartao = new CartaoCredito { Id = Guid.NewGuid(), Nome = "Cartão", CriadoPor = eu, TemCredito = true };
        ctx.AddRange(corrente, poupanca, alheia, cartao);

        Transacao Tx(Conta? conta, decimal valor, TipoTransacao tipo, DateOnly data, Action<Transacao>? ajuste = null)
        {
            var t = new Transacao
            {
                Id = Guid.NewGuid(), Descricao = "x", Valor = valor, Tipo = tipo, Data = data,
                ContaId = conta?.Id, CriadoPor = eu, StatusTransacao = StatusTransacao.Executado,
            };
            ajuste?.Invoke(t);
            return t;
        }
        ctx.Transacoes.AddRange(
            Tx(corrente, 100m, TipoTransacao.Receita, new(2025, 12, 31), t => t.EhSaldoInicial = true), // antes do ano
            Tx(corrente, 833.73m, TipoTransacao.Receita, new(2026, 3, 10)),                         // março: 933,73
            Tx(corrente, 701.00m, TipoTransacao.Receita, new(2026, 4, 5)),
            Tx(corrente, 1617.58m, TipoTransacao.Despesa, new(2026, 4, 20)),                       // abril: 17,15
            Tx(corrente, 10m, TipoTransacao.Despesa, new(2026, 4, 21), t => t.EhTransferencia = true), // sai da corrente…
            Tx(poupanca, 10m, TipoTransacao.Receita, new(2026, 4, 21), t => t.EhTransferencia = true), // …entra na poupança
            Tx(corrente, 50m, TipoTransacao.Despesa, new(2026, 4, 22), t => t.StatusTransacao = StatusTransacao.Previsao), // fora
            Tx(corrente, 70m, TipoTransacao.Despesa, new(2026, 4, 23), t => t.Ativo = false),                // fora
            Tx(null, 300m, TipoTransacao.Despesa, new(2026, 4, 24), t => { t.CartaoCreditoId = cartao.Id; t.UsadoComoCredito = true; }), // cartão: fora
            Tx(alheia, 5000m, TipoTransacao.Receita, new(2026, 4, 25), t => t.CriadoPor = outro),             // de outro: fora
            // Pix no Crédito: entra e sai no mesmo dia — saldo intacto, fora de receitas/despesas.
            Tx(corrente, 132.50m, TipoTransacao.Receita, new(2026, 4, 26), t => t.EhPixNoCredito = true),
            Tx(corrente, 132.50m, TipoTransacao.Despesa, new(2026, 4, 26), t => t.EhPixNoCredito = true)
        );
        await ctx.SaveChangesAsync();

        var rel = await new RelatorioService(ctx).GetRelatorioAsync(eu, 2026);
        decimal Fim(int mes) => rel.EvolucaoMensal.Single(m => m.Mes == mes).SaldoFimDoMes;

        Assert.Equal(100m, Fim(1));      // só o que vinha de antes do ano
        Assert.Equal(933.73m, Fim(3));
        Assert.Equal(17.15m, Fim(4));    // nunca "−916": é o que ficou na conta
        Assert.Equal(17.15m, Fim(12));   // mês sem movimento repete o saldo
        var abril = rel.EvolucaoMensal.Single(m => m.Mes == 4);
        Assert.Equal(-916.58m, abril.Saldo); // resultado do mês segue disponível
        Assert.Equal(701m, abril.Receitas);  // a entrada do Pix no Crédito não é receita
        Assert.Equal(1917.58m, abril.Despesas); // 1617,58 da conta + 300 do cartão; o Pix pago pelo cartão não
    }

    [Fact]
    public async Task ExportarCsvAsync_NormalizaQuebrasDeLinhaSemCriarNovasLinhas()
    {
        await using var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        await SeedTransacaoAsync(ctx, usuarioId, "\r\n=HYPERLINK(\"http://example.test\")");

        var csv = await ExportarCsvAsync(ctx, usuarioId);
        var linhas = csv.Replace("\r\n", "\n").Split('\n', StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal(2, linhas.Length);
        Assert.Contains("\" '=HYPERLINK(\"\"http://example.test\"\")\"", csv);
    }
}
