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

    // ContaService agora depende do FinancialEventLogService (audit de saldo inicial). Usa o real sobre o
    // mesmo contexto: Registrar só enfileira no contexto e o SaveChanges do service persiste junto.
    private static ContaService CriarService(AppDbContext ctx) => new(ctx, new FinancialEventLogService(ctx));

    // Transacao.Data agora é DateOnly (o DIA, sem fuso) + Hora TimeOnly? (null = sem hora).
    private static DateOnly Hoje => DateOnly.FromDateTime(DateTime.UtcNow);

    [Fact]
    public async Task CriarAsync_NomeVazio_LancaException()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();

        var conta = new Conta { Nome = "", Tipo = TipoConta.ContaCorrente };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(conta, usuarioId));
        Assert.Contains("Nome", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_NomeMuitoLongo_LancaException()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();

        var conta = new Conta { Nome = new string('A', 101), Tipo = TipoConta.ContaCorrente };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(conta, usuarioId));
        Assert.Contains("100", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_SaldoInicialNegativo_LancaException()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();

        var conta = new Conta { Nome = "Conta Teste", Tipo = TipoConta.ContaCorrente };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(conta, usuarioId, saldoInicial: -100));
        Assert.Contains("negativo", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_SaldoInicialPositivo_CriaTransacaoReceita()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();

        var conta = new Conta { Nome = "Conta Poupança", Tipo = TipoConta.ContaPoupanca };

        await svc.CriarAsync(conta, usuarioId, saldoInicial: 1000);

        var transacoes = await ctx.Transacoes.Where(t => t.ContaId == conta.Id).ToListAsync();
        Assert.Single(transacoes);
        Assert.Equal(1000, transacoes[0].Valor);
        Assert.Equal(TipoTransacao.Receita, transacoes[0].Tipo);
        Assert.Equal("Saldo Inicial", transacoes[0].Descricao);
    }

    // --- Saldo inicial com DATA de abertura: a transação EhSaldoInicial é gravada no DIA escolhido, SEM hora
    // (Hora = null → baseline da reconciliação fica antes dos lançamentos daquele dia, inclusive retroativos).

    [Fact]
    public async Task CriarAsync_DataSaldoInicialInformada_GravaODiaEscolhidoSemHora()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var conta = new Conta { Nome = "Conta Retroativa", Tipo = TipoConta.ContaCorrente };
        // 30 dias atrás, com hora no meio da tarde de propósito: o service guarda só o DIA (Hora = null).
        var dataAbertura = DateTime.UtcNow.Date.AddDays(-30).AddHours(15).AddMinutes(30);

        await svc.CriarAsync(conta, usuarioId, saldoInicial: 1000, dataSaldoInicial: dataAbertura);

        var saldoInicial = await ctx.Transacoes.SingleAsync(t => t.ContaId == conta.Id && t.EhSaldoInicial);
        Assert.Equal(DateOnly.FromDateTime(dataAbertura), saldoInicial.Data);
        Assert.Null(saldoInicial.Hora);
        Assert.Equal(1000, saldoInicial.Valor);
        Assert.Equal(TipoTransacao.Receita, saldoInicial.Tipo);
    }

    [Fact]
    public async Task CriarAsync_DataSaldoInicialNula_UsaHojeSemHora()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var conta = new Conta { Nome = "Conta Hoje", Tipo = TipoConta.ContaCorrente };

        // Janela [antes, depois] em vez de comparar com "hoje" solto: o teste não quebra se
        // virar a meia-noite UTC entre a chamada e a asserção.
        var antes = Hoje;
        await svc.CriarAsync(conta, usuarioId, saldoInicial: 500, dataSaldoInicial: null);
        var depois = Hoje;

        var saldoInicial = await ctx.Transacoes.SingleAsync(t => t.ContaId == conta.Id && t.EhSaldoInicial);
        Assert.InRange(saldoInicial.Data, antes, depois);
        Assert.Null(saldoInicial.Hora);
    }

    [Fact]
    public async Task CriarAsync_DataSaldoInicialHoje_EhAceita()
    {
        // Fronteira da regra "não pode ser futura": hoje é permitido (só > hoje é recusado).
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var conta = new Conta { Nome = "Conta Hoje Explicito", Tipo = TipoConta.ContaCorrente };

        await svc.CriarAsync(conta, usuarioId, saldoInicial: 200, dataSaldoInicial: DateTime.UtcNow.Date);

        Assert.Equal(1, await ctx.Transacoes.CountAsync(t => t.ContaId == conta.Id && t.EhSaldoInicial));
    }

    [Fact]
    public async Task CriarAsync_DataSaldoInicialFutura_LancaExceptionSemPersistirNada()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var conta = new Conta { Nome = "Conta Futura", Tipo = TipoConta.ContaCorrente };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.CriarAsync(conta, usuarioId, saldoInicial: 1000, dataSaldoInicial: DateTime.UtcNow.Date.AddDays(1)));

        Assert.Contains("futura", ex.Message);
        // A recusa vem antes de qualquer gravação: nem conta órfã, nem transação de saldo inicial.
        Assert.Equal(0, await ctx.Contas.CountAsync());
        Assert.Equal(0, await ctx.Transacoes.CountAsync());
    }

    [Fact]
    public async Task CriarAsync_SaldoZeroComDataInformada_NaoCriaTransacao()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var conta = new Conta { Nome = "Conta Sem Saldo", Tipo = TipoConta.ContaCorrente };

        await svc.CriarAsync(conta, usuarioId, saldoInicial: 0, dataSaldoInicial: DateTime.UtcNow.Date.AddDays(-10));

        Assert.Equal(0, await ctx.Transacoes.CountAsync());
    }

    [Fact]
    public async Task CriarAsync_SaldoZero_NaoCriaTransacao()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();

        var conta = new Conta { Nome = "Conta Simples", Tipo = TipoConta.ContaCorrente };

        await svc.CriarAsync(conta, usuarioId, saldoInicial: 0);

        Assert.Equal(0, await ctx.Transacoes.CountAsync());
    }

    [Fact]
    public async Task CriarAsync_DadosValidos_DefineProprietario()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
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
        var svc = CriarService(ctx);
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
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();

        var conta = new Conta { Nome = "Conta Teste", Tipo = TipoConta.ContaCorrente, NumeroConta = numeroConta };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(conta, usuarioId));
        Assert.Contains("Número da conta", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_AgenciaENumeroContaValidos_Persiste()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
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
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();

        var conta = new Conta { Nome = "Conta Teste", Tipo = TipoConta.ContaCorrente };
        var criada = await svc.CriarAsync(conta, usuarioId);

        var atualizacao = new Conta { Nome = "Conta Teste", Tipo = TipoConta.ContaCorrente, Agencia = "abcd" };

        await Assert.ThrowsAsync<ArgumentException>(() => svc.AtualizarAsync(criada.Id, atualizacao, usuarioId));

        var doBanco = await ctx.Contas.FindAsync(criada.Id);
        Assert.Null(doBanco!.Agencia);
    }

    // --- AtualizarSaldoInicialAsync: edição do saldo inicial (ponto de partida) direto na Reconciliação.
    // É dinheiro: valida dono (404, sem vazar existência), valor > 0, data não futura (início do dia) e
    // registra o evento financeiro (TransacaoAtualizada ao editar / TransacaoCriada ao criar). Grava só o DIA
    // (Data = DateOnly) e sempre com Hora = null: saldo inicial é datado, não tem horário.

    private static async Task<(Conta Conta, Transacao SaldoInicial)> SeedContaComSaldoInicialAsync(
        AppDbContext ctx, Guid usuarioId, decimal valor, DateOnly data, bool ativo = true, TimeOnly? hora = null)
    {
        var conta = new Conta
        {
            Id = Guid.NewGuid(),
            Nome = "Conta Corrente",
            Tipo = TipoConta.ContaCorrente,
            UsuarioIdProprietario = usuarioId,
        };
        var saldoInicial = new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = "Saldo Inicial",
            Valor = valor,
            Tipo = TipoTransacao.Receita,
            ContaId = conta.Id,
            CriadoPor = usuarioId,
            Data = data,
            Hora = hora,
            EhSaldoInicial = true,
            Ativo = ativo,
        };
        ctx.Contas.Add(conta);
        ctx.Transacoes.Add(saldoInicial);
        await ctx.SaveChangesAsync();
        return (conta, saldoInicial);
    }

    [Fact]
    public async Task AtualizarSaldoInicialAsync_ExistenteComData_AtualizaValorEDataELimpaAHora()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        // O saldo inicial de partida TEM hora (15:30) de propósito: editar tem que limpar (Hora = null).
        var (conta, original) = await SeedContaComSaldoInicialAsync(
            ctx, usuarioId, 1000m, Hoje.AddDays(-5), hora: new TimeOnly(15, 30));
        var novaData = Hoje.AddDays(-20);

        await svc.AtualizarSaldoInicialAsync(conta.Id, usuarioId, 2500.75m, novaData);

        // Atualiza a MESMA transação (não duplica o saldo inicial).
        var saldoInicial = await ctx.Transacoes.SingleAsync(t => t.ContaId == conta.Id && t.EhSaldoInicial);
        Assert.Equal(original.Id, saldoInicial.Id);
        Assert.Equal(2500.75m, saldoInicial.Valor);
        Assert.Equal(novaData, saldoInicial.Data);
        Assert.Null(saldoInicial.Hora);
        Assert.True(saldoInicial.Ativo);
        Assert.Equal(TipoTransacao.Receita, saldoInicial.Tipo);
    }

    [Fact]
    public async Task AtualizarSaldoInicialAsync_DataNula_MantemADataAtualEMudaSoOValor()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var dataOriginal = Hoje.AddDays(-12);
        var (conta, _) = await SeedContaComSaldoInicialAsync(ctx, usuarioId, 300m, dataOriginal);

        await svc.AtualizarSaldoInicialAsync(conta.Id, usuarioId, 450m, data: null);

        var saldoInicial = await ctx.Transacoes.SingleAsync(t => t.ContaId == conta.Id && t.EhSaldoInicial);
        Assert.Equal(450m, saldoInicial.Valor);
        Assert.Equal(dataOriginal, saldoInicial.Data);
    }

    [Fact]
    public async Task AtualizarSaldoInicialAsync_DataHoje_EhAceita()
    {
        // Fronteira da regra "não pode ser futura": hoje é permitido (só > hoje é recusado).
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var (conta, _) = await SeedContaComSaldoInicialAsync(ctx, usuarioId, 100m, Hoje.AddDays(-3));
        var hoje = Hoje;

        await svc.AtualizarSaldoInicialAsync(conta.Id, usuarioId, 200m, hoje);

        var saldoInicial = await ctx.Transacoes.SingleAsync(t => t.ContaId == conta.Id && t.EhSaldoInicial);
        Assert.Equal(200m, saldoInicial.Valor);
        Assert.Equal(hoje, saldoInicial.Data);
    }

    [Fact]
    public async Task AtualizarSaldoInicialAsync_SemSaldoInicial_CriaTransacaoReceita()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var conta = await svc.CriarAsync(new Conta { Nome = "Conta Sem Saldo", Tipo = TipoConta.ContaCorrente }, usuarioId); // saldoInicial 0 → sem transação
        Assert.Equal(0, await ctx.Transacoes.CountAsync());
        var data = Hoje.AddDays(-7);

        await svc.AtualizarSaldoInicialAsync(conta.Id, usuarioId, 800m, data);

        var criada = await ctx.Transacoes.SingleAsync();
        Assert.True(criada.EhSaldoInicial);
        Assert.Equal(TipoTransacao.Receita, criada.Tipo);
        Assert.Equal("Saldo Inicial", criada.Descricao);
        Assert.Equal(800m, criada.Valor);
        Assert.Equal(conta.Id, criada.ContaId);
        Assert.Equal(usuarioId, criada.CriadoPor);
        Assert.Null(criada.CategoriaId);
        Assert.True(criada.Ativo);
        Assert.Equal(data, criada.Data);
        Assert.Null(criada.Hora); // saldo inicial é datado, sem hora
    }

    [Fact]
    public async Task AtualizarSaldoInicialAsync_SemSaldoInicialEDataNula_CriaComHojeSemHora()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var conta = await svc.CriarAsync(new Conta { Nome = "Conta Hoje", Tipo = TipoConta.ContaCorrente }, usuarioId);

        // Janela [antes, depois] em vez de comparar com "hoje" solto: não quebra se virar a meia-noite UTC.
        var antes = Hoje;
        await svc.AtualizarSaldoInicialAsync(conta.Id, usuarioId, 120m, data: null);
        var depois = Hoje;

        var criada = await ctx.Transacoes.SingleAsync(t => t.EhSaldoInicial);
        Assert.InRange(criada.Data, antes, depois);
        Assert.Null(criada.Hora);
    }

    [Fact]
    public async Task AtualizarSaldoInicialAsync_SaldoInicialCanceladoNaoContaComoExistente_CriaUmNovoEPreservaOCancelado()
    {
        // Só o saldo inicial ATIVO é editado: um cancelado (soft delete) fica como está e um novo é criado.
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var (conta, cancelado) = await SeedContaComSaldoInicialAsync(ctx, usuarioId, 100m, Hoje.AddDays(-9), ativo: false);

        await svc.AtualizarSaldoInicialAsync(conta.Id, usuarioId, 777m, Hoje.AddDays(-2));

        // Transacao tem query filter global (Ativo) → IgnoreQueryFilters pra enxergar o cancelado.
        Assert.Equal(2, await ctx.Transacoes.IgnoreQueryFilters().CountAsync(t => t.ContaId == conta.Id && t.EhSaldoInicial));
        var aindaCancelado = await ctx.Transacoes.IgnoreQueryFilters().SingleAsync(t => t.Id == cancelado.Id);
        Assert.False(aindaCancelado.Ativo);
        Assert.Equal(100m, aindaCancelado.Valor);
        var novo = await ctx.Transacoes.SingleAsync(t => t.ContaId == conta.Id && t.EhSaldoInicial && t.Ativo);
        Assert.Equal(777m, novo.Valor);
    }

    [Fact]
    public async Task AtualizarSaldoInicialAsync_NaoMexeNoSaldoInicialDeOutraContaDoMesmoUsuario()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var dataA = Hoje.AddDays(-10);
        var dataB = Hoje.AddDays(-4);
        var (contaA, _) = await SeedContaComSaldoInicialAsync(ctx, usuarioId, 100m, dataA);
        var (contaB, saldoB) = await SeedContaComSaldoInicialAsync(ctx, usuarioId, 900m, dataB);

        await svc.AtualizarSaldoInicialAsync(contaA.Id, usuarioId, 111m, Hoje.AddDays(-1));

        var b = await ctx.Transacoes.SingleAsync(t => t.Id == saldoB.Id);
        Assert.Equal(900m, b.Valor);
        Assert.Equal(dataB, b.Data);
        Assert.Equal(contaB.Id, b.ContaId);
        var a = await ctx.Transacoes.SingleAsync(t => t.ContaId == contaA.Id && t.EhSaldoInicial);
        Assert.Equal(111m, a.Valor);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-0.01)]
    public async Task AtualizarSaldoInicialAsync_ValorZeroOuNegativo_LancaArgumentExceptionSemAlterarNada(double valor)
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var dataOriginal = Hoje.AddDays(-5);
        var (conta, original) = await SeedContaComSaldoInicialAsync(ctx, usuarioId, 1000m, dataOriginal);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.AtualizarSaldoInicialAsync(conta.Id, usuarioId, (decimal)valor, Hoje.AddDays(-2)));

        Assert.Contains("maior que zero", ex.Message);
        var doBanco = await ctx.Transacoes.SingleAsync(t => t.Id == original.Id);
        Assert.Equal(1000m, doBanco.Valor);
        Assert.Equal(dataOriginal, doBanco.Data);
        Assert.Equal(0, await ctx.FinancialEventLogs.CountAsync());
    }

    [Fact]
    public async Task AtualizarSaldoInicialAsync_DataFutura_LancaArgumentExceptionSemAlterarNada()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var dataOriginal = Hoje.AddDays(-5);
        var (conta, original) = await SeedContaComSaldoInicialAsync(ctx, usuarioId, 1000m, dataOriginal);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.AtualizarSaldoInicialAsync(conta.Id, usuarioId, 2000m, Hoje.AddDays(1)));

        Assert.Contains("futura", ex.Message);
        var doBanco = await ctx.Transacoes.SingleAsync(t => t.Id == original.Id);
        Assert.Equal(1000m, doBanco.Valor); // nem o valor mudou: a recusa vem antes de gravar
        Assert.Equal(dataOriginal, doBanco.Data);
        Assert.Equal(0, await ctx.FinancialEventLogs.CountAsync());
    }

    [Fact]
    public async Task AtualizarSaldoInicialAsync_DataFuturaSemSaldoInicial_NaoCriaTransacao()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var conta = await svc.CriarAsync(new Conta { Nome = "Conta Futura", Tipo = TipoConta.ContaCorrente }, usuarioId);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.AtualizarSaldoInicialAsync(conta.Id, usuarioId, 500m, Hoje.AddDays(3)));

        Assert.Equal(0, await ctx.Transacoes.CountAsync());
        Assert.Equal(0, await ctx.FinancialEventLogs.CountAsync());
    }

    [Fact]
    public async Task AtualizarSaldoInicialAsync_ContaDeOutroUsuario_LancaKeyNotFoundSemAlterarNada()
    {
        // IDOR: conta existe, mas é de outro usuário → mesmo 404 de "não existe" (não vaza existência).
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var dono = Guid.NewGuid();
        var invasor = Guid.NewGuid();
        var dataOriginal = Hoje.AddDays(-5);
        var (conta, original) = await SeedContaComSaldoInicialAsync(ctx, dono, 1000m, dataOriginal);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            svc.AtualizarSaldoInicialAsync(conta.Id, invasor, 99999m, Hoje.AddDays(-1)));

        var doBanco = await ctx.Transacoes.SingleAsync(t => t.Id == original.Id);
        Assert.Equal(1000m, doBanco.Valor);
        Assert.Equal(dataOriginal, doBanco.Data);
        Assert.Equal(1, await ctx.Transacoes.CountAsync());
        Assert.Equal(0, await ctx.FinancialEventLogs.CountAsync());
    }

    [Fact]
    public async Task AtualizarSaldoInicialAsync_ContaInexistente_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            svc.AtualizarSaldoInicialAsync(Guid.NewGuid(), Guid.NewGuid(), 100m, null));

        Assert.Equal(0, await ctx.Transacoes.CountAsync());
        Assert.Equal(0, await ctx.FinancialEventLogs.CountAsync());
    }

    [Fact]
    public async Task AtualizarSaldoInicialAsync_ContaDeOutroUsuarioComValorInvalido_Retorna404ENaoValidaOValor()
    {
        // O dono é checado ANTES do valor: quem não é dono recebe 404 mesmo mandando valor inválido,
        // senão a diferença 404 × 400 revelaria que o id existe.
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var (conta, _) = await SeedContaComSaldoInicialAsync(ctx, Guid.NewGuid(), 1000m, Hoje.AddDays(-5));

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            svc.AtualizarSaldoInicialAsync(conta.Id, Guid.NewGuid(), 0m, Hoje.AddDays(10)));
    }

    [Fact]
    public async Task AtualizarSaldoInicialAsync_Atualizando_RegistraEventoTransacaoAtualizadaComValorAntesEDepois()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var (conta, original) = await SeedContaComSaldoInicialAsync(ctx, usuarioId, 1000m, Hoje.AddDays(-5));

        await svc.AtualizarSaldoInicialAsync(conta.Id, usuarioId, 1500m, Hoje.AddDays(-5));

        var evento = await ctx.FinancialEventLogs.SingleAsync();
        Assert.Equal(FinancialEventType.TransacaoAtualizada, evento.Tipo);
        Assert.Equal(usuarioId, evento.CriadoPor);
        Assert.Equal("Transacao", evento.EntidadeAfetada);
        Assert.Equal(original.Id, evento.EntidadeId);
        Assert.Equal(1000m, evento.ValorAntes);
        Assert.Equal(1500m, evento.ValorDepois);
        Assert.NotEqual(Guid.Empty, evento.CorrelationId);
        Assert.Contains("saldo_inicial", evento.PayloadJson);
        Assert.Contains(conta.Id.ToString(), evento.PayloadJson);
    }

    [Fact]
    public async Task AtualizarSaldoInicialAsync_Criando_RegistraEventoTransacaoCriadaComValorAntesZero()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var conta = await svc.CriarAsync(new Conta { Nome = "Conta Evento", Tipo = TipoConta.ContaCorrente }, usuarioId);

        await svc.AtualizarSaldoInicialAsync(conta.Id, usuarioId, 640m, Hoje.AddDays(-1));

        var criada = await ctx.Transacoes.SingleAsync(t => t.EhSaldoInicial);
        var evento = await ctx.FinancialEventLogs.SingleAsync();
        Assert.Equal(FinancialEventType.TransacaoCriada, evento.Tipo);
        Assert.Equal(usuarioId, evento.CriadoPor);
        Assert.Equal("Transacao", evento.EntidadeAfetada);
        Assert.Equal(criada.Id, evento.EntidadeId);
        Assert.Equal(0m, evento.ValorAntes);
        Assert.Equal(640m, evento.ValorDepois);
        Assert.Contains("saldo_inicial", evento.PayloadJson);
    }

    private static Conta NovaConta(Guid usuarioId) => new()
    {
        Id = Guid.NewGuid(), Nome = "Inter", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuarioId,
    };

    [Fact]
    public async Task DeletarAsync_ContaComLancamento_RecusaEMantemTudo()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(usuarioId);
        var compra = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Mercado", Valor = 50, Tipo = TipoTransacao.Despesa, ContaId = conta.Id,
            Data = Hoje, CriadoPor = usuarioId, Ativo = true,
        };
        ctx.Contas.Add(conta);
        ctx.Transacoes.Add(compra);
        await ctx.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => svc.DeletarAsync(conta.Id, usuarioId));
        Assert.Contains("lançamentos", ex.Message);
        Assert.NotNull(await ctx.Contas.FindAsync(conta.Id));
        Assert.NotNull(await ctx.Transacoes.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == compra.Id));
    }

    [Fact]
    public async Task DeletarAsync_LancamentoCanceladoTambemSegura()
    {
        // Cancelado (soft delete) ainda é histórico: o cascade apagava até ele.
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(usuarioId);
        ctx.Contas.Add(conta);
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Estornado", Valor = 10, Tipo = TipoTransacao.Despesa, ContaId = conta.Id,
            Data = Hoje, CriadoPor = usuarioId, Ativo = false,
        });
        await ctx.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.DeletarAsync(conta.Id, usuarioId));
        Assert.NotNull(await ctx.Contas.FindAsync(conta.Id));
    }

    [Fact]
    public async Task DeletarAsync_ContaFixaUsandoAConta_Recusa()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(usuarioId);
        ctx.Contas.Add(conta);
        ctx.Recorrentes.Add(new Recorrente
        {
            Id = Guid.NewGuid(), Descricao = "Aluguel", Valor = 1800, Tipo = TipoTransacao.Despesa, ContaId = conta.Id,
            Frequencia = FrequenciaRecorrencia.Mensal, Dia = 10, DataInicio = DateTime.UtcNow.AddYears(1), Ativo = true, CriadoPor = usuarioId,
        });
        await ctx.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => svc.DeletarAsync(conta.Id, usuarioId));
        Assert.Contains("conta fixa", ex.Message);
    }

    [Fact]
    public async Task DeletarAsync_SoComSaldoInicial_ExcluiAContaEAAbertura_ECartaoPerdeOVinculo()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
        var usuarioId = Guid.NewGuid();
        var conta = NovaConta(usuarioId);
        var abertura = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Saldo Inicial", Valor = 300, Tipo = TipoTransacao.Receita, ContaId = conta.Id,
            Data = Hoje, CriadoPor = usuarioId, Ativo = true, EhSaldoInicial = true,
        };
        var cartao = new CartaoCredito
        {
            Id = Guid.NewGuid(), Nome = "Inter", TemCredito = true, LimiteTotal = 1000, ContaId = conta.Id, CriadoPor = usuarioId, Ativo = true,
        };
        ctx.Contas.Add(conta);
        ctx.Transacoes.Add(abertura);
        ctx.CartoesCredito.Add(cartao);
        await ctx.SaveChangesAsync();

        await svc.DeletarAsync(conta.Id, usuarioId);

        Assert.Null(await ctx.Contas.FindAsync(conta.Id));
        Assert.Null(await ctx.Transacoes.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == abertura.Id));
        var cartaoDb = await ctx.CartoesCredito.FindAsync(cartao.Id);
        Assert.NotNull(cartaoDb);
        Assert.Null(cartaoDb!.ContaId);
    }

    [Fact]
    public async Task DeletarAsync_CarteiraNaoPodeSerDeletada_LancaException()
    {
        var ctx = CreateContext();
        var svc = CriarService(ctx);
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
