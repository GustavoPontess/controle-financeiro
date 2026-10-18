using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.DTOs.Renda;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Renda de cada um e o que a família vê (docs/features/familia/renda-e-visibilidade.md): recebido = o que caiu
/// em renda; previsto = contas fixas + variável esperada (herdada do último mês); dinheiro que volta e o que não é
/// resultado ficam fora; a família só vê o que a própria pessoa liberou, e calculado no servidor pra quem pede.
/// </summary>
public class RendaServiceTests
{
    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static Guid SeedUsuario(AppDbContext ctx, string email, string nome = "Pessoa")
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = email, Nome = nome, PasswordHash = "x" };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u.Id;
    }

    private static Categoria SeedCategoria(AppDbContext ctx, string descricao, Guid? usuarioId = null)
    {
        var c = new Categoria { Id = Guid.NewGuid(), Descricao = descricao, Finalidade = Finalidade.Receita, UsuarioId = usuarioId };
        ctx.Categorias.Add(c);
        ctx.SaveChanges();
        return c;
    }

    private static Transacao Receita(AppDbContext ctx, Guid usuarioId, decimal valor, DateOnly data, Categoria? categoria,
        StatusTransacao status = StatusTransacao.Executado, Guid? recorrente = null, Action<Transacao>? ajusta = null)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "receita", Valor = valor, Tipo = TipoTransacao.Receita, Data = data,
            CriadoPor = usuarioId, CategoriaId = categoria?.Id, StatusTransacao = status, Ativo = true,
            RecorrenteOrigemId = recorrente,
        };
        ajusta?.Invoke(t);
        ctx.Transacoes.Add(t);
        ctx.SaveChanges();
        return t;
    }

    [Fact]
    public async Task ObterMes_RecebidoEhOQueCaiuEmRenda_ForaDinheiroQueVoltaEOQueNaoEhResultado()
    {
        var ctx = CreateContext();
        var eu = SeedUsuario(ctx, "eu@test.com");
        var outro = SeedUsuario(ctx, "outro@test.com");
        var renda = SeedCategoria(ctx, "Renda");
        var volta = SeedCategoria(ctx, RendaService.CategoriaDinheiroQueVolta);
        var minhaVolta = SeedCategoria(ctx, RendaService.CategoriaDinheiroQueVolta, eu); // da pessoa: conta (só a padrão fica fora)
        var mes = new DateOnly(2026, 10, 1);
        Receita(ctx, eu, 3000m, mes.AddDays(4), renda);                               // salário: conta
        Receita(ctx, eu, 450m, mes.AddDays(17), null);                                 // sem categoria: conta (receita é renda)
        Receita(ctx, eu, 80m, mes.AddDays(10), volta);                                 // cashback padrão: fora
        Receita(ctx, eu, 20m, mes.AddDays(11), minhaVolta);                            // categoria da pessoa com o mesmo nome: conta
        Receita(ctx, eu, 500m, mes.AddDays(2), renda, ajusta: t => t.EhSaldoInicial = true);     // saldo inicial: fora
        Receita(ctx, eu, 900m, mes.AddDays(3), renda, ajusta: t => t.EhTransferencia = true);    // transferência: fora
        Receita(ctx, eu, 100m, mes.AddDays(5), renda, StatusTransacao.Cancelado);               // cancelada: fora
        Receita(ctx, eu, 1200m, mes.AddDays(25), renda, StatusTransacao.Previsao);              // ainda não caiu: não é recebido
        Receita(ctx, eu, 999m, mes.AddMonths(1), renda);                                        // outro mês: fora
        Receita(ctx, outro, 5000m, mes.AddDays(4), renda);                                      // de outra pessoa: fora

        var r = await new RendaService(ctx).ObterMesAsync(eu, 2026, 10);

        Assert.Equal(3470m, r.Recebido);
        Assert.Equal(4, r.Entradas.Count);                 // as 3 recebidas + a prevista (aparece como não recebida)
        Assert.Contains(r.Entradas, e => e.Valor == 1200m && !e.Recebida);
        Assert.Equal(0m, r.Fixas);                         // nenhuma veio de conta fixa
        Assert.Equal(0m, r.Previsto);
        Assert.Equal(0m, r.Falta);
    }

    [Fact]
    public async Task ObterMes_PrevistoEhFixasMaisVariavel_EAVariavelVemDoUltimoMesQueTem()
    {
        var ctx = CreateContext();
        var eu = SeedUsuario(ctx, "eu@test.com");
        var renda = SeedCategoria(ctx, "Renda");
        var contaFixa = Guid.NewGuid();
        var mes = new DateOnly(2026, 10, 1);
        Receita(ctx, eu, 3000m, mes.AddDays(4), renda, recorrente: contaFixa);                          // salário caiu
        Receita(ctx, eu, 250m, mes.AddDays(0), renda, StatusTransacao.Previsao, recorrente: contaFixa); // aluguel ainda previsto
        Receita(ctx, eu, 400m, mes.AddDays(12), renda);                                                 // comissão que caiu
        var svc = new RendaService(ctx);
        // A variável foi definida em agosto; setembro e outubro herdam.
        await svc.DefinirVariavelEsperadaAsync(eu, new DefinirVariavelEsperadaDto(2026, 8, 1200m));

        var r = await svc.ObterMesAsync(eu, 2026, 10);

        Assert.Equal(3250m, r.Fixas);
        Assert.Equal(1200m, r.VariavelEsperada);
        Assert.False(r.VariavelDoMes);
        Assert.Equal(4450m, r.Previsto);
        Assert.Equal(3400m, r.Recebido);
        Assert.Equal(1050m, r.Falta);

        // Definir no próprio mês passa a valer; apagar (null) volta a herdar; negativo é recusado.
        var doMes = await svc.DefinirVariavelEsperadaAsync(eu, new DefinirVariavelEsperadaDto(2026, 10, 0m));
        Assert.True(doMes.VariavelDoMes);
        Assert.Equal(3250m, doMes.Previsto);
        var apagou = await svc.DefinirVariavelEsperadaAsync(eu, new DefinirVariavelEsperadaDto(2026, 10, null));
        Assert.False(apagou.VariavelDoMes);
        Assert.Equal(1200m, apagou.VariavelEsperada);
        await Assert.ThrowsAsync<ArgumentException>(() => svc.DefinirVariavelEsperadaAsync(eu, new DefinirVariavelEsperadaDto(2026, 10, -1m)));
        await Assert.ThrowsAsync<ArgumentException>(() => svc.ObterMesAsync(eu, 2026, 13));
    }

    [Fact]
    public async Task ObterMes_SugestaoEhAMediaDosMesesAnterioresComRenda()
    {
        var ctx = CreateContext();
        var eu = SeedUsuario(ctx, "eu@test.com");
        var renda = SeedCategoria(ctx, "Renda");
        Receita(ctx, eu, 3000m, new DateOnly(2026, 9, 5), renda);
        Receita(ctx, eu, 500m, new DateOnly(2026, 9, 20), renda);
        Receita(ctx, eu, 2000m, new DateOnly(2026, 7, 5), renda);
        Receita(ctx, eu, 9999m, new DateOnly(2026, 6, 5), renda); // fora da janela de 3 meses
        var svc = new RendaService(ctx);

        Assert.Equal(2750m, (await svc.ObterMesAsync(eu, 2026, 10)).SugestaoMedia3Meses); // (3500 + 2000) / 2 meses com renda
        Assert.Null((await svc.ObterMesAsync(eu, 2026, 3)).SugestaoMedia3Meses);
    }

    // ── Família ──

    private static async Task<(Guid familiaId, Guid admin, Guid ana, Guid bia)> SeedFamilia(AppDbContext ctx)
    {
        var admin = SeedUsuario(ctx, "admin@test.com", "Admin");
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familia = await new FamiliaService(ctx).CriarAsync(new CriarFamiliaDto("Casa"), admin);
        foreach (var (u, papel) in new[] { (ana, PapelFamilia.Membro), (bia, PapelFamilia.Dependente) })
            ctx.MembrosFamilia.Add(new MembroFamilia { Id = Guid.NewGuid(), FamiliaId = familia.Id, UsuarioId = u, Papel = "x", PapelPermissao = papel, Ativo = true });
        ctx.SaveChanges();
        return (familia.Id, admin, ana, bia);
    }

    private static MembroFamilia Membro(AppDbContext ctx, Guid familiaId, Guid usuarioId) =>
        ctx.MembrosFamilia.First(m => m.FamiliaId == familiaId && m.UsuarioId == usuarioId);

    [Fact]
    public async Task RendaDaFamilia_SoMostraQuemLiberouPraQuemPede_EQuemSoVeNuncaVeOsOutros()
    {
        var ctx = CreateContext();
        var (familiaId, admin, ana, bia) = await SeedFamilia(ctx);
        var renda = SeedCategoria(ctx, "Renda");
        var mes = new DateOnly(2026, 10, 1);
        Receita(ctx, admin, 8000m, mes.AddDays(4), renda);
        Receita(ctx, ana, 3000m, mes.AddDays(4), renda);
        Receita(ctx, bia, 500m, mes.AddDays(4), renda);
        var svc = new RendaService(ctx);
        // Admin mostra pra todos; Ana só pra Bia (que é "só vê" e por isso não vê mesmo assim); Bia não mostra nada.
        await svc.DefinirVisibilidadeAsync(familiaId, Membro(ctx, familiaId, admin).Id, admin, new DefinirVisibilidadeRendaDto(VisibilidadeRenda.ValorParaTodos, null));
        await svc.DefinirVisibilidadeAsync(familiaId, Membro(ctx, familiaId, ana).Id, ana, new DefinirVisibilidadeRendaDto(VisibilidadeRenda.ValorParaAlguns, new List<Guid> { bia }));
        await svc.DefinirVisibilidadeAsync(familiaId, Membro(ctx, familiaId, bia).Id, bia, new DefinirVisibilidadeRendaDto(VisibilidadeRenda.Nada, null));

        var visaoAdmin = await svc.ObterRendaFamiliaAsync(familiaId, admin, 2026, 10);
        var visaoAna = await svc.ObterRendaFamiliaAsync(familiaId, ana, 2026, 10);
        var visaoBia = await svc.ObterRendaFamiliaAsync(familiaId, bia, 2026, 10);

        // Admin vê a própria; a de Ana não (ela liberou só pra Bia); a de Bia não.
        Assert.Equal(8000m, visaoAdmin.Total);
        Assert.True(visaoAdmin.Membros.Single(m => m.UsuarioId == admin).Mostrada);
        Assert.False(visaoAdmin.Membros.Single(m => m.UsuarioId == ana).Mostrada);
        Assert.Null(visaoAdmin.Membros.Single(m => m.UsuarioId == ana).Recebido);
        // Ana vê a própria e a do admin (pra todos).
        Assert.Equal(11000m, visaoAna.Total);
        Assert.True(visaoAna.Membros.Single(m => m.UsuarioId == admin).Mostrada);
        // Bia só vê: nem a do admin (pra todos) nem a de Ana (liberada pra ela) aparecem; só a dela mesma.
        Assert.Equal(500m, visaoBia.Total);
        Assert.False(visaoBia.Membros.Single(m => m.UsuarioId == admin).Mostrada);
        Assert.False(visaoBia.Membros.Single(m => m.UsuarioId == ana).Mostrada);
        Assert.Equal(3, visaoBia.Membros.Count); // todo mundo aparece na lista, só o valor some
    }

    [Fact]
    public async Task DefinirVisibilidade_SoAPropriaPessoa_EParaSoComQuemEstaNaFamilia()
    {
        var ctx = CreateContext();
        var (familiaId, admin, ana, _) = await SeedFamilia(ctx);
        var estranho = SeedUsuario(ctx, "estranho@test.com");
        var svc = new RendaService(ctx);
        var membroAna = Membro(ctx, familiaId, ana).Id;

        // Nem o admin muda a dos outros.
        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            svc.DefinirVisibilidadeAsync(familiaId, membroAna, admin, new DefinirVisibilidadeRendaDto(VisibilidadeRenda.ValorParaTodos, null)));
        // Quem não é da família nem fica sabendo que ela existe.
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            svc.DefinirVisibilidadeAsync(familiaId, membroAna, estranho, new DefinirVisibilidadeRendaDto(VisibilidadeRenda.Nada, null)));
        // "Pra alguns" só aceita gente da família; a própria pessoa é ignorada na lista.
        await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.DefinirVisibilidadeAsync(familiaId, membroAna, ana, new DefinirVisibilidadeRendaDto(VisibilidadeRenda.ValorParaAlguns, new List<Guid> { estranho })));
        await svc.DefinirVisibilidadeAsync(familiaId, membroAna, ana, new DefinirVisibilidadeRendaDto(VisibilidadeRenda.ValorParaAlguns, new List<Guid> { admin, ana, admin }));

        var m = Membro(ctx, familiaId, ana);
        Assert.Equal(VisibilidadeRenda.ValorParaAlguns, m.VisibilidadeRenda);
        Assert.Equal(new[] { admin }, m.RendaVisivelPara);

        // Trocar pra "pra todos" limpa a lista.
        await svc.DefinirVisibilidadeAsync(familiaId, membroAna, ana, new DefinirVisibilidadeRendaDto(VisibilidadeRenda.ValorParaTodos, new List<Guid> { admin }));
        Assert.Empty(Membro(ctx, familiaId, ana).RendaVisivelPara);
    }

    [Fact]
    public async Task Pesos_SaoARendaPrevistaDoMes_EQuemEscondeuTudoFicaComZero()
    {
        var ctx = CreateContext();
        var (familiaId, admin, ana, bia) = await SeedFamilia(ctx);
        var renda = SeedCategoria(ctx, "Renda");
        var mes = new DateOnly(2026, 10, 1);
        Receita(ctx, admin, 4000m, mes.AddDays(4), renda, recorrente: Guid.NewGuid()); // conta fixa: entra no previsto
        Receita(ctx, ana, 9000m, mes.AddDays(4), renda);                                 // avulsa: recebido, não previsto
        var svc = new RendaService(ctx);
        await svc.DefinirVariavelEsperadaAsync(ana, new DefinirVariavelEsperadaDto(2026, 10, 2000m));
        await svc.DefinirVariavelEsperadaAsync(bia, new DefinirVariavelEsperadaDto(2026, 10, 1000m));
        await svc.DefinirVisibilidadeAsync(familiaId, Membro(ctx, familiaId, bia).Id, bia, new DefinirVisibilidadeRendaDto(VisibilidadeRenda.Nada, null));

        var pesos = await svc.PesosAsync(familiaId, 2026, 10);

        Assert.Equal(4000m, pesos[admin]);
        Assert.Equal(2000m, pesos[ana]);
        Assert.Equal(0m, pesos[bia]);
    }
}
