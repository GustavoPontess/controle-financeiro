using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Passo 7 do espaço da família (decisão do Gustavo 2026-10-19): quem EXCLUI A CONTA não trava mais a purga. A família
/// fica só com os números das despesas divididas e do dinheiro entre eles, em nome de "Membro que saiu"; o equilíbrio
/// dos meses passados continua certo; o resto da pessoa some; a família criada por ela passa pro membro mais antigo.
/// </summary>
public class FamiliaAoExcluirContaTests
{
    private sealed record Casa(AppDbContext Ctx, Guid FamiliaId, Guid Gustavo, Guid Gabriel, Guid ContaGabriel, Guid Pessoal);

    private static async Task<Casa> Build()
    {
        var ctx = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        Usuario Pessoa(string nome)
        {
            var u = new Usuario { Id = Guid.NewGuid(), Email = $"{nome.ToLower()}@t.com", Nome = nome, PasswordHash = "x", Status = StatusUsuario.Ativo };
            ctx.Usuarios.Add(u);
            return u;
        }
        var gustavo = Pessoa("Gustavo Pontes");
        var gabriel = Pessoa("Gabriel Dev");
        var moradia = new Categoria { Id = Guid.NewGuid(), Descricao = "Moradia", Finalidade = Finalidade.Despesa };
        var pessoal = new Categoria { Id = Guid.NewGuid(), Descricao = "Hobby do Gabriel", Finalidade = Finalidade.Despesa, UsuarioId = gabriel.Id };
        var conta = new Conta { Id = Guid.NewGuid(), Nome = "Conta do Gabriel", Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = gabriel.Id };
        ctx.Categorias.AddRange(moradia, pessoal);
        ctx.Contas.Add(conta);
        ctx.SaveChanges();
        // Gabriel criou a família; Gustavo entrou depois.
        var familia = await new FamiliaService(ctx).CriarAsync(new CriarFamiliaDto("Casa"), gabriel.Id);
        ctx.MembrosFamilia.Add(new MembroFamilia { Id = Guid.NewGuid(), FamiliaId = familia.Id, UsuarioId = gustavo.Id, Papel = "Companheiro", PapelPermissao = PapelFamilia.Membro, EntrouEm = DateTime.UtcNow.AddMinutes(1) });
        ctx.SaveChanges();
        return new Casa(ctx, familia.Id, gustavo.Id, gabriel.Id, conta.Id, pessoal.Id);
    }

    private static DespesaCompartilhadaService Despesas(Casa c) => new(c.Ctx, TestHelpers.Notif(c.Ctx), new RateioService(c.Ctx));

    private static async Task<Transacao> Dividida(Casa c, Guid quem, decimal valor, string descricao, Guid? categoria = null, Guid? conta = null)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = descricao, Valor = valor, Tipo = TipoTransacao.Despesa, CriadoPor = quem,
            Data = new DateOnly(2026, 10, 10), CategoriaId = categoria, ContaId = conta, StatusTransacao = StatusTransacao.Executado,
        };
        c.Ctx.Transacoes.Add(t);
        c.Ctx.SaveChanges();
        await Despesas(c).CompartilharAsync(t.Id, c.FamiliaId, quem);
        return t;
    }

    private static async Task Purgar(Casa c, Guid usuarioId)
    {
        var u = await c.Ctx.Usuarios.SingleAsync(x => x.Id == usuarioId);
        u.Status = StatusUsuario.MarcadoParaExclusao;
        u.MarcadoExclusaoEm = DateTime.UtcNow.AddDays(-31);
        c.Ctx.SaveChanges();
        await new AdminLgpdService(c.Ctx, new AdminAuditService(c.Ctx), TestHelpers.NotifAdmin(c.Ctx)).PurgarAsync(usuarioId, Guid.NewGuid(), "admin@t.com", u.Email);
    }

    [Fact]
    public async Task ExcluirAConta_AFamiliaFicaSoComOsNumeros_EOEquilibrioDoPassadoNaoMuda()
    {
        var c = await Build();
        var categoriaModadia = await c.Ctx.Categorias.Where(x => x.Descricao == "Moradia").Select(x => x.Id).SingleAsync();
        await Dividida(c, c.Gabriel, 200m, "Aluguel da casa da praia", categoriaModadia, c.ContaGabriel);
        await Dividida(c, c.Gabriel, 40m, "Peças do drone", c.Pessoal, c.ContaGabriel);
        await Dividida(c, c.Gustavo, 100m, "Luz");
        var antes = (await Despesas(c).ObterBalancoAsync(c.FamiliaId, c.Gustavo, 10, 2026)).Saldos.Single(s => s.UsuarioId == c.Gustavo).Saldo;

        await Purgar(c, c.Gabriel);

        Assert.False(await c.Ctx.Usuarios.AnyAsync(u => u.Id == c.Gabriel));
        Assert.False(await c.Ctx.Usuarios.AnyAsync(u => u.Email == "gabriel dev@t.com" || u.Nome == "Gabriel Dev"));
        var balanco = await Despesas(c).ObterBalancoAsync(c.FamiliaId, c.Gustavo, 10, 2026);
        Assert.Equal(antes, balanco.Saldos.Single(s => s.UsuarioId == c.Gustavo).Saldo); // o passado não muda
        var quemSaiu = balanco.Saldos.Single(s => s.UsuarioId != c.Gustavo);
        Assert.Equal(FamiliaAoExcluirConta.NomeMembroQueSaiu, quemSaiu.Nome);
        Assert.Equal(240m, quemSaiu.Pagou);

        // Só os números: sem descrição, sem conta, sem categoria própria.
        var lista = await Despesas(c).ListarDespesasAsync(c.FamiliaId, c.Gustavo, 10, 2026);
        Assert.Contains(lista, d => d.Descricao == "Moradia" && d.Valor == 200m && d.PagadorNome == FamiliaAoExcluirConta.NomeMembroQueSaiu);
        Assert.Contains(lista, d => d.Descricao == "Despesa da casa" && d.Valor == 40m && d.CategoriaNome == null);
        Assert.DoesNotContain(lista, d => d.Descricao.Contains("praia") || d.Descricao.Contains("drone"));
        Assert.False(await c.Ctx.Transacoes.IgnoreQueryFilters().AnyAsync(t => t.ContaId == c.ContaGabriel));
    }

    [Fact]
    public async Task AFamiliaQueAPessoaCriou_PassaProMembroMaisAntigo_EElaApareceEmQuemSaiu()
    {
        var c = await Build();
        await Purgar(c, c.Gabriel);

        var familia = await c.Ctx.Familias.SingleAsync(f => f.Id == c.FamiliaId);
        Assert.True(familia.Ativa);
        Assert.Equal(c.Gustavo, familia.CriadoPorUsuarioId);
        var detalhe = await new FamiliaService(c.Ctx).ObterDetalheAsync(c.FamiliaId, c.Gustavo);
        Assert.True(detalhe.EhAdmin);
        var saiu = Assert.Single(detalhe.QuemSaiu!);
        Assert.Equal(FamiliaAoExcluirConta.NomeMembroQueSaiu, saiu.Nome);
        Assert.NotNull(saiu.SaiuEm);
    }

    [Fact]
    public async Task DinheiroEntreVoces_FicaComOValor_SemANota()
    {
        var c = await Build();
        var acerto = await new AcertoService(c.Ctx, TestHelpers.Notif(c.Ctx), TestHelpers.EventLog(c.Ctx)).RegistrarAsync(c.FamiliaId, c.Gustavo,
            new RegistrarAcertoDto(c.Gabriel, c.Gustavo, 50m, 10, 2026, "Pix do Gabriel pro mercado", Guid.NewGuid().ToString()));

        await Purgar(c, c.Gabriel);

        var a = await c.Ctx.AcertosContas.SingleAsync(x => x.Id == acerto.Id);
        Assert.Equal(50m, a.Valor);
        Assert.Null(a.Observacao);
        Assert.NotEqual(c.Gabriel, a.DeUsuarioId);
        Assert.Equal(StatusUsuario.Removido, (await c.Ctx.Usuarios.SingleAsync(u => u.Id == a.DeUsuarioId)).Status);
    }

    [Fact]
    public async Task QuemSoSaiuDaFamilia_ContinuaComNomeEmQuemSaiu()
    {
        var c = await Build();
        var membroGustavo = await c.Ctx.MembrosFamilia.SingleAsync(m => m.UsuarioId == c.Gustavo);
        await new FamiliaService(c.Ctx).RemoverMembroAsync(c.FamiliaId, membroGustavo.Id, c.Gabriel);

        var detalhe = await new FamiliaService(c.Ctx).ObterDetalheAsync(c.FamiliaId, c.Gabriel);
        Assert.Equal("Gustavo Pontes", Assert.Single(detalhe.QuemSaiu!).Nome);
    }
}
