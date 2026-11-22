using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Importacao;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// "Importações anteriores" (2026-11-05, primeira tela de Importar extrato): cada confirmação que pôs algum
/// lançamento na conta deixa um registro (conta, de que dia a que dia, quantos, quando), e a lista é só da pessoa.
/// </summary>
public class ImportacaoAnterioresTests
{
    private record Cenario(AppDbContext Ctx, Guid Usuario, Guid Nubank, Guid Itau, ImportacaoService Svc);

    private static Cenario Montar()
    {
        var ctx = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning)).Options);
        var usuario = new Usuario { Id = Guid.NewGuid(), Email = "g@x.com", Nome = "Titular Exemplo", PasswordHash = "x" };
        var nubank = new Conta { Id = Guid.NewGuid(), Nome = "Nubank", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuario.Id };
        var itau = new Conta { Id = Guid.NewGuid(), Nome = "Itaú", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuario.Id };
        ctx.AddRange(usuario, nubank, itau);
        ctx.SaveChanges();
        var svc = new ImportacaoService(ctx, new ExtratoImportService(), new TransacaoService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx)));
        return new Cenario(ctx, usuario.Id, nubank.Id, itau.Id, svc);
    }

    private static string Stmt(string data, string valor, string fit, string memo) =>
        $"<STMTTRN><DTPOSTED>{data}000000[-3:BRT]<TRNAMT>{valor}<FITID>{fit}<MEMO>{memo}</STMTTRN>";

    private static ConfirmarImportacaoDto Tudo(Guid conta, PreviewImportacaoDto previa) =>
        new(conta, previa.Linhas.Select(l => new LinhaImportarDto(l.Data, l.Descricao, l.Valor, l.Tipo, l.FitId, null)).ToList());

    // A conta se escolhe na prévia (2026-11-06): sem ela, a leitura é a mesma, só nada vem como "já no app".
    [Fact]
    public async Task Previa_SemConta_LeIgual_MasNaoDizOQueJaEstaNoApp()
    {
        var c = Montar();
        var extrato = Stmt("20261006", "-12.00", "A1", "Compra no débito - Padaria") + Stmt("20261020", "-30.00", "A2", "Compra no débito - Mercado");
        var primeira = await c.Svc.PreviewAsync(c.Nubank, c.Usuario, "nubank.ofx", extrato);
        await c.Svc.ConfirmarAsync(Tudo(c.Nubank, primeira), c.Usuario, "chave-1");

        var semConta = await c.Svc.PreviewAsync(null, c.Usuario, "nubank.ofx", extrato);
        var comConta = await c.Svc.PreviewAsync(c.Nubank, c.Usuario, "nubank.ofx", extrato);

        Assert.Equal(2, semConta.Linhas.Count);
        Assert.All(semConta.Linhas, l => Assert.False(l.Duplicada));
        Assert.Equal(new[] { "Padaria", "Mercado" }, semConta.Linhas.Select(l => l.Estabelecimento));
        Assert.All(comConta.Linhas, l => Assert.True(l.Duplicada));
        // Conta de outra pessoa continua recusada.
        await Assert.ThrowsAnyAsync<Exception>(() => c.Svc.PreviewAsync(Guid.NewGuid(), c.Usuario, "nubank.ofx", extrato));
    }

    [Fact]
    public async Task Confirmar_GuardaAImportacao_ComAContaOPeriodoEQuantosEntraram()
    {
        var c = Montar();
        var previa = await c.Svc.PreviewAsync(c.Nubank, c.Usuario, "nubank.ofx",
            Stmt("20261006", "-12.00", "A1", "Compra no débito - Padaria")
            + Stmt("20261020", "-30.00", "A2", "Compra no débito - Mercado")
            + Stmt("20261002", "100.00", "A3", "Compra no débito - Estorno Loja"));

        var resultado = await c.Svc.ConfirmarAsync(Tudo(c.Nubank, previa), c.Usuario, "chave-1");

        Assert.Equal(3, resultado.Importadas);
        var a = Assert.Single(await c.Svc.ListarAnterioresAsync(c.Usuario));
        Assert.Equal((c.Nubank, "Nubank", new DateOnly(2026, 10, 2), new DateOnly(2026, 10, 20), 3), (a.ContaId, a.ContaNome, a.De, a.Ate, a.Quantidade));
        Assert.True(a.CriadoEm > DateTime.UtcNow.AddMinutes(-1)); // o instante da confirmação
    }

    [Fact]
    public async Task ConfirmacaoRepetida_OuArquivoQueJaEstaNaConta_NaoGravaOutraImportacao()
    {
        var c = Montar();
        var previa = await c.Svc.PreviewAsync(c.Nubank, c.Usuario, "nubank.ofx", Stmt("20261006", "-12.00", "A1", "Compra no débito - Padaria"));
        await c.Svc.ConfirmarAsync(Tudo(c.Nubank, previa), c.Usuario, "chave-1");

        // A mesma confirmação de novo (clique duplo, rede que caiu): replay, nada novo.
        Assert.True((await c.Svc.ConfirmarAsync(Tudo(c.Nubank, previa), c.Usuario, "chave-1")).Repetido);
        // O mesmo arquivo em outra tentativa: tudo já está na conta, não entrou nada, não vira importação.
        var denovo = await c.Svc.ConfirmarAsync(Tudo(c.Nubank, previa), c.Usuario, "chave-2");
        Assert.Equal((0, 1), (denovo.Importadas, denovo.JaExistiam));

        Assert.Single(await c.Svc.ListarAnterioresAsync(c.Usuario));
    }

    [Fact]
    public async Task Lista_EhSoDaPessoa_DaMaisNovaPraMaisAntiga_ComONomeDaConta()
    {
        var c = Montar();
        var outra = Guid.NewGuid();
        c.Ctx.ImportacoesExtrato.AddRange(
            new ImportacaoExtrato { Id = Guid.NewGuid(), UsuarioId = c.Usuario, ContaId = c.Nubank, CriadoEm = new DateTime(2026, 9, 1, 12, 0, 0), De = new DateOnly(2026, 8, 1), Ate = new DateOnly(2026, 8, 31), Quantidade = 40 },
            new ImportacaoExtrato { Id = Guid.NewGuid(), UsuarioId = c.Usuario, ContaId = c.Itau, CriadoEm = new DateTime(2026, 10, 2, 9, 0, 0), De = new DateOnly(2026, 9, 1), Ate = new DateOnly(2026, 9, 30), Quantidade = 22 },
            new ImportacaoExtrato { Id = Guid.NewGuid(), UsuarioId = outra, ContaId = c.Nubank, CriadoEm = new DateTime(2026, 10, 3, 9, 0, 0), De = new DateOnly(2026, 9, 1), Ate = new DateOnly(2026, 9, 30), Quantidade = 5 });
        c.Ctx.SaveChanges();

        var lista = await c.Svc.ListarAnterioresAsync(c.Usuario);

        Assert.Equal(new[] { ("Itaú", 22), ("Nubank", 40) }, lista.Select(i => (i.ContaNome, i.Quantidade)));
        Assert.Empty(await c.Svc.ListarAnterioresAsync(Guid.NewGuid()));
    }
}
