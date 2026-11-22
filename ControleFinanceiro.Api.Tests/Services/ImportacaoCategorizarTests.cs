using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Importacao;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Importar vários arquivos de uma vez e categorizar por estabelecimento (2026-11-03, o Gustavo importando os 10
/// meses da Nubank como usuário): a pessoa responde uma vez por lugar e o app lembra.
/// </summary>
public class ImportacaoCategorizarTests
{
    private sealed record Cenario(AppDbContext Ctx, Guid Usuario, Guid Conta, Guid Alimentacao, Guid Lazer, ImportacaoService Svc);

    private static Cenario Montar()
    {
        var ctx = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning)).Options);
        var usuario = new Usuario { Id = Guid.NewGuid(), Email = "g@x.com", Nome = "Gustavo Nunes Pontes", PasswordHash = "x" };
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Nubank", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuario.Id };
        var alimentacao = new Categoria { Id = Guid.NewGuid(), Descricao = "Alimentação", Finalidade = Finalidade.Despesa };
        var lazer = new Categoria { Id = Guid.NewGuid(), Descricao = "Lazer e entretenimento", Finalidade = Finalidade.Despesa };
        ctx.AddRange(usuario, conta, alimentacao, lazer);
        ctx.SaveChanges();
        var svc = new ImportacaoService(ctx, new ExtratoImportService(), new TransacaoService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx)));
        return new Cenario(ctx, usuario.Id, conta.Id, alimentacao.Id, lazer.Id, svc);
    }

    private static string Stmt(string data, string valor, string fit, string memo) =>
        $"<STMTTRN><DTPOSTED>{data}000000[-3:BRT]<TRNAMT>{valor}<FITID>{fit}<MEMO>{memo}</STMTTRN>";

    private static Task Confirmar(Cenario c, PreviewImportacaoDto previa, Func<ExtratoLinhaDto, Guid?>? categoria = null) =>
        c.Svc.ConfirmarAsync(new ConfirmarImportacaoDto(c.Conta, previa.Linhas.Where(l => !l.Duplicada)
            .Select(l => new LinhaImportarDto(l.Data, l.Descricao, l.Valor, l.Tipo, l.FitId, categoria is null ? l.CategoriaSugeridaId : categoria(l)))
            .ToList()), c.Usuario, Guid.NewGuid().ToString());

    [Fact]
    public async Task Previa_DizOEstabelecimento_ESugereOObvio()
    {
        var c = Montar();
        var previa = await c.Svc.PreviewAsync(c.Conta, c.Usuario, "nu.ofx", string.Concat(
            Stmt("20261002", "-5.95", "A1", "Compra no débito via NuPay - iFood"),
            Stmt("20261003", "-12.00", "A2", "Compra no débito - MP *PHLANCHESLTDA"),
            Stmt("20261004", "500.00", "A3", "Transferência recebida pelo Pix - GUSTAVO NUNES PONTES - BANCO INTER")));

        var ifood = previa.Linhas[0];
        Assert.Equal(("iFood", c.Alimentacao, "conhecido"), (ifood.Estabelecimento, ifood.CategoriaSugeridaId, ifood.SugestaoDe));
        Assert.Equal(("MP *PHLANCHESLTDA", (Guid?)null), (previa.Linhas[1].Estabelecimento, previa.Linhas[1].CategoriaSugeridaId));
        Assert.Null(previa.Linhas[2].Chave); // entre suas contas: não é gasto, não se categoriza
    }

    [Fact]
    public async Task Confirmar_AprendeACategoriaDoEstabelecimento_EAProximaImportacaoJaVemCategorizada()
    {
        var c = Montar();
        await Confirmar(c, await c.Svc.PreviewAsync(c.Conta, c.Usuario, "out.ofx", string.Concat(
            Stmt("20261002", "-12.00", "B1", "Compra no débito - MP *PHLANCHESLTDA"),
            Stmt("20261009", "-15.00", "B2", "Compra no débito - MP *PHLANCHESLTDA"))),
            l => c.Alimentacao);

        var regra = await c.Ctx.RegrasCategoria.SingleAsync();
        Assert.Equal(("MP *PHLANCHESLTDA", c.Alimentacao, TipoTransacao.Despesa), (regra.Nome, regra.CategoriaId, regra.Tipo));

        var novembro = await c.Svc.PreviewAsync(c.Conta, c.Usuario, "nov.ofx", Stmt("20261103", "-9.00", "B3", "Compra no débito - MP *PHLANCHESLTDA"));
        Assert.Equal((c.Alimentacao, "regra"), (novembro.Linhas.Single().CategoriaSugeridaId, novembro.Linhas.Single().SugestaoDe));
    }

    [Fact]
    public async Task Confirmar_ATrocaMaisNovaVale_EAMaioriaDoGrupoDecide()
    {
        var c = Montar();
        await Confirmar(c, await c.Svc.PreviewAsync(c.Conta, c.Usuario, "a.ofx", Stmt("20261002", "-30.00", "C1", "Compra no débito - BAR DO BARTOLOMEU")),
            _ => c.Alimentacao);
        // Agora a pessoa diz que é lazer (2 de 3 lançamentos): a regra muda.
        await Confirmar(c, await c.Svc.PreviewAsync(c.Conta, c.Usuario, "b.ofx", string.Concat(
            Stmt("20261010", "-40.00", "C2", "Compra no débito - BAR DO BARTOLOMEU"),
            Stmt("20261011", "-41.00", "C3", "Compra no débito - BAR DO BARTOLOMEU"),
            Stmt("20261012", "-42.00", "C4", "Compra no débito - BAR DO BARTOLOMEU"))),
            l => l.FitId == "C4" ? c.Alimentacao : c.Lazer);

        Assert.Equal(c.Lazer, (await c.Ctx.RegrasCategoria.SingleAsync()).CategoriaId);
    }

    [Fact]
    public async Task Confirmar_LancamentoSeparadoDoLugar_GravaASuaCategoria_MasNaoMudaARegraDoLugar()
    {
        var c = Montar();
        var previa = await c.Svc.PreviewAsync(c.Conta, c.Usuario, "a.ofx", string.Concat(
            Stmt("20261002", "-30.00", "S1", "Compra no débito - BAR DO BARTOLOMEU"),
            Stmt("20261003", "-90.00", "S2", "Compra no débito - BAR DO BARTOLOMEU")));
        // S2 a pessoa separou do lugar e pôs em Lazer; o lugar fica Alimentação.
        await c.Svc.ConfirmarAsync(new ConfirmarImportacaoDto(c.Conta, previa.Linhas
            .Select(l => new LinhaImportarDto(l.Data, l.Descricao, l.Valor, l.Tipo, l.FitId,
                l.FitId == "S2" ? c.Lazer : c.Alimentacao, NaoLembrar: l.FitId == "S2"))
            .ToList()), c.Usuario, Guid.NewGuid().ToString());

        Assert.Equal(c.Lazer, (await c.Ctx.Transacoes.SingleAsync(t => t.ImportacaoFitId == "S2")).CategoriaId);
        Assert.Equal(c.Alimentacao, (await c.Ctx.RegrasCategoria.SingleAsync()).CategoriaId);
    }

    [Fact]
    public async Task PreviaSemRegra_AprendeDoQueAPessoaJaFezNosLancamentos()
    {
        var c = Montar();
        c.Ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Compra no débito - MP *SODRESSORVETE", Valor = 10m, Tipo = TipoTransacao.Despesa,
            ContaId = c.Conta, CategoriaId = c.Lazer, CriadoPor = c.Usuario, Data = new DateOnly(2026, 9, 1),
            StatusTransacao = StatusTransacao.Executado,
        });
        c.Ctx.SaveChanges();

        var previa = await c.Svc.PreviewAsync(c.Conta, c.Usuario, "x.ofx", Stmt("20261002", "-8.00", "D1", "Compra no débito - MP *SODRESSORVETE"));
        Assert.Equal((c.Lazer, "historico"), (previa.Linhas.Single().CategoriaSugeridaId, previa.Linhas.Single().SugestaoDe));
    }

    [Fact]
    public async Task VariosArquivos_UmaPreviaSo_SemORepetidoEntreOfxECsv_EOArquivoRuimFicaDeForaComOMotivo()
    {
        var c = Montar();
        var ofxSetembro = Stmt("20260905", "-12.00", "6abf8bc7", "Compra no débito - MP *PHLANCHESLTDA");
        var ofxOutubro = Stmt("20261002", "-5.95", "7cd9e0a1", "Compra no débito via NuPay - iFood");
        var csvOutubro = "Data,Valor,Identificador,Descrição\n02/10/2026,-5.95,7cd9e0a1,Compra no débito via NuPay - iFood\n";

        var previa = await c.Svc.PreviewVariosAsync(c.Conta, c.Usuario, new List<(string, string)>
        {
            ("NU_OUT.ofx", ofxOutubro), ("NU_OUT.csv", csvOutubro), ("NU_SET.ofx", ofxSetembro), ("lixo.ofx", "nada aqui"),
            // O mês que ainda não teve nada (a Nubank manda só o cabeçalho): fica de fora, o resto segue.
            ("NU_NOV.csv", "Data,Valor,Identificador,Descrição\n"),
        });

        Assert.Equal(new[] { "6abf8bc7", "7cd9e0a1" }, previa.Linhas.Select(l => l.FitId)); // em ordem de data, uma vez cada
        Assert.Equal(new[] { "NU_SET.ofx", "NU_OUT.ofx" }, previa.Linhas.Select(l => l.Arquivo));
        Assert.Equal(5, previa.Arquivos!.Count);
        Assert.NotNull(previa.Arquivos.Single(a => a.Nome == "NU_NOV.csv").Erro);
        Assert.NotNull(previa.Arquivos.Single(a => a.Nome == "lixo.ofx").Erro);
        Assert.Equal(1, previa.Arquivos.Single(a => a.Nome == "NU_OUT.csv").Linhas);
        Assert.Null(previa.Arquivos.Single(a => a.Nome == "NU_OUT.csv").Erro);
    }

    // Somar arquivo relê todos: um arquivo vazio (0 bytes) no meio derrubava a leitura inteira (2026-11-22).
    [Fact]
    public async Task VariosArquivos_ArquivoVazio_FicaDeForaComOMotivo_EOsOutrosSaoLidos()
    {
        var c = Montar();
        var previa = await c.Svc.PreviewVariosAsync(c.Conta, c.Usuario, new List<(string, string)>
        {
            ("vazio.csv", ""), ("set.ofx", Stmt("20260905", "-12.00", "V1", "Compra no débito - MP *PHLANCHESLTDA")),
        });

        Assert.Single(previa.Linhas);
        Assert.Equal("O arquivo está vazio.", previa.Arquivos!.Single(a => a.Nome == "vazio.csv").Erro);
        Assert.Equal(1, previa.Arquivos!.Single(a => a.Nome == "set.ofx").Linhas);
    }

    // "Cadê o botão de ver as colunas?" (Gustavo, 2026-11-04): com dois CSV ele sumia, só existia no arquivo sozinho.
    [Fact]
    public async Task VariosArquivos_CsvDoMesmoBanco_VoltamComAsColunas_EAsQueAPessoaEscolheValemPraTodos()
    {
        var c = Montar();
        var agosto = "Data,Valor,Identificador,Descrição\n05/08/2026,-12.00,A1,Mercado\n06/08/2026,-3.00,A2,Padaria\n";
        var setembro = "Data,Valor,Identificador,Descrição\n07/09/2026,-20.00,S1,Posto\n";
        var arquivos = new List<(string, string)> { ("NU_AGO.csv", agosto), ("NU_SET.csv", setembro), ("NU_NOV.csv", "Data,Valor,Identificador,Descrição\n") };

        var previa = await c.Svc.PreviewVariosAsync(c.Conta, c.Usuario, arquivos);

        // O mesmo cabeçalho nos três: a prévia traz a tabela (a do arquivo com mais linhas) e as colunas usadas.
        Assert.Equal(("csv", false), (previa.Formato, previa.PrecisaMapear));
        Assert.Equal(new[] { "Data", "Valor", "Identificador", "Descrição" }, previa.Colunas);
        Assert.Equal(2, previa.Amostra!.Count);
        Assert.Equal((0, 3, 1), (previa.Mapeamento!.Data, previa.Mapeamento.Descricao, previa.Mapeamento.Valor));
        Assert.NotNull(previa.Assinatura);
        Assert.Equal(new[] { "Mercado", "Padaria", "Posto" }, previa.Linhas.Select(l => l.Descricao));

        // A pessoa troca a descrição pela coluna do identificador: vale pros dois arquivos.
        var trocada = await c.Svc.PreviewVariosAsync(c.Conta, c.Usuario, arquivos, new MapeamentoCsvDto(0, 2, 1, null, null, null, false));
        Assert.Equal(new[] { "A1", "A2", "S1" }, trocada.Linhas.Select(l => l.Descricao));
        Assert.Equal(2, trocada.Mapeamento!.Descricao);
    }

    [Fact]
    public async Task VariosArquivos_CsvDeBancosDiferentes_NaoTemTrocaDeColunas()
    {
        var c = Montar();
        var previa = await c.Svc.PreviewVariosAsync(c.Conta, c.Usuario, new List<(string, string)>
        {
            ("nubank.csv", "Data,Valor,Identificador,Descrição\n05/08/2026,-12.00,A1,Mercado\n"),
            ("outro.csv", "Data;Descrição;Valor\n06/08/2026;Padaria;-3,00\n"),
        });

        Assert.Equal("ofx", previa.Formato); // sem tabela: a tela não mostra "Trocar colunas"
        Assert.Null(previa.Colunas);
        Assert.Equal(2, previa.Linhas.Count);
    }

    [Fact]
    public async Task VariosArquivos_OQueJaEstaNaContaVemMarcado()
    {
        var c = Montar();
        var setembro = Stmt("20260905", "-12.00", "E1", "Compra no débito - MP *PHLANCHESLTDA");
        await Confirmar(c, await c.Svc.PreviewAsync(c.Conta, c.Usuario, "set.ofx", setembro));

        var previa = await c.Svc.PreviewVariosAsync(c.Conta, c.Usuario, new List<(string, string)>
        {
            ("set.ofx", setembro), ("out.ofx", Stmt("20261005", "-7.00", "E2", "Compra no débito - MP *PHLANCHESLTDA")),
        });
        Assert.Equal(new[] { true, false }, previa.Linhas.Select(l => l.Duplicada));
    }

    [Fact]
    public async Task VariosArquivos_AContaPrecisaSerDaPessoa()
    {
        var c = Montar();
        await Assert.ThrowsAsync<KeyNotFoundException>(() => c.Svc.PreviewVariosAsync(Guid.NewGuid(), c.Usuario,
            new List<(string, string)> { ("a.ofx", "x"), ("b.ofx", "y") }));
    }

    [Fact]
    public async Task ExcluirCategoriaMovendo_LevaAsRegrasJunto()
    {
        var c = Montar();
        var minha = new Categoria { Id = Guid.NewGuid(), Descricao = "Lanchinho", Finalidade = Finalidade.Despesa, UsuarioId = c.Usuario };
        c.Ctx.Categorias.Add(minha);
        c.Ctx.SaveChanges();
        await Confirmar(c, await c.Svc.PreviewAsync(c.Conta, c.Usuario, "a.ofx", Stmt("20261002", "-12.00", "F1", "Compra no débito - MP *PHLANCHESLTDA")),
            _ => minha.Id);

        await new CategoriaService(c.Ctx).DeletarAsync(minha.Id, c.Usuario, c.Alimentacao);

        Assert.Equal(c.Alimentacao, (await c.Ctx.RegrasCategoria.SingleAsync()).CategoriaId);
    }

    // ── Sugestão coletiva (2026-11-04): o que 3+ pessoas disseram de uma LOJA vale pros outros; Pix pra pessoa nunca ──

    private static void OutrasPessoasDisseram(Cenario c, string chave, Guid categoria, int quantas, bool compartilhavel = true)
    {
        for (var i = 0; i < quantas; i++)
        {
            var u = new Usuario { Id = Guid.NewGuid(), Email = $"p{i}-{Guid.NewGuid():N}@x.com", Nome = $"Pessoa {i}", PasswordHash = "x" };
            c.Ctx.Usuarios.Add(u);
            c.Ctx.RegrasCategoria.Add(new RegraCategoria
            {
                Id = Guid.NewGuid(), UsuarioId = u.Id, Chave = chave, Nome = chave[2..], Tipo = TipoTransacao.Despesa,
                CategoriaId = categoria, Compartilhavel = compartilhavel,
            });
        }
        c.Ctx.SaveChanges();
    }

    [Fact]
    public async Task Coletivo_TresPessoasDisseramQueALojaEhLazer_ASugestaoValePraMim()
    {
        var c = Montar();
        OutrasPessoasDisseram(c, "d:mp phlanchesltda", c.Lazer, 3);

        var previa = await c.Svc.PreviewAsync(c.Conta, c.Usuario, "x.ofx", Stmt("20261002", "-12.00", "G1", "Compra no débito - MP *PHLANCHESLTDA"));

        Assert.Equal((c.Lazer, "coletivo"), (previa.Linhas.Single().CategoriaSugeridaId, previa.Linhas.Single().SugestaoDe));
    }

    [Fact]
    public async Task Coletivo_DuasPessoasNaoBastam_EAMinhaRegraVenceOColetivo()
    {
        var c = Montar();
        OutrasPessoasDisseram(c, "d:mp phlanchesltda", c.Lazer, 2);
        var previa = await c.Svc.PreviewAsync(c.Conta, c.Usuario, "x.ofx", Stmt("20261002", "-12.00", "H1", "Compra no débito - MP *PHLANCHESLTDA"));
        Assert.Null(previa.Linhas.Single().CategoriaSugeridaId);

        // Com 3, vale; mas o que EU já disse vem antes.
        OutrasPessoasDisseram(c, "d:mp phlanchesltda", c.Lazer, 1);
        await Confirmar(c, await c.Svc.PreviewAsync(c.Conta, c.Usuario, "a.ofx", Stmt("20261003", "-12.00", "H2", "Compra no débito - MP *PHLANCHESLTDA")),
            _ => c.Alimentacao);
        var depois = await c.Svc.PreviewAsync(c.Conta, c.Usuario, "b.ofx", Stmt("20261004", "-12.00", "H3", "Compra no débito - MP *PHLANCHESLTDA"));
        Assert.Equal((c.Alimentacao, "regra"), (depois.Linhas.Single().CategoriaSugeridaId, depois.Linhas.Single().SugestaoDe));
    }

    [Fact]
    public async Task Coletivo_PixPraPessoaNuncaSaiDaConta_EACategoriaDaPessoaTambemNao()
    {
        var c = Montar();
        // Mesmo que 3 contas tenham regra pro mesmo nome de pessoa, Pix não é compartilhável: nada atravessa.
        OutrasPessoasDisseram(c, "d:beatriz exemplo lima", c.Lazer, 3, compartilhavel: false);
        var pix = await c.Svc.PreviewAsync(c.Conta, c.Usuario, "x.ofx",
            Stmt("20261002", "-100.00", "I1", "Transferência enviada pelo Pix - Beatriz Exemplo Lima - •••.321.654-•• - BANCO INTER (0077)"));
        Assert.Null(pix.Linhas.Single().CategoriaSugeridaId);

        // Categoria criada por outra pessoa (não é padrão) também não vira sugestão pra ninguém.
        var deOutro = new Categoria { Id = Guid.NewGuid(), Descricao = "Lanchinho", Finalidade = Finalidade.Despesa, UsuarioId = Guid.NewGuid() };
        c.Ctx.Categorias.Add(deOutro);
        c.Ctx.SaveChanges();
        OutrasPessoasDisseram(c, "d:kc grill", deOutro.Id, 3);
        var grill = await c.Svc.PreviewAsync(c.Conta, c.Usuario, "y.ofx", Stmt("20261002", "-25.00", "I2", "Compra no débito - KC GRILL"));
        Assert.Equal((c.Alimentacao, "conhecido"), (grill.Linhas.Single().CategoriaSugeridaId, grill.Linhas.Single().SugestaoDe));
    }

    [Fact]
    public async Task Confirmar_MarcaCompartilhavelSoNaCompraEmLoja()
    {
        var c = Montar();
        await Confirmar(c, await c.Svc.PreviewAsync(c.Conta, c.Usuario, "a.ofx", string.Concat(
            Stmt("20261002", "-12.00", "J1", "Compra no débito - MP *PHLANCHESLTDA"),
            Stmt("20261003", "-50.00", "J2", "Transferência enviada pelo Pix - Rodolpho Alexandre Dos Santos - •••.083.756-•• - MERCADO PAGO IP LTDA. (0323)"))),
            _ => c.Alimentacao);

        var regras = await c.Ctx.RegrasCategoria.ToDictionaryAsync(r => r.Chave, r => r.Compartilhavel);
        Assert.True(regras["d:mp phlanchesltda"]);
        Assert.False(regras["d:rodolpho alexandre dos santos"]);
    }
}
