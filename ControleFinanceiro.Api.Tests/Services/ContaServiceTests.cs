using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class ContaServiceTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task CriarAsync_NomeVazio_LancaException()
    {
        var ctx = CreateContext();
        var svc = new ContaService(ctx);
        var usuarioId = Guid.NewGuid();

        var conta = new Conta { Nome = "", Tipo = TipoConta.ContaCorrente };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(conta, usuarioId));
        Assert.Contains("Nome", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_NomeMuitoLongo_LancaException()
    {
        var ctx = CreateContext();
        var svc = new ContaService(ctx);
        var usuarioId = Guid.NewGuid();

        var conta = new Conta { Nome = new string('A', 101), Tipo = TipoConta.ContaCorrente };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(conta, usuarioId));
        Assert.Contains("100", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_SaldoInicialNegativo_LancaException()
    {
        var ctx = CreateContext();
        var svc = new ContaService(ctx);
        var usuarioId = Guid.NewGuid();

        var conta = new Conta { Nome = "Conta Teste", Tipo = TipoConta.ContaCorrente };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(conta, usuarioId, saldoInicial: -100));
        Assert.Contains("negativo", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_SaldoInicialPositivo_CriaTransacaoReceita()
    {
        var ctx = CreateContext();
        var svc = new ContaService(ctx);
        var usuarioId = Guid.NewGuid();

        var conta = new Conta { Nome = "Conta Poupança", Tipo = TipoConta.ContaPoupanca };

        await svc.CriarAsync(conta, usuarioId, saldoInicial: 1000);

        var transacoes = await ctx.Transacoes.Where(t => t.ContaId == conta.Id).ToListAsync();
        Assert.Single(transacoes);
        Assert.Equal(1000, transacoes[0].Valor);
        Assert.Equal(TipoTransacao.Receita, transacoes[0].Tipo);
        Assert.Equal("Saldo Inicial", transacoes[0].Descricao);
    }

    [Fact]
    public async Task CriarAsync_SaldoZero_NaoCriaTransacao()
    {
        var ctx = CreateContext();
        var svc = new ContaService(ctx);
        var usuarioId = Guid.NewGuid();

        var conta = new Conta { Nome = "Conta Simples", Tipo = TipoConta.ContaCorrente };

        await svc.CriarAsync(conta, usuarioId, saldoInicial: 0);

        Assert.Equal(0, await ctx.Transacoes.CountAsync());
    }

    [Fact]
    public async Task CriarAsync_DadosValidos_DefineProprietario()
    {
        var ctx = CreateContext();
        var svc = new ContaService(ctx);
        var usuarioId = Guid.NewGuid();

        var conta = new Conta { Nome = "Minha Conta", Tipo = TipoConta.ContaCorrente };

        var resultado = await svc.CriarAsync(conta, usuarioId);

        Assert.Equal(usuarioId, resultado.UsuarioIdProprietario);
        Assert.NotEqual(Guid.Empty, resultado.Id);
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("00-01")]
    [InlineData("0001a")]
    public async Task CriarAsync_AgenciaComLetras_LancaException(string agencia)
    {
        var ctx = CreateContext();
        var svc = new ContaService(ctx);
        var usuarioId = Guid.NewGuid();

        var conta = new Conta { Nome = "Conta Teste", Tipo = TipoConta.ContaCorrente, Agencia = agencia };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(conta, usuarioId));
        Assert.Contains("Agência", ex.Message);
    }

    [Theory]
    [InlineData("abc-5")]
    [InlineData("91205195-55")]
    [InlineData("912.051.955")]
    public async Task CriarAsync_NumeroContaFormatoInvalido_LancaException(string numeroConta)
    {
        var ctx = CreateContext();
        var svc = new ContaService(ctx);
        var usuarioId = Guid.NewGuid();

        var conta = new Conta { Nome = "Conta Teste", Tipo = TipoConta.ContaCorrente, NumeroConta = numeroConta };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(conta, usuarioId));
        Assert.Contains("Número da conta", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_AgenciaENumeroContaValidos_Persiste()
    {
        var ctx = CreateContext();
        var svc = new ContaService(ctx);
        var usuarioId = Guid.NewGuid();

        var conta = new Conta
        {
            Nome = "Conta Teste", Tipo = TipoConta.ContaCorrente,
            Agencia = "0001", NumeroConta = "91205195-5",
        };

        var resultado = await svc.CriarAsync(conta, usuarioId);

        Assert.Equal("0001", resultado.Agencia);
        Assert.Equal("91205195-5", resultado.NumeroConta);
    }

    [Fact]
    public async Task AtualizarAsync_AgenciaInvalida_LancaExceptionSemPersistir()
    {
        var ctx = CreateContext();
        var svc = new ContaService(ctx);
        var usuarioId = Guid.NewGuid();

        var conta = new Conta { Nome = "Conta Teste", Tipo = TipoConta.ContaCorrente };
        var criada = await svc.CriarAsync(conta, usuarioId);

        var atualizacao = new Conta { Nome = "Conta Teste", Tipo = TipoConta.ContaCorrente, Agencia = "abcd" };

        await Assert.ThrowsAsync<ArgumentException>(() => svc.AtualizarAsync(criada.Id, atualizacao, usuarioId));

        var doBanco = await ctx.Contas.FindAsync(criada.Id);
        Assert.Null(doBanco!.Agencia);
    }

    [Fact]
    public async Task DeletarAsync_CarteiraNaoPodeSerDeletada_LancaException()
    {
        var ctx = CreateContext();
        var svc = new ContaService(ctx);
        var usuarioId = Guid.NewGuid();

        var carteira = new Conta
        {
            Id = Guid.NewGuid(),
            Nome = "Carteira",
            Tipo = TipoConta.ContaCorrente,
            IsCarteira = true,
            UsuarioIdProprietario = usuarioId,
        };
        ctx.Contas.Add(carteira);
        await ctx.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => svc.DeletarAsync(carteira.Id, usuarioId));
        Assert.Contains("carteira", ex.Message.ToLower());
    }
}
