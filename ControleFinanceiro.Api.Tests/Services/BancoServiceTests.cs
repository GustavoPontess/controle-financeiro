using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class BancoServiceTests
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
    public async Task ListarAsync_SemBancosCadastrados_RetornaListaVazia()
    {
        var ctx = CreateContext();
        var svc = new BancoService(ctx);

        var resultado = await svc.ListarAsync();

        Assert.Empty(resultado);
    }

    [Fact]
    public async Task ListarAsync_ComBancosCadastrados_RetornaTodos()
    {
        var ctx = CreateContext();
        var svc = new BancoService(ctx);

        ctx.Bancos.AddRange(
            new Banco { Id = Guid.NewGuid(), Nome = "Banco do Brasil", Tipo = TipoBanco.BancoTradicional },
            new Banco { Id = Guid.NewGuid(), Nome = "Nubank", Tipo = TipoBanco.Fintech }
        );
        await ctx.SaveChangesAsync();

        var resultado = await svc.ListarAsync();

        Assert.Equal(2, resultado.Count);
        Assert.Contains(resultado, b => b.Nome == "Banco do Brasil");
        Assert.Contains(resultado, b => b.Nome == "Nubank");
    }

    [Fact]
    public async Task ListarAsync_IncluiBancosInativos_NaoFiltraPorAtivo()
    {
        // O service não filtra por Ativo — cabe ao consumidor (controller/frontend) decidir
        // o que fazer com bancos descontinuados. Este teste documenta o comportamento atual.
        var ctx = CreateContext();
        var svc = new BancoService(ctx);

        ctx.Bancos.AddRange(
            new Banco { Id = Guid.NewGuid(), Nome = "Banco Ativo", Tipo = TipoBanco.BancoTradicional, Ativo = true },
            new Banco { Id = Guid.NewGuid(), Nome = "Banco Descontinuado", Tipo = TipoBanco.BancoTradicional, Ativo = false }
        );
        await ctx.SaveChangesAsync();

        var resultado = await svc.ListarAsync();

        Assert.Equal(2, resultado.Count);
        Assert.Contains(resultado, b => b.Nome == "Banco Descontinuado" && !b.Ativo);
    }

    [Fact]
    public async Task ListarAsync_IncluiContasVinculadasACadaBanco()
    {
        var ctx = CreateContext();
        var svc = new BancoService(ctx);
        var usuarioId = Guid.NewGuid();

        var banco = new Banco { Id = Guid.NewGuid(), Nome = "Nubank", Tipo = TipoBanco.Fintech };
        ctx.Bancos.Add(banco);
        ctx.Contas.Add(new Conta
        {
            Id = Guid.NewGuid(),
            Nome = "Conta Nubank",
            Tipo = TipoConta.ContaCorrente,
            BancoId = banco.Id,
            UsuarioIdProprietario = usuarioId,
        });
        await ctx.SaveChangesAsync();

        var resultado = await svc.ListarAsync();

        var nubank = Assert.Single(resultado);
        Assert.Single(nubank.Contas);
    }

    [Fact]
    public async Task BuscarPorIdAsync_BancoExistente_RetornaComContasIncluidas()
    {
        var ctx = CreateContext();
        var svc = new BancoService(ctx);
        var usuarioId = Guid.NewGuid();

        var banco = new Banco { Id = Guid.NewGuid(), Nome = "Itaú", Tipo = TipoBanco.BancoTradicional };
        ctx.Bancos.Add(banco);
        ctx.Contas.Add(new Conta
        {
            Id = Guid.NewGuid(),
            Nome = "Conta Itaú",
            Tipo = TipoConta.ContaCorrente,
            BancoId = banco.Id,
            UsuarioIdProprietario = usuarioId,
        });
        await ctx.SaveChangesAsync();

        var resultado = await svc.BuscarPorIdAsync(banco.Id);

        Assert.NotNull(resultado);
        Assert.Equal("Itaú", resultado!.Nome);
        Assert.Single(resultado.Contas);
    }

    [Fact]
    public async Task BuscarPorIdAsync_BancoInexistente_RetornaNull()
    {
        var ctx = CreateContext();
        var svc = new BancoService(ctx);

        var resultado = await svc.BuscarPorIdAsync(Guid.NewGuid());

        Assert.Null(resultado);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CriarAsync_NomeVazioOuEmBranco_LancaArgumentException(string nome)
    {
        var ctx = CreateContext();
        var svc = new BancoService(ctx);

        var banco = new Banco { Nome = nome, Tipo = TipoBanco.BancoTradicional };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(banco));
        Assert.Contains("Nome", ex.Message);
        Assert.Equal(0, await ctx.Bancos.CountAsync());
    }

    [Fact]
    public async Task CriarAsync_DadosValidos_PersisteEGeraNovoId()
    {
        var ctx = CreateContext();
        var svc = new BancoService(ctx);

        var banco = new Banco { Nome = "Banco Inter", Tipo = TipoBanco.Fintech };

        var resultado = await svc.CriarAsync(banco);

        Assert.NotEqual(Guid.Empty, resultado.Id);
        var doBanco = await ctx.Bancos.FindAsync(resultado.Id);
        Assert.NotNull(doBanco);
        Assert.Equal("Banco Inter", doBanco!.Nome);
        Assert.Equal(TipoBanco.Fintech, doBanco.Tipo);
    }

    [Fact]
    public async Task CriarAsync_IdInformadoPeloChamador_EhSobrescritoPeloServico()
    {
        // O service sempre gera um novo Guid, ignorando qualquer Id que o chamador tenha setado.
        var ctx = CreateContext();
        var svc = new BancoService(ctx);
        var idOriginal = Guid.NewGuid();

        var banco = new Banco { Id = idOriginal, Nome = "Banco XP", Tipo = TipoBanco.Corretora };

        var resultado = await svc.CriarAsync(banco);

        Assert.NotEqual(idOriginal, resultado.Id);
        Assert.Null(await ctx.Bancos.FindAsync(idOriginal));
    }

    [Fact]
    public async Task AtualizarAsync_BancoInexistente_LancaKeyNotFoundException()
    {
        var ctx = CreateContext();
        var svc = new BancoService(ctx);

        var atualizacao = new Banco { Nome = "Novo Nome", Tipo = TipoBanco.Outro };

        var ex = await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.AtualizarAsync(Guid.NewGuid(), atualizacao));
        Assert.Contains("não encontrado", ex.Message.ToLower());
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task AtualizarAsync_NomeVazioOuEmBranco_LancaArgumentExceptionSemPersistir(string nomeInvalido)
    {
        var ctx = CreateContext();
        var svc = new BancoService(ctx);

        var banco = new Banco { Id = Guid.NewGuid(), Nome = "Banco Original", Tipo = TipoBanco.BancoTradicional };
        ctx.Bancos.Add(banco);
        await ctx.SaveChangesAsync();

        var atualizacao = new Banco { Nome = nomeInvalido, Tipo = TipoBanco.Fintech };

        await Assert.ThrowsAsync<ArgumentException>(() => svc.AtualizarAsync(banco.Id, atualizacao));

        var doBanco = await ctx.Bancos.FindAsync(banco.Id);
        Assert.Equal("Banco Original", doBanco!.Nome);
        Assert.Equal(TipoBanco.BancoTradicional, doBanco.Tipo);
    }

    [Fact]
    public async Task AtualizarAsync_DadosValidos_AtualizaNomeETipo()
    {
        var ctx = CreateContext();
        var svc = new BancoService(ctx);

        var banco = new Banco { Id = Guid.NewGuid(), Nome = "Banco Original", Tipo = TipoBanco.BancoTradicional };
        ctx.Bancos.Add(banco);
        await ctx.SaveChangesAsync();

        var atualizacao = new Banco { Nome = "Banco Renomeado", Tipo = TipoBanco.Cooperativa };

        await svc.AtualizarAsync(banco.Id, atualizacao);

        var doBanco = await ctx.Bancos.FindAsync(banco.Id);
        Assert.Equal("Banco Renomeado", doBanco!.Nome);
        Assert.Equal(TipoBanco.Cooperativa, doBanco.Tipo);
    }

    [Fact]
    public async Task AtualizarAsync_NaoAlteraCamposNaoCobertosPelaAtualizacao()
    {
        // Documenta o comportamento atual: AtualizarAsync só toca Nome e Tipo — os demais
        // campos (CodigoBanco, Ativo, NomeFantasia, Cor, etc.) permanecem intactos, o que é
        // consistente com o CriarBancoDto usado pelo controller (só expõe Nome + Tipo).
        var ctx = CreateContext();
        var svc = new BancoService(ctx);

        var banco = new Banco
        {
            Id = Guid.NewGuid(),
            Nome = "Banco Original",
            Tipo = TipoBanco.BancoTradicional,
            CodigoBanco = "001",
            Ativo = false,
            NomeFantasia = "Fantasia Original",
            Cor = "#FF0000",
        };
        ctx.Bancos.Add(banco);
        await ctx.SaveChangesAsync();

        var atualizacao = new Banco { Nome = "Banco Renomeado", Tipo = TipoBanco.Fintech };

        await svc.AtualizarAsync(banco.Id, atualizacao);

        var doBanco = await ctx.Bancos.FindAsync(banco.Id);
        Assert.Equal("001", doBanco!.CodigoBanco);
        Assert.False(doBanco.Ativo);
        Assert.Equal("Fantasia Original", doBanco.NomeFantasia);
        Assert.Equal("#FF0000", doBanco.Cor);
    }

    [Fact]
    public async Task DeletarAsync_BancoInexistente_LancaKeyNotFoundException()
    {
        var ctx = CreateContext();
        var svc = new BancoService(ctx);

        var ex = await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.DeletarAsync(Guid.NewGuid()));
        Assert.Contains("não encontrado", ex.Message.ToLower());
    }

    [Fact]
    public async Task DeletarAsync_BancoExistente_Remove()
    {
        var ctx = CreateContext();
        var svc = new BancoService(ctx);

        var banco = new Banco { Id = Guid.NewGuid(), Nome = "Banco a Remover", Tipo = TipoBanco.Outro };
        ctx.Bancos.Add(banco);
        await ctx.SaveChangesAsync();

        await svc.DeletarAsync(banco.Id);

        Assert.Null(await ctx.Bancos.FindAsync(banco.Id));
    }

    [Fact]
    public async Task DeletarAsync_ChamadoDuasVezes_SegundaChamadaLancaException()
    {
        var ctx = CreateContext();
        var svc = new BancoService(ctx);

        var banco = new Banco { Id = Guid.NewGuid(), Nome = "Banco a Remover", Tipo = TipoBanco.Outro };
        ctx.Bancos.Add(banco);
        await ctx.SaveChangesAsync();

        await svc.DeletarAsync(banco.Id);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.DeletarAsync(banco.Id));
    }
}
