using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class DespesaCompartilhadaServiceTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static Guid SeedUsuario(AppDbContext ctx, string email, string nome = "User")
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = email, Nome = nome, PasswordHash = "x" };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u.Id;
    }

    /// <summary>Cria família com o dono como admin e retorna o id da família.</summary>
    private static async Task<Guid> SeedFamilia(AppDbContext ctx, Guid donoId)
    {
        var familia = await new FamiliaService(ctx).CriarAsync(new CriarFamiliaDto("F"), donoId);
        return familia.Id;
    }

    private static void AddMembro(AppDbContext ctx, Guid familiaId, Guid usuarioId,
        PapelFamilia papel = PapelFamilia.Membro)
    {
        ctx.MembrosFamilia.Add(new MembroFamilia
        {
            Id = Guid.NewGuid(), FamiliaId = familiaId, UsuarioId = usuarioId,
            Papel = "Membro", PapelPermissao = papel, EntrouEm = DateTime.UtcNow, Ativo = true,
        });
        ctx.SaveChanges();
    }

    private static Guid SeedTransacao(
        AppDbContext ctx, Guid criadoPor, decimal valor,
        TipoTransacao tipo = TipoTransacao.Despesa, Guid? familiaId = null)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Despesa", Valor = valor, Tipo = tipo,
            CriadoPor = criadoPor, Data = new DateOnly(2026, 5, 10),
            Ativo = true, StatusTransacao = StatusTransacao.Executado, FamiliaId = familiaId,
        };
        ctx.Transacoes.Add(t);
        ctx.SaveChanges();
        return t.Id;
    }

    [Fact]
    public async Task CompartilharAsync_NaoDono_LancaUnauthorized()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var txId = SeedTransacao(ctx, dono, 100m);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));

        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.CompartilharAsync(txId, familiaId, Guid.NewGuid()));
    }

    [Fact]
    public async Task CompartilharAsync_Receita_LancaInvalidOperation()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var txId = SeedTransacao(ctx, dono, 100m, TipoTransacao.Receita);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CompartilharAsync(txId, familiaId, dono));
    }

    [Fact]
    public async Task CompartilharAsync_NaoMembro_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var estranho = SeedUsuario(ctx, "estranho@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var txId = SeedTransacao(ctx, estranho, 100m);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.CompartilharAsync(txId, familiaId, estranho));
    }

    [Fact]
    public async Task CompartilharAsync_Valido_DefineFamiliaId()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var txId = SeedTransacao(ctx, dono, 100m);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));

        await svc.CompartilharAsync(txId, familiaId, dono);

        var tx = await ctx.Transacoes.FindAsync(txId);
        Assert.Equal(familiaId, tx!.FamiliaId);
    }

    [Fact]
    public async Task DescompartilharAsync_Valido_LimpaFamiliaId()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var txId = SeedTransacao(ctx, dono, 100m, TipoTransacao.Despesa, familiaId);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));

        await svc.DescompartilharAsync(txId, dono);

        var tx = await ctx.Transacoes.FindAsync(txId);
        Assert.Null(tx!.FamiliaId);
    }

    [Fact]
    public async Task ListarDespesasAsync_NaoMembro_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.ListarDespesasAsync(familiaId, Guid.NewGuid(), 5, 2026));
    }

    [Fact]
    public async Task ObterBalancoAsync_DivideIgualEntreMembros()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);

        SeedTransacao(ctx, ana, 300m, TipoTransacao.Despesa, familiaId);
        SeedTransacao(ctx, bia, 100m, TipoTransacao.Despesa, familiaId);

        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));
        var balanco = await svc.ObterBalancoAsync(familiaId, ana, 5, 2026);

        Assert.Equal(400m, balanco.Total);
        Assert.Equal(200m, balanco.Cota);

        var saldoAna = balanco.Saldos.First(s => s.UsuarioId == ana);
        var saldoBia = balanco.Saldos.First(s => s.UsuarioId == bia);
        Assert.Equal(300m, saldoAna.Pagou);
        Assert.Equal(100m, saldoAna.Saldo);   // pagou 300, cota 200
        Assert.Equal(-100m, saldoBia.Saldo);  // pagou 100, cota 200
    }

    // ── Feature 2.4 — aprovação de despesa ─────────────────────────────────────

    private static async Task SetLimite(AppDbContext ctx, Guid familiaId, Guid admin, decimal? limite) =>
        await new FamiliaService(ctx).DefinirLimiteAprovacaoAsync(familiaId, admin, limite);

    [Fact]
    public async Task CompartilharAsync_AcimaDoLimite_FicaPendente()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        await SetLimite(ctx, familiaId, dono, 100m);
        var txId = SeedTransacao(ctx, dono, 150m);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));

        await svc.CompartilharAsync(txId, familiaId, dono);

        var tx = await ctx.Transacoes.FindAsync(txId);
        Assert.Equal(StatusAprovacaoDespesa.Pendente, tx!.StatusAprovacao);
    }

    [Fact]
    public async Task CompartilharAsync_AbaixoDoLimite_NaoRequerida()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        await SetLimite(ctx, familiaId, dono, 100m);
        var txId = SeedTransacao(ctx, dono, 50m);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));

        await svc.CompartilharAsync(txId, familiaId, dono);

        var tx = await ctx.Transacoes.FindAsync(txId);
        Assert.Equal(StatusAprovacaoDespesa.NaoRequerida, tx!.StatusAprovacao);
    }

    [Fact]
    public async Task CompartilharAsync_SemLimite_NaoRequerida()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var txId = SeedTransacao(ctx, dono, 9999m);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));

        await svc.CompartilharAsync(txId, familiaId, dono);

        var tx = await ctx.Transacoes.FindAsync(txId);
        Assert.Equal(StatusAprovacaoDespesa.NaoRequerida, tx!.StatusAprovacao);
    }

    [Fact]
    public async Task AprovarAsync_PorOutroMembro_FicaAprovada()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        await SetLimite(ctx, familiaId, ana, 100m);
        var txId = SeedTransacao(ctx, ana, 200m);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));
        await svc.CompartilharAsync(txId, familiaId, ana);

        await svc.AprovarAsync(familiaId, txId, bia);

        var tx = await ctx.Transacoes.FindAsync(txId);
        Assert.Equal(StatusAprovacaoDespesa.Aprovada, tx!.StatusAprovacao);
        Assert.Equal(bia, tx.AprovadoPorUsuarioId);
    }

    [Fact]
    public async Task AprovarAsync_PeloCriador_LancaForbidden()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        await SetLimite(ctx, familiaId, ana, 100m);
        var txId = SeedTransacao(ctx, ana, 200m);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));
        await svc.CompartilharAsync(txId, familiaId, ana);

        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.AprovarAsync(familiaId, txId, ana)); // ana é a criadora
    }

    [Fact]
    public async Task AprovarAsync_NaoPendente_LancaInvalidOperation()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        var txId = SeedTransacao(ctx, ana, 50m); // sem limite → NaoRequerida
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));
        await svc.CompartilharAsync(txId, familiaId, ana);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.AprovarAsync(familiaId, txId, bia));
    }

    [Fact]
    public async Task RejeitarAsync_FicaRejeitada()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        await SetLimite(ctx, familiaId, ana, 100m);
        var txId = SeedTransacao(ctx, ana, 200m);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));
        await svc.CompartilharAsync(txId, familiaId, ana);

        await svc.RejeitarAsync(familiaId, txId, bia);

        var tx = await ctx.Transacoes.FindAsync(txId);
        Assert.Equal(StatusAprovacaoDespesa.Rejeitada, tx!.StatusAprovacao);
    }

    [Fact]
    public async Task ObterBalanco_PendenteNaoConta_AprovadaConta()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        await SetLimite(ctx, familiaId, ana, 100m);
        var txId = SeedTransacao(ctx, ana, 200m);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));
        await svc.CompartilharAsync(txId, familiaId, ana); // pendente (200 >= 100)

        var pendente = await svc.ObterBalancoAsync(familiaId, ana, 5, 2026);
        Assert.Equal(0m, pendente.Total); // pendente fica fora do rateio

        await svc.AprovarAsync(familiaId, txId, bia);
        var aprovado = await svc.ObterBalancoAsync(familiaId, ana, 5, 2026);
        Assert.Equal(200m, aprovado.Total); // aprovada entra
    }

    [Fact]
    public async Task ListarDespesas_IncluiPendenteComStatus()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var familiaId = await SeedFamilia(ctx, ana);
        await SetLimite(ctx, familiaId, ana, 100m);
        var txId = SeedTransacao(ctx, ana, 200m);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));
        await svc.CompartilharAsync(txId, familiaId, ana);

        var feed = await svc.ListarDespesasAsync(familiaId, ana, 5, 2026);

        var d = Assert.Single(feed);
        Assert.Equal(StatusAprovacaoDespesa.Pendente, d.StatusAprovacao);
    }

    // ── Feature 2.1 — responsável da despesa ───────────────────────────────────

    [Fact]
    public async Task AtribuirResponsavelAsync_DefineResponsavel()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        var txId = SeedTransacao(ctx, ana, 100m, TipoTransacao.Despesa, familiaId);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));

        await svc.AtribuirResponsavelAsync(familiaId, txId, bia, ana);

        var tx = await ctx.Transacoes.FindAsync(txId);
        Assert.Equal(bia, tx!.ResponsavelUsuarioId);
    }

    [Fact]
    public async Task AtribuirResponsavelAsync_Null_Limpa()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        var txId = SeedTransacao(ctx, ana, 100m, TipoTransacao.Despesa, familiaId);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));
        await svc.AtribuirResponsavelAsync(familiaId, txId, bia, ana);

        await svc.AtribuirResponsavelAsync(familiaId, txId, null, ana);

        var tx = await ctx.Transacoes.FindAsync(txId);
        Assert.Null(tx!.ResponsavelUsuarioId);
    }

    [Fact]
    public async Task AtribuirResponsavelAsync_NaoMembro_LancaArgument()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var estranho = SeedUsuario(ctx, "estranho@test.com", "Estranho");
        var familiaId = await SeedFamilia(ctx, ana);
        var txId = SeedTransacao(ctx, ana, 100m, TipoTransacao.Despesa, familiaId);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.AtribuirResponsavelAsync(familiaId, txId, estranho, ana));
    }

    [Fact]
    public async Task AtribuirResponsavelAsync_AtorNaoMembro_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var familiaId = await SeedFamilia(ctx, ana);
        var txId = SeedTransacao(ctx, ana, 100m, TipoTransacao.Despesa, familiaId);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.AtribuirResponsavelAsync(familiaId, txId, ana, Guid.NewGuid()));
    }

    // ── Feature 2.3 — Dependente é só-leitura ──────────────────────────────────

    [Fact]
    public async Task CompartilharAsync_Dependente_LancaForbidden()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var dep = SeedUsuario(ctx, "dep@test.com", "Dep");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, dep, PapelFamilia.Dependente);
        var txId = SeedTransacao(ctx, dep, 100m);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));

        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.CompartilharAsync(txId, familiaId, dep));
    }

    [Fact]
    public async Task ListarDespesas_Dependente_PodeLer()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var dep = SeedUsuario(ctx, "dep@test.com", "Dep");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, dep, PapelFamilia.Dependente);
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));

        // Dependente lê o feed sem erro (lista vazia, mas sem 403).
        var feed = await svc.ListarDespesasAsync(familiaId, dep, 5, 2026);
        Assert.Empty(feed);
    }

    [Fact]
    public async Task ListarDespesas_FiltraPorResponsavel()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        var tx1 = SeedTransacao(ctx, ana, 100m, TipoTransacao.Despesa, familiaId);
        SeedTransacao(ctx, ana, 200m, TipoTransacao.Despesa, familiaId); // sem responsável
        var svc = new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx));
        await svc.AtribuirResponsavelAsync(familiaId, tx1, bia, ana);

        var doBia = await svc.ListarDespesasAsync(familiaId, ana, 5, 2026, responsavelId: bia);

        var d = Assert.Single(doBia);
        Assert.Equal(tx1, d.Id);
        Assert.Equal("Bia", d.ResponsavelNome);
    }
}
