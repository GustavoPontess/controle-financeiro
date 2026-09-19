using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class CategoriaServiceTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static async Task<Categoria> SeedCategoria(AppDbContext ctx, Guid? usuarioId, string descricao = "Mercado", Finalidade finalidade = Finalidade.Despesa)
    {
        var cat = new Categoria { Id = Guid.NewGuid(), Descricao = descricao, Finalidade = finalidade, UsuarioId = usuarioId };
        ctx.Categorias.Add(cat);
        await ctx.SaveChangesAsync();
        return cat;
    }

    // ---------- ListarAsync ----------

    [Fact]
    public async Task ListarAsync_RetornaPadraoEDoUsuario_NaoRetornaDeOutroUsuario()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var usuarioId = Guid.NewGuid();
        var outroUsuarioId = Guid.NewGuid();

        await SeedCategoria(ctx, null, "Alimentação");
        await SeedCategoria(ctx, usuarioId, "Categoria Pessoal");
        await SeedCategoria(ctx, outroUsuarioId, "Categoria de Outro");

        var lista = await svc.ListarAsync(usuarioId);

        Assert.Equal(2, lista.Count);
        Assert.Contains(lista, c => c.Descricao == "Alimentação");
        Assert.Contains(lista, c => c.Descricao == "Categoria Pessoal");
        Assert.DoesNotContain(lista, c => c.Descricao == "Categoria de Outro");
    }

    [Fact]
    public async Task ListarAsync_OrdenaPadraoPrimeiroDepoisPorDescricao()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var usuarioId = Guid.NewGuid();

        await SeedCategoria(ctx, usuarioId, "Zebra");
        await SeedCategoria(ctx, null, "Wagon");
        await SeedCategoria(ctx, usuarioId, "Abacaxi");
        await SeedCategoria(ctx, null, "Alimentação");

        var lista = await svc.ListarAsync(usuarioId);

        Assert.Equal(4, lista.Count);
        // padrões (UsuarioId null) primeiro, em ordem alfabética entre si
        Assert.Null(lista[0].UsuarioId);
        Assert.Equal("Alimentação", lista[0].Descricao);
        Assert.Null(lista[1].UsuarioId);
        Assert.Equal("Wagon", lista[1].Descricao);
        // depois as pessoais, também em ordem alfabética entre si
        Assert.Equal(usuarioId, lista[2].UsuarioId);
        Assert.Equal("Abacaxi", lista[2].Descricao);
        Assert.Equal(usuarioId, lista[3].UsuarioId);
        Assert.Equal("Zebra", lista[3].Descricao);
    }

    [Fact]
    public async Task ListarAsync_SemCategorias_RetornaListaVazia()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);

        var lista = await svc.ListarAsync(Guid.NewGuid());

        Assert.Empty(lista);
    }

    // ---------- BuscarPorIdAsync ----------

    [Fact]
    public async Task BuscarPorIdAsync_CategoriaPadrao_QualquerUsuarioEnxerga()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var padrao = await SeedCategoria(ctx, null, "Transporte");

        var encontrada = await svc.BuscarPorIdAsync(padrao.Id, Guid.NewGuid());

        Assert.NotNull(encontrada);
        Assert.Equal("Transporte", encontrada!.Descricao);
    }

    [Fact]
    public async Task BuscarPorIdAsync_CategoriaPessoalDoDono_Retorna()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var usuarioId = Guid.NewGuid();
        var cat = await SeedCategoria(ctx, usuarioId, "Minha Categoria");

        var encontrada = await svc.BuscarPorIdAsync(cat.Id, usuarioId);

        Assert.NotNull(encontrada);
        Assert.Equal(cat.Id, encontrada!.Id);
    }

    [Fact]
    public async Task BuscarPorIdAsync_CategoriaDeOutroUsuario_RetornaNull()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var dono = Guid.NewGuid();
        var outro = Guid.NewGuid();
        var cat = await SeedCategoria(ctx, dono, "Categoria Privada");

        var encontrada = await svc.BuscarPorIdAsync(cat.Id, outro);

        Assert.Null(encontrada);
    }

    [Fact]
    public async Task BuscarPorIdAsync_IdInexistente_RetornaNull()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);

        var encontrada = await svc.BuscarPorIdAsync(Guid.NewGuid(), Guid.NewGuid());

        Assert.Null(encontrada);
    }

    // ---------- CriarAsync ----------

    [Fact]
    public async Task CriarAsync_DescricaoVazia_LancaArgumentException()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var usuarioId = Guid.NewGuid();

        var categoria = new Categoria { Descricao = "", Finalidade = Finalidade.Despesa };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(categoria, usuarioId));
        Assert.Contains("obrigatória", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_DescricaoSoEspacos_LancaArgumentException()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var usuarioId = Guid.NewGuid();

        var categoria = new Categoria { Descricao = "   ", Finalidade = Finalidade.Receita };

        await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(categoria, usuarioId));
    }

    [Fact]
    public async Task CriarAsync_DescricaoMuitoLonga_LancaArgumentException()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var usuarioId = Guid.NewGuid();

        var categoria = new Categoria { Descricao = new string('A', 401), Finalidade = Finalidade.Despesa };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(categoria, usuarioId));
        Assert.Contains("400", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_DescricaoNoLimiteDe400_Persiste()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var usuarioId = Guid.NewGuid();

        var categoria = new Categoria { Descricao = new string('A', 400), Finalidade = Finalidade.Despesa };

        var resultado = await svc.CriarAsync(categoria, usuarioId);

        Assert.Equal(400, resultado.Descricao.Length);
    }

    [Fact]
    public async Task CriarAsync_DadosValidos_GeraIdEDefineUsuarioProprietario()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var usuarioId = Guid.NewGuid();

        var categoria = new Categoria { Descricao = "Lazer", Finalidade = Finalidade.Despesa };

        var resultado = await svc.CriarAsync(categoria, usuarioId);

        Assert.NotEqual(Guid.Empty, resultado.Id);
        Assert.Equal(usuarioId, resultado.UsuarioId);
        Assert.Single(ctx.Categorias);
    }

    [Fact]
    public async Task CriarAsync_UsuarioIdInformadoNaEntrada_EhSobrescritoPeloParametro()
    {
        // categoria criada sempre pertence a quem chama o serviço — nunca a um UsuarioId arbitrário do payload
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var usuarioId = Guid.NewGuid();
        var usuarioForjado = Guid.NewGuid();

        var categoria = new Categoria { Descricao = "Lazer", Finalidade = Finalidade.Despesa, UsuarioId = usuarioForjado };

        var resultado = await svc.CriarAsync(categoria, usuarioId);

        Assert.Equal(usuarioId, resultado.UsuarioId);
        Assert.NotEqual(usuarioForjado, resultado.UsuarioId);
    }

    [Theory]
    [InlineData(Finalidade.Despesa)]
    [InlineData(Finalidade.Receita)]
    [InlineData(Finalidade.Ambas)]
    public async Task CriarAsync_PersisteFinalidadeInformada(Finalidade finalidade)
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var usuarioId = Guid.NewGuid();

        var categoria = new Categoria { Descricao = "Categoria Teste", Finalidade = finalidade };

        var resultado = await svc.CriarAsync(categoria, usuarioId);

        var doBanco = await ctx.Categorias.FindAsync(resultado.Id);
        Assert.Equal(finalidade, doBanco!.Finalidade);
    }

    // ---------- DeletarAsync ----------

    [Fact]
    public async Task DeletarAsync_CategoriaInexistente_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);

        var ex = await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.DeletarAsync(Guid.NewGuid(), Guid.NewGuid()));
        Assert.Contains("não encontrada", ex.Message);
    }

    [Fact]
    public async Task DeletarAsync_CategoriaPadrao_LancaInvalidOperation()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var padrao = await SeedCategoria(ctx, null, "Alimentação");

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => svc.DeletarAsync(padrao.Id, Guid.NewGuid()));
        Assert.Contains("padrão", ex.Message.ToLower());

        Assert.NotEmpty(ctx.Categorias); // não removeu
    }

    [Fact]
    public async Task DeletarAsync_CategoriaDeOutroUsuario_LancaForbidden()
    {
        // isolamento multi-tenant / IDOR: usuário não pode remover categoria pessoal de outro usuário
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var dono = Guid.NewGuid();
        var outro = Guid.NewGuid();
        var cat = await SeedCategoria(ctx, dono, "Categoria do Dono");

        await Assert.ThrowsAsync<ForbiddenAccessException>(() => svc.DeletarAsync(cat.Id, outro));

        Assert.NotEmpty(ctx.Categorias); // não removeu
    }

    [Fact]
    public async Task DeletarAsync_CategoriaDoProprioUsuario_Remove()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var usuarioId = Guid.NewGuid();
        var cat = await SeedCategoria(ctx, usuarioId, "Categoria Pessoal");

        await svc.DeletarAsync(cat.Id, usuarioId);

        Assert.Empty(ctx.Categorias);
    }
}
