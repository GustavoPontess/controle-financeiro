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

        var categoria = new Categoria { Descricao = new string('A', 101), Finalidade = Finalidade.Despesa };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(categoria, usuarioId));
        Assert.Contains("100", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_DescricaoNoLimiteDe100_Persiste()
    {
        // docs/REGRAS_CAMPOS.md: nome curto = 100 (antes aceitava 400).
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var usuarioId = Guid.NewGuid();

        var categoria = new Categoria { Descricao = new string('A', 100), Finalidade = Finalidade.Despesa };

        var resultado = await svc.CriarAsync(categoria, usuarioId);

        Assert.Equal(100, resultado.Descricao.Length);
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
    public async Task DeletarAsync_CategoriaDeOutroUsuario_404()
    {
        // isolamento multi-tenant / IDOR: categoria de outro usuário é "não encontrada" (antes 403 confirmava que existe)
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var dono = Guid.NewGuid();
        var outro = Guid.NewGuid();
        var cat = await SeedCategoria(ctx, dono, "Categoria do Dono");

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.DeletarAsync(cat.Id, outro));

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

    // ---------- regras novas (2026-10-16) ----------

    [Fact]
    public async Task CriarAsync_FinalidadeForaDoEnum_Recusa()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.CriarAsync(new Categoria { Descricao = "Teste", Finalidade = (Finalidade)99 }, Guid.NewGuid()));
        Assert.Empty(ctx.Categorias);
    }

    [Fact]
    public async Task CriarAsync_NomeIgualAUmaPadrao_SemDiferenciarMaiuscula_409()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        await SeedCategoria(ctx, null, "Moradia");

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.CriarAsync(new Categoria { Descricao = "  moradia ", Finalidade = Finalidade.Despesa }, Guid.NewGuid()));
        Assert.Equal(CategoriaService.MensagemNomeRepetido, ex.Message);
    }

    [Fact]
    public async Task CriarAsync_MesmoNomeQueCategoriaDeOutroUsuario_Pode()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        await SeedCategoria(ctx, Guid.NewGuid(), "Pets");

        var criada = await svc.CriarAsync(new Categoria { Descricao = "Pets", Finalidade = Finalidade.Despesa }, Guid.NewGuid());
        Assert.Equal("Pets", criada.Descricao);
    }

    [Fact]
    public async Task AtualizarAsync_Renomeia_ETrocaPraAsDuas()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var u = Guid.NewGuid();
        var cat = await SeedCategoria(ctx, u, "Pets");
        SeedLancamento(ctx, u, cat.Id, TipoTransacao.Despesa);

        var r = await svc.AtualizarAsync(cat.Id, " Bichos ", Finalidade.Ambas, u);

        Assert.Equal("Bichos", r.Descricao);
        Assert.Equal(Finalidade.Ambas, r.Finalidade);
    }

    [Fact]
    public async Task AtualizarAsync_VirarSoReceita_ComDespesaLancada_Recusa()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var u = Guid.NewGuid();
        var cat = await SeedCategoria(ctx, u, "Pets");
        SeedLancamento(ctx, u, cat.Id, TipoTransacao.Despesa);

        await Assert.ThrowsAsync<ArgumentException>(() => svc.AtualizarAsync(cat.Id, "Pets", Finalidade.Receita, u));
        Assert.Equal(Finalidade.Despesa, (await ctx.Categorias.AsNoTracking().SingleAsync()).Finalidade);
    }

    [Fact]
    public async Task AtualizarAsync_Padrao409_DeOutroUsuario404_NomeRepetido409()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var u = Guid.NewGuid();
        var padrao = await SeedCategoria(ctx, null, "Moradia");
        var minha = await SeedCategoria(ctx, u, "Pets");
        var deOutro = await SeedCategoria(ctx, Guid.NewGuid(), "Viagem");

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.AtualizarAsync(padrao.Id, "Casa", Finalidade.Despesa, u));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.AtualizarAsync(deOutro.Id, "X", Finalidade.Despesa, u));
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => svc.AtualizarAsync(minha.Id, "MORADIA", Finalidade.Despesa, u));
        Assert.Equal(CategoriaService.MensagemNomeRepetido, ex.Message);
    }

    [Fact]
    public async Task UsoAsync_ContaSoOQueEstaVivo()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var u = Guid.NewGuid();
        var cat = await SeedCategoria(ctx, u, "Pets");
        SeedLancamento(ctx, u, cat.Id, TipoTransacao.Despesa);
        SeedLancamento(ctx, u, cat.Id, TipoTransacao.Despesa, ativo: false);
        ctx.Recorrentes.Add(new Recorrente { Id = Guid.NewGuid(), Descricao = "Ração", Valor = 90, Tipo = TipoTransacao.Despesa, CategoriaId = cat.Id, CriadoPor = u, DataInicio = DateTime.UtcNow });
        ctx.Subcategorias.Add(new Subcategoria { Id = Guid.NewGuid(), Nome = "Ração", CategoriaId = cat.Id, UsuarioId = u });
        await ctx.SaveChangesAsync();

        var uso = await svc.UsoAsync(cat.Id, u);

        Assert.Equal(1, uso.Lancamentos);
        Assert.Equal(1, uso.ContasFixas);
        Assert.Equal(1, uso.Subcategorias);
    }

    [Fact]
    public async Task DeletarAsync_EmUsoSemDestino_409_ENaoApaga()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var u = Guid.NewGuid();
        var cat = await SeedCategoria(ctx, u, "Pets");
        SeedLancamento(ctx, u, cat.Id, TipoTransacao.Despesa, ativo: false); // até excluído segura a categoria

        var uso = await svc.UsoAsync(cat.Id, u);
        Assert.Equal((0, 1, true), (uso.Lancamentos, uso.LancamentosExcluidos, uso.PrecisaDestino)); // a tela pergunta o destino
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => svc.DeletarAsync(cat.Id, u));
        Assert.Equal(CategoriaService.MensagemEscolhaDestino, ex.Message);
        Assert.Single(ctx.Categorias);
    }

    [Fact]
    public async Task DeletarAsync_MoverPara_LevaTudo_ESomaOQueCadaLimiteValiaEmCadaMes()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var u = Guid.NewGuid();
        var pets = await SeedCategoria(ctx, u, "Pets");
        var compras = await SeedCategoria(ctx, null, "Compras");
        var racao = new Subcategoria { Id = Guid.NewGuid(), Nome = "Ração", CategoriaId = pets.Id, UsuarioId = u };
        var petshop = new Subcategoria { Id = Guid.NewGuid(), Nome = "Pet shop", CategoriaId = pets.Id, UsuarioId = u };
        var petshopPadrao = new Subcategoria { Id = Guid.NewGuid(), Nome = "pet shop", CategoriaId = compras.Id, UsuarioId = null };
        ctx.Subcategorias.AddRange(racao, petshop, petshopPadrao);
        await ctx.SaveChangesAsync();
        var vivo = SeedLancamento(ctx, u, pets.Id, TipoTransacao.Despesa, sub: racao.Id);
        var excluido = SeedLancamento(ctx, u, pets.Id, TipoTransacao.Despesa, ativo: false, sub: petshop.Id);
        var fixa = new Recorrente { Id = Guid.NewGuid(), Descricao = "Ração", Valor = 90, Tipo = TipoTransacao.Despesa, CategoriaId = pets.Id, SubcategoriaId = petshop.Id, CriadoPor = u, DataInicio = DateTime.UtcNow };
        var parc = new Parcelamento { Id = Guid.NewGuid(), Descricao = "Casinha", CategoriaId = pets.Id, CriadoPor = u, CartaoCreditoId = Guid.NewGuid(), ValorTotal = 300, QuantidadeParcelas = 3, DataCompra = DateTime.UtcNow };
        var meta = new Meta { Id = Guid.NewGuid(), Nome = "Reserva vet", CategoriaId = pets.Id, UsuarioId = u, ValorAlvo = 500 };
        var limitePets = new Orcamento { Id = Guid.NewGuid(), UsuarioId = u, CategoriaId = pets.Id, Mes = 10, Ano = 2026, ValorLimite = 200 };
        var limiteCompras = new Orcamento { Id = Guid.NewGuid(), UsuarioId = u, CategoriaId = compras.Id, Mes = 10, Ano = 2026, ValorLimite = 300 };
        var limitePetsNov = new Orcamento { Id = Guid.NewGuid(), UsuarioId = u, CategoriaId = pets.Id, Mes = 11, Ano = 2026, ValorLimite = 150 };
        ctx.AddRange(fixa, parc, meta, limitePets, limiteCompras, limitePetsNov);
        await ctx.SaveChangesAsync();

        var movido = await svc.DeletarAsync(pets.Id, u, compras.Id);

        Assert.Equal(1, movido.Lancamentos);
        Assert.False(await ctx.Categorias.AnyAsync(c => c.Id == pets.Id));
        var txs = await ctx.Transacoes.IgnoreQueryFilters().AsNoTracking().ToListAsync();
        Assert.All(txs, t => Assert.Equal(compras.Id, t.CategoriaId));
        Assert.Equal(racao.Id, txs.Single(t => t.Id == vivo.Id).SubcategoriaId);           // Ração foi junto pra Compras
        Assert.Equal(petshopPadrao.Id, txs.Single(t => t.Id == excluido.Id).SubcategoriaId); // "Pet shop" absorvida pela padrão
        Assert.Equal(compras.Id, (await ctx.Subcategorias.AsNoTracking().SingleAsync(s => s.Id == racao.Id)).CategoriaId);
        Assert.False(await ctx.Subcategorias.AnyAsync(s => s.Id == petshop.Id));
        var fixaDepois = await ctx.Recorrentes.AsNoTracking().SingleAsync();
        Assert.Equal((compras.Id, petshopPadrao.Id), (fixaDepois.CategoriaId!.Value, fixaDepois.SubcategoriaId!.Value));
        Assert.Equal(compras.Id, (await ctx.Parcelamentos.AsNoTracking().SingleAsync()).CategoriaId);
        Assert.Equal(compras.Id, (await ctx.Metas.AsNoTracking().SingleAsync()).CategoriaId);
        var limites = await ctx.Orcamentos.AsNoTracking().ToListAsync();
        Assert.Equal(2, limites.Count);
        Assert.All(limites, o => Assert.Equal(compras.Id, o.CategoriaId));
        Assert.Equal(500, limites.Single(o => o.Mes == 10).ValorLimite); // 200 + 300 em outubro
        // Limite vale todo mês até mudar: em novembro Pets passou a 150 e Compras continuou 300.
        Assert.Equal(450, limites.Single(o => o.Mes == 11).ValorLimite);
    }

    [Fact]
    public async Task DeletarAsync_DestinoSoDeDespesa_ComReceita_Recusa_ENadaMuda()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var u = Guid.NewGuid();
        var extras = await SeedCategoria(ctx, u, "Extras", Finalidade.Ambas);
        var compras = await SeedCategoria(ctx, null, "Compras", Finalidade.Despesa);
        SeedLancamento(ctx, u, extras.Id, TipoTransacao.Receita);

        await Assert.ThrowsAsync<ArgumentException>(() => svc.DeletarAsync(extras.Id, u, compras.Id));
        Assert.Equal(extras.Id, (await ctx.Transacoes.AsNoTracking().SingleAsync()).CategoriaId);
        Assert.Equal(2, await ctx.Categorias.CountAsync());
    }

    [Fact]
    public async Task DeletarAsync_DestinoDeOutroUsuario404_OuElaMesma_Recusa()
    {
        var ctx = CreateContext();
        var svc = new CategoriaService(ctx);
        var u = Guid.NewGuid();
        var pets = await SeedCategoria(ctx, u, "Pets");
        var deOutro = await SeedCategoria(ctx, Guid.NewGuid(), "Bichos");
        SeedLancamento(ctx, u, pets.Id, TipoTransacao.Despesa);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.DeletarAsync(pets.Id, u, deOutro.Id));
        await Assert.ThrowsAsync<ArgumentException>(() => svc.DeletarAsync(pets.Id, u, pets.Id));
        Assert.Equal(pets.Id, (await ctx.Transacoes.AsNoTracking().SingleAsync()).CategoriaId);
    }

    private static Transacao SeedLancamento(AppDbContext ctx, Guid u, Guid categoriaId, TipoTransacao tipo, bool ativo = true, Guid? sub = null)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Lançamento", Valor = 10, Tipo = tipo, CategoriaId = categoriaId, SubcategoriaId = sub,
            ContaId = Guid.NewGuid(), StatusTransacao = StatusTransacao.Executado, Ativo = ativo, CriadoPor = u,
            Data = HorarioBrasil.Hoje(), CriadoEm = DateTime.UtcNow,
        };
        ctx.Transacoes.Add(t);
        ctx.SaveChanges();
        return t;
    }
}
