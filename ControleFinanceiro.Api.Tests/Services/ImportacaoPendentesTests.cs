using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Importacao;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Fila de pendentes (2026-11-22, Gustavo: "a ideia é categorizar tudo"): o lançamento que entrou sem categoria fica
/// numa fila até a pessoa resolver. Aqui: o que entra na fila, de quem é, e o categorizar (dono, categoria, tipo).
/// </summary>
public class ImportacaoPendentesTests
{
    private sealed record Cenario(AppDbContext Ctx, ImportacaoService Svc, Guid Usuario, Guid Conta, Categoria Alimentacao, Categoria Salario);

    private static Cenario Montar()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        var ctx = new AppDbContext(options);
        var usuario = Guid.NewGuid();
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Conta de teste", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuario };
        var alimentacao = new Categoria { Id = Guid.NewGuid(), Descricao = "Alimentação", Finalidade = Finalidade.Despesa };
        var salario = new Categoria { Id = Guid.NewGuid(), Descricao = "Salário", Finalidade = Finalidade.Receita };
        ctx.Contas.Add(conta);
        ctx.Categorias.AddRange(alimentacao, salario);
        ctx.SaveChanges();
        var transacaoService = new TransacaoService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx));
        return new Cenario(ctx, new ImportacaoService(ctx, new ExtratoImportService(), transacaoService), usuario, conta.Id, alimentacao, salario);
    }

    private static Transacao Lancar(AppDbContext ctx, Guid contaId, string descricao, decimal valor, TipoTransacao tipo = TipoTransacao.Despesa,
        Guid? categoriaId = null, Action<Transacao>? ajuste = null)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = descricao, Valor = valor, Tipo = tipo, Data = new DateOnly(2026, 11, 10),
            ContaId = contaId, Ativo = true, StatusTransacao = StatusTransacao.Executado, CategoriaId = categoriaId,
        };
        ajuste?.Invoke(t);
        ctx.Transacoes.Add(t);
        ctx.SaveChanges();
        return t;
    }

    [Fact]
    public async Task Fila_SoOQueEstaSemCategoriaEContaComoGastoOuRenda()
    {
        var c = Montar();
        var semCategoria = Lancar(c.Ctx, c.Conta, "COMPRA CARTAO DEB PADARIA EXEMPLO", 23.5m);
        Lancar(c.Ctx, c.Conta, "COMPRA CARTAO DEB MERCADO EXEMPLO", 80m, categoriaId: c.Alimentacao.Id);       // já tem categoria
        Lancar(c.Ctx, c.Conta, "TRANSFERENCIA ENTRE CONTAS", 500m, ajuste: t => t.EhTransferencia = true);       // não leva categoria
        Lancar(c.Ctx, c.Conta, "PAGAMENTO DE FATURA", 900m, ajuste: t => t.EhPagamentoFatura = true);            // idem
        Lancar(c.Ctx, c.Conta, "COMPRA EXCLUIDA", 10m, ajuste: t => t.Ativo = false);                            // excluído
        Lancar(c.Ctx, c.Conta, "COMPRA CANCELADA", 10m, ajuste: t => t.StatusTransacao = StatusTransacao.Cancelado);

        var fila = await c.Svc.ListarPendentesAsync(c.Usuario);

        Assert.Equal(1, fila.Total);
        var item = Assert.Single(fila.Itens);
        Assert.Equal(semCategoria.Id, item.Id);
        Assert.Equal("Conta de teste", item.Origem);
        Assert.False(string.IsNullOrWhiteSpace(item.Lugar));
        Assert.StartsWith("d:", item.Chave);
        Assert.Equal(1, await c.Svc.QuantidadePendentesAsync(c.Usuario));
    }

    [Fact]
    public async Task Fila_NaoMostraLancamentoDeOutraPessoa()
    {
        var c = Montar();
        var outro = Guid.NewGuid();
        var contaDoOutro = new Conta { Id = Guid.NewGuid(), Nome = "Conta do outro", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = outro };
        c.Ctx.Contas.Add(contaDoOutro);
        c.Ctx.SaveChanges();
        Lancar(c.Ctx, contaDoOutro.Id, "COMPRA CARTAO DEB LOJA EXEMPLO", 40m);

        var fila = await c.Svc.ListarPendentesAsync(c.Usuario);

        Assert.Equal(0, fila.Total);
        Assert.Empty(fila.Itens);
    }

    [Fact]
    public async Task Categorizar_GravaNosLancamentosDoLugar_SaiDaFila_EAprendeARegra()
    {
        var c = Montar();
        var a = Lancar(c.Ctx, c.Conta, "COMPRA CARTAO DEB PADARIA EXEMPLO", 23.5m);
        var b = Lancar(c.Ctx, c.Conta, "COMPRA CARTAO DEB PADARIA EXEMPLO", 18.9m);
        var outroLugar = Lancar(c.Ctx, c.Conta, "COMPRA CARTAO DEB FARMACIA EXEMPLO", 60m);

        var r = await c.Svc.CategorizarPendentesAsync(c.Usuario, new CategorizarPendentesDto([a.Id, b.Id], c.Alimentacao.Id));

        Assert.Equal(2, r.Categorizados);
        Assert.Equal(1, r.Restam);
        var gravados = await c.Ctx.Transacoes.AsNoTracking().Where(t => t.Id == a.Id || t.Id == b.Id).ToListAsync();
        Assert.All(gravados, t => Assert.Equal(c.Alimentacao.Id, t.CategoriaId));
        Assert.Null((await c.Ctx.Transacoes.AsNoTracking().FirstAsync(t => t.Id == outroLugar.Id)).CategoriaId);
        // O valor e a conta não mudam: categorizar não mexe em dinheiro.
        Assert.All(gravados, t => Assert.Equal(c.Conta, t.ContaId));
        Assert.Contains(gravados, t => t.Valor == 23.5m);
        // O lugar virou regra da pessoa: a próxima importação já sugere.
        var regra = Assert.Single(await c.Ctx.RegrasCategoria.AsNoTracking().ToListAsync());
        Assert.Equal(c.Usuario, regra.UsuarioId);
        Assert.Equal(c.Alimentacao.Id, regra.CategoriaId);
    }

    [Fact]
    public async Task Categorizar_SemLembrar_NaoCriaRegra()
    {
        var c = Montar();
        var a = Lancar(c.Ctx, c.Conta, "COMPRA CARTAO DEB PADARIA EXEMPLO", 23.5m);

        await c.Svc.CategorizarPendentesAsync(c.Usuario, new CategorizarPendentesDto([a.Id], c.Alimentacao.Id, Lembrar: false));

        Assert.Empty(await c.Ctx.RegrasCategoria.AsNoTracking().ToListAsync());
    }

    [Fact]
    public async Task Categorizar_LancamentoDeOutraPessoa_404_ENadaMuda()
    {
        var c = Montar();
        var meu = Lancar(c.Ctx, c.Conta, "COMPRA CARTAO DEB PADARIA EXEMPLO", 23.5m);
        var outro = Guid.NewGuid();
        var contaDoOutro = new Conta { Id = Guid.NewGuid(), Nome = "Conta do outro", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = outro };
        c.Ctx.Contas.Add(contaDoOutro);
        c.Ctx.SaveChanges();
        var dele = Lancar(c.Ctx, contaDoOutro.Id, "COMPRA CARTAO DEB LOJA EXEMPLO", 40m);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            c.Svc.CategorizarPendentesAsync(c.Usuario, new CategorizarPendentesDto([meu.Id, dele.Id], c.Alimentacao.Id)));

        // Tudo ou nada: nem o meu foi categorizado.
        Assert.All(await c.Ctx.Transacoes.AsNoTracking().ToListAsync(), t => Assert.Null(t.CategoriaId));
    }

    [Fact]
    public async Task Categorizar_LancamentoQueJaTemCategoria_404()
    {
        var c = Montar();
        var jaTem = Lancar(c.Ctx, c.Conta, "COMPRA CARTAO DEB MERCADO EXEMPLO", 80m, categoriaId: c.Alimentacao.Id);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            c.Svc.CategorizarPendentesAsync(c.Usuario, new CategorizarPendentesDto([jaTem.Id], c.Alimentacao.Id)));
    }

    [Fact]
    public async Task Categorizar_CategoriaDeOutraPessoa_404()
    {
        var c = Montar();
        var a = Lancar(c.Ctx, c.Conta, "COMPRA CARTAO DEB PADARIA EXEMPLO", 23.5m);
        var alheia = new Categoria { Id = Guid.NewGuid(), Descricao = "Categoria alheia", Finalidade = Finalidade.Despesa, UsuarioId = Guid.NewGuid() };
        c.Ctx.Categorias.Add(alheia);
        c.Ctx.SaveChanges();

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            c.Svc.CategorizarPendentesAsync(c.Usuario, new CategorizarPendentesDto([a.Id], alheia.Id)));
        Assert.Null((await c.Ctx.Transacoes.AsNoTracking().FirstAsync(t => t.Id == a.Id)).CategoriaId);
    }

    [Fact]
    public async Task Categorizar_CategoriaDeReceitaNumaDespesa_Recusa()
    {
        var c = Montar();
        var despesa = Lancar(c.Ctx, c.Conta, "COMPRA CARTAO DEB PADARIA EXEMPLO", 23.5m);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            c.Svc.CategorizarPendentesAsync(c.Usuario, new CategorizarPendentesDto([despesa.Id], c.Salario.Id)));
        Assert.Null((await c.Ctx.Transacoes.AsNoTracking().FirstAsync(t => t.Id == despesa.Id)).CategoriaId);
    }

    [Fact]
    public async Task Categorizar_ComAcertos_GravaDescricaoHoraEFormaDePagamento_EARegraSegueODoBanco()
    {
        var c = Montar();
        var a = Lancar(c.Ctx, c.Conta, "COMPRA CARTAO DEB PADARIA EXEMPLO", 23.5m);

        await c.Svc.CategorizarPendentesAsync(c.Usuario, new CategorizarPendentesDto([a.Id], c.Alimentacao.Id,
            Ajustes: [new AjustePendenteDto(a.Id, "  Pão de sábado  ", new TimeOnly(8, 30), (int)MeioPagamento.Debito)]));

        var gravado = await c.Ctx.Transacoes.AsNoTracking().FirstAsync(t => t.Id == a.Id);
        Assert.Equal("Pão de sábado", gravado.Descricao);
        Assert.Equal(new TimeOnly(8, 30), gravado.Hora);
        Assert.Equal(MeioPagamento.Debito, gravado.MeioPagamento);
        Assert.Equal(23.5m, gravado.Valor);
        // A regra é do lugar que o banco escreveu ("padaria exemplo"), não do texto que a pessoa pôs por cima.
        var regra = Assert.Single(await c.Ctx.RegrasCategoria.AsNoTracking().ToListAsync());
        Assert.Contains("padaria", regra.Chave);
    }

    [Fact]
    public async Task Categorizar_AcertoComDescricaoVaziaOuCredito_Recusa_ENadaMuda()
    {
        var c = Montar();
        var a = Lancar(c.Ctx, c.Conta, "COMPRA CARTAO DEB PADARIA EXEMPLO", 23.5m);

        await Assert.ThrowsAsync<ArgumentException>(() => c.Svc.CategorizarPendentesAsync(c.Usuario,
            new CategorizarPendentesDto([a.Id], c.Alimentacao.Id, Ajustes: [new AjustePendenteDto(a.Id, "   ")])));
        await Assert.ThrowsAnyAsync<Exception>(() => c.Svc.CategorizarPendentesAsync(c.Usuario,
            new CategorizarPendentesDto([a.Id], c.Alimentacao.Id, Ajustes: [new AjustePendenteDto(a.Id, MeioPagamento: (int)MeioPagamento.Credito)])));

        var gravado = await c.Ctx.Transacoes.AsNoTracking().FirstAsync(t => t.Id == a.Id);
        Assert.Null(gravado.CategoriaId);
        Assert.Equal("COMPRA CARTAO DEB PADARIA EXEMPLO", gravado.Descricao);
    }

    [Fact]
    public async Task Categorizar_AcertoDeLancamentoForaDoPedido_EIgnorado()
    {
        var c = Montar();
        var a = Lancar(c.Ctx, c.Conta, "COMPRA CARTAO DEB PADARIA EXEMPLO", 23.5m);
        var outro = Lancar(c.Ctx, c.Conta, "COMPRA CARTAO DEB FARMACIA EXEMPLO", 60m);

        await c.Svc.CategorizarPendentesAsync(c.Usuario, new CategorizarPendentesDto([a.Id], c.Alimentacao.Id,
            Ajustes: [new AjustePendenteDto(outro.Id, "Mexeram em mim")]));

        var intocado = await c.Ctx.Transacoes.AsNoTracking().FirstAsync(t => t.Id == outro.Id);
        Assert.Equal("COMPRA CARTAO DEB FARMACIA EXEMPLO", intocado.Descricao);
        Assert.Null(intocado.CategoriaId);
    }

    [Fact]
    public async Task Categorizar_SubcategoriaDeOutraCategoria_Recusa()
    {
        var c = Montar();
        var a = Lancar(c.Ctx, c.Conta, "COMPRA CARTAO DEB PADARIA EXEMPLO", 23.5m);
        var subDeOutra = new Subcategoria { Id = Guid.NewGuid(), Nome = "Bônus", CategoriaId = c.Salario.Id };
        c.Ctx.Subcategorias.Add(subDeOutra);
        c.Ctx.SaveChanges();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            c.Svc.CategorizarPendentesAsync(c.Usuario, new CategorizarPendentesDto([a.Id], c.Alimentacao.Id, subDeOutra.Id)));
    }
}
