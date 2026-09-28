using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Recorrente;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class RecorrenteServiceTests
{
    // ── Setup ─────────────────────────────────────────────────────────────────

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static RecorrenteService CreateService(AppDbContext ctx, IHttpContextAccessor? accessor = null)
    {
        accessor ??= new Mock<IHttpContextAccessor>().Object;
        return new RecorrenteService(ctx,
            new FaturaService(ctx),
            new FinancialEventLogService(ctx),
            accessor);
    }

    private static Guid SeedUsuario(AppDbContext ctx)
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = $"u{Guid.NewGuid()}@test.com", Nome = "User", PasswordHash = "x" };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u.Id;
    }

    private static Guid SeedConta(AppDbContext ctx, Guid userId)
    {
        var c = new Conta { Id = Guid.NewGuid(), Nome = "Conta", UsuarioIdProprietario = userId, Tipo = TipoConta.ContaCorrente };
        ctx.Contas.Add(c);
        ctx.SaveChanges();
        return c.Id;
    }

    private static Guid SeedCartao(AppDbContext ctx, Guid userId)
    {
        var c = new CartaoCredito { Id = Guid.NewGuid(), Nome = "Cartão", CriadoPor = userId, Ativo = true, TemCredito = true };
        ctx.CartoesCredito.Add(c);
        ctx.SaveChanges();
        return c.Id;
    }

    private static Guid SeedCategoria(AppDbContext ctx, Guid? userId, Finalidade finalidade = Finalidade.Despesa)
    {
        var cat = new Categoria { Id = Guid.NewGuid(), Descricao = "Categoria", Finalidade = finalidade, UsuarioId = userId };
        ctx.Categorias.Add(cat);
        ctx.SaveChanges();
        return cat.Id;
    }

    private static Recorrente SeedRecorrente(AppDbContext ctx, Guid userId, Guid contaId, bool ativo = true)
    {
        var r = new Recorrente
        {
            Id = Guid.NewGuid(),
            Descricao = "Aluguel",
            Valor = 1200m,
            Tipo = TipoTransacao.Despesa,
            ContaId = contaId,
            Frequencia = FrequenciaRecorrencia.Mensal,
            Dia = 1,
            DataInicio = DateTime.UtcNow.Date.AddMonths(-1),
            Ativo = ativo,
            CriadoPor = userId,
            CriadoEm = DateTime.UtcNow
        };
        ctx.Recorrentes.Add(r);
        ctx.SaveChanges();
        return r;
    }

    private static Transacao SeedTransacaoPrevisao(AppDbContext ctx, Guid userId, Guid recorrenteId, Guid contaId, DateTime? data = null)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = "Aluguel",
            Valor = 1200m,
            Tipo = TipoTransacao.Despesa,
            ContaId = contaId,
            StatusTransacao = StatusTransacao.Previsao,
            Ativo = true,
            CriadoPor = userId,
            Data = data ?? DateTime.UtcNow.Date.AddDays(5),
            RecorrenteOrigemId = recorrenteId,
            CriadoEm = DateTime.UtcNow
        };
        ctx.Transacoes.Add(t);
        ctx.SaveChanges();
        return t;
    }

    // ── ListarAsync ───────────────────────────────────────────────────────────

    [Fact]
    public async Task ListarAsync_RetornaApenasDoUsuario()
    {
        var ctx = CreateContext();
        var u1 = SeedUsuario(ctx);
        var u2 = SeedUsuario(ctx);
        var c1 = SeedConta(ctx, u1);
        var c2 = SeedConta(ctx, u2);
        SeedRecorrente(ctx, u1, c1);
        SeedRecorrente(ctx, u2, c2);

        var svc = CreateService(ctx);
        var result = await svc.ListarAsync(u1);

        Assert.Equal(1, result.Total);
        Assert.All(result.Items, r => Assert.Equal("Aluguel", r.Descricao));
    }

    [Fact]
    public async Task ListarAsync_PaginacaoCorreta()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var c = SeedConta(ctx, u);
        for (int i = 0; i < 5; i++)
        {
            var r = SeedRecorrente(ctx, u, c);
            r.Descricao = $"Recorrente {i}";
            ctx.SaveChanges();
        }

        var svc = CreateService(ctx);
        var p1 = await svc.ListarAsync(u, page: 1, pageSize: 3);
        var p2 = await svc.ListarAsync(u, page: 2, pageSize: 3);

        Assert.Equal(5, p1.Total);
        Assert.Equal(3, p1.Items.Count());
        Assert.Equal(2, p2.Items.Count());
    }

    // ── ListarAsync: situação (ativa × pausada × cancelada × encerrada) + busca ──

    // Um de cada situação: a tela separa Ativas (ativa + pausada) de Encerradas (cancelada + fim passado).
    private static (Guid u, Recorrente ativa, Recorrente pausada, Recorrente cancelada, Recorrente encerrada) SeedSituacoes(AppDbContext ctx)
    {
        var u = SeedUsuario(ctx);
        var c = SeedConta(ctx, u);

        var ativa = SeedRecorrente(ctx, u, c);
        ativa.Descricao = "Netflix";

        var pausada = SeedRecorrente(ctx, u, c, ativo: false);
        pausada.Descricao = "Academia";

        var cancelada = SeedRecorrente(ctx, u, c, ativo: false);
        cancelada.Descricao = "Spotify";
        cancelada.CanceladoEm = DateTime.UtcNow.AddDays(-2);
        cancelada.MotivoCancelamento = "Não uso mais";

        var encerrada = SeedRecorrente(ctx, u, c);
        encerrada.Descricao = "Curso";
        encerrada.DataFim = DateTime.UtcNow.Date.AddDays(-1);

        ctx.SaveChanges();
        return (u, ativa, pausada, cancelada, encerrada);
    }

    [Fact]
    public async Task ListarAsync_SemStatus_TrazTodas_ComSituacaoCalculada()
    {
        var ctx = CreateContext();
        var (u, ativa, pausada, cancelada, encerrada) = SeedSituacoes(ctx);

        var result = await CreateService(ctx).ListarAsync(u);

        Assert.Equal(4, result.Total); // sem filtro = compatível com quem já chamava
        var porId = result.Items.ToDictionary(r => r.Id, r => r.Situacao);
        Assert.Equal(SituacaoRecorrente.Ativa, porId[ativa.Id]);
        Assert.Equal(SituacaoRecorrente.Pausada, porId[pausada.Id]);
        Assert.Equal(SituacaoRecorrente.Cancelada, porId[cancelada.Id]); // NÃO "pausada" (bug antigo)
        Assert.Equal(SituacaoRecorrente.Encerrada, porId[encerrada.Id]);
    }

    [Fact]
    public async Task ListarAsync_StatusAtivas_TrazAtivaEPausada_SemCanceladaNemEncerrada()
    {
        var ctx = CreateContext();
        var (u, ativa, pausada, _, _) = SeedSituacoes(ctx);

        var result = await CreateService(ctx).ListarAsync(u, status: "ativas");

        Assert.Equal(2, result.Total);
        Assert.Equal(new[] { ativa.Id, pausada.Id }.OrderBy(x => x), result.Items.Select(r => r.Id).OrderBy(x => x));
    }

    [Fact]
    public async Task ListarAsync_StatusEncerradas_TrazCanceladaEDataFimPassada()
    {
        var ctx = CreateContext();
        var (u, _, _, cancelada, encerrada) = SeedSituacoes(ctx);

        var result = await CreateService(ctx).ListarAsync(u, status: "ENCERRADAS"); // sem diferenciar caixa

        Assert.Equal(2, result.Total);
        Assert.Equal(new[] { cancelada.Id, encerrada.Id }.OrderBy(x => x), result.Items.Select(r => r.Id).OrderBy(x => x));
    }

    [Fact]
    public async Task ListarAsync_DataFimHoje_AindaEhAtiva()
    {
        // Último dia ainda gera cobrança (GerarPendentesAsync usa DataFim >= hoje) → segue em "ativas".
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var c = SeedConta(ctx, u);
        var rec = SeedRecorrente(ctx, u, c);
        rec.DataFim = DateTime.UtcNow.Date;
        ctx.SaveChanges();

        var svc = CreateService(ctx);
        var ativas = await svc.ListarAsync(u, status: "ativas");
        var encerradas = await svc.ListarAsync(u, status: "encerradas");

        Assert.Equal(1, ativas.Total);
        Assert.Equal(SituacaoRecorrente.Ativa, ativas.Items.Single().Situacao);
        Assert.Equal(0, encerradas.Total);
    }

    [Fact]
    public async Task ListarAsync_StatusInvalido_LancaArgumentException()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);

        await Assert.ThrowsAsync<ArgumentException>(() => CreateService(ctx).ListarAsync(u, status: "todas-mesmo"));
    }

    [Fact]
    public async Task ListarAsync_Busca_FiltraNoServidor_SemDiferenciarCaixa_ETotalFiltrado()
    {
        var ctx = CreateContext();
        var (u, ativa, _, _, _) = SeedSituacoes(ctx);

        var result = await CreateService(ctx).ListarAsync(u, pageSize: 1, busca: "  NETFLIX ");

        Assert.Equal(1, result.Total); // total já filtrado (paginação correta)
        Assert.Equal(ativa.Id, result.Items.Single().Id);
    }

    [Fact]
    public async Task ListarAsync_Busca_AchaPeloNomeDaConta_ECombinaComStatus()
    {
        var ctx = CreateContext();
        var (u, _, _, cancelada, _) = SeedSituacoes(ctx);
        // Conta de todas se chama "Conta" (SeedConta) — busca pela conta acha as 4; o status recorta.
        var result = await CreateService(ctx).ListarAsync(u, status: "encerradas", busca: "spot");

        Assert.Equal(1, result.Total);
        Assert.Equal(cancelada.Id, result.Items.Single().Id);

        var porConta = await CreateService(ctx).ListarAsync(u, busca: "conta");
        Assert.Equal(4, porConta.Total);
    }

    [Fact]
    public async Task ListarAsync_Busca_NaoVazaRecorrenteDeOutroUsuario()
    {
        var ctx = CreateContext();
        var (u, _, _, _, _) = SeedSituacoes(ctx);
        var outro = SeedUsuario(ctx);
        var r = SeedRecorrente(ctx, outro, SeedConta(ctx, outro));
        r.Descricao = "Netflix do vizinho";
        ctx.SaveChanges();

        var result = await CreateService(ctx).ListarAsync(u, busca: "netflix");

        Assert.Equal(1, result.Total);
        Assert.DoesNotContain(result.Items, x => x.Id == r.Id);
    }

    // ── CancelarAsync ─────────────────────────────────────────────────────────

    [Fact]
    public async Task CancelarAsync_DefineCanceladoEmEMotivo()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var c = SeedConta(ctx, u);
        var rec = SeedRecorrente(ctx, u, c);
        SeedTransacaoPrevisao(ctx, u, rec.Id, c);

        var svc = CreateService(ctx);
        var dto = new CancelarRecorrenteDto { Motivo = "Não preciso mais" };
        await svc.CancelarAsync(rec.Id, dto, u);

        var updated = await ctx.Recorrentes.FindAsync(rec.Id);
        Assert.False(updated!.Ativo);
        Assert.NotNull(updated.CanceladoEm);
        Assert.Equal("Não preciso mais", updated.MotivoCancelamento);
    }

    [Fact]
    public async Task CancelarAsync_CancelaTransacoesPrevisao()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var c = SeedConta(ctx, u);
        var rec = SeedRecorrente(ctx, u, c);
        SeedTransacaoPrevisao(ctx, u, rec.Id, c, DateTime.UtcNow.Date.AddDays(3));
        SeedTransacaoPrevisao(ctx, u, rec.Id, c, DateTime.UtcNow.Date.AddDays(10));

        // Also seed an Executado transaction (should NOT be cancelled)
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = "Aluguel",
            Valor = 1200m,
            Tipo = TipoTransacao.Despesa,
            ContaId = c,
            StatusTransacao = StatusTransacao.Executado,
            Ativo = true,
            CriadoPor = u,
            Data = DateTime.UtcNow.Date.AddDays(-5),
            RecorrenteOrigemId = rec.Id,
            CriadoEm = DateTime.UtcNow
        });
        await ctx.SaveChangesAsync();

        var svc = CreateService(ctx);
        await svc.CancelarAsync(rec.Id, new CancelarRecorrenteDto { Motivo = "Cancelado" }, u);

        var previsoes = await ctx.Transacoes
            .Where(t => t.RecorrenteOrigemId == rec.Id && t.StatusTransacao == StatusTransacao.Previsao)
            .ToListAsync();
        Assert.All(previsoes, t => Assert.False(t.Ativo));

        var executado = await ctx.Transacoes
            .Where(t => t.RecorrenteOrigemId == rec.Id && t.StatusTransacao == StatusTransacao.Executado)
            .FirstAsync();
        Assert.True(executado.Ativo);
    }

    [Fact]
    public async Task CancelarAsync_MotivoVazio_LancaArgumentException()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var c = SeedConta(ctx, u);
        var rec = SeedRecorrente(ctx, u, c);

        var svc = CreateService(ctx);
        await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.CancelarAsync(rec.Id, new CancelarRecorrenteDto { Motivo = "" }, u));
    }

    [Fact]
    public async Task CancelarAsync_OutroUsuario_LancaUnauthorizedAccessException()
    {
        var ctx = CreateContext();
        var u1 = SeedUsuario(ctx);
        var u2 = SeedUsuario(ctx);
        var c = SeedConta(ctx, u1);
        var rec = SeedRecorrente(ctx, u1, c);

        var svc = CreateService(ctx);
        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            svc.CancelarAsync(rec.Id, new CancelarRecorrenteDto { Motivo = "Teste" }, u2));
    }

    [Fact]
    public async Task CancelarAsync_NaoEncontrado_LancaKeyNotFoundException()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var svc = CreateService(ctx);
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            svc.CancelarAsync(Guid.NewGuid(), new CancelarRecorrenteDto { Motivo = "x" }, u));
    }

    // ── EditarProximaOcorrenciaAsync ──────────────────────────────────────────

    [Fact]
    public async Task EditarProximaOcorrenciaAsync_AtualizaValorEDescricao()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var c = SeedConta(ctx, u);
        var rec = SeedRecorrente(ctx, u, c);
        var transacao = SeedTransacaoPrevisao(ctx, u, rec.Id, c);

        var svc = CreateService(ctx);
        var dto = new EditarProximaOcorrenciaDto { Valor = 999m, Descricao = "Aluguel novo" };
        await svc.EditarProximaOcorrenciaAsync(rec.Id, dto, u);

        var updated = await ctx.Transacoes.FindAsync(transacao.Id);
        Assert.Equal(999m, updated!.Valor);
        Assert.Equal("Aluguel novo", updated.Descricao);
    }

    [Fact]
    public async Task EditarProximaOcorrenciaAsync_ValorNegativo_LancaArgumentException()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var c = SeedConta(ctx, u);
        var rec = SeedRecorrente(ctx, u, c);
        SeedTransacaoPrevisao(ctx, u, rec.Id, c);

        var svc = CreateService(ctx);
        await Assert.ThrowsAsync<ArgumentException>(() =>
            svc.EditarProximaOcorrenciaAsync(rec.Id, new EditarProximaOcorrenciaDto { Valor = -10m }, u));
    }

    [Fact]
    public async Task EditarProximaOcorrenciaAsync_SemPrevisao_LancaKeyNotFoundException()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var c = SeedConta(ctx, u);
        var rec = SeedRecorrente(ctx, u, c);
        // No Previsao transactions seeded

        var svc = CreateService(ctx);
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            svc.EditarProximaOcorrenciaAsync(rec.Id, new EditarProximaOcorrenciaDto { Valor = 100m }, u));
    }

    [Fact]
    public async Task EditarProximaOcorrenciaAsync_OutroUsuario_LancaUnauthorizedAccessException()
    {
        var ctx = CreateContext();
        var u1 = SeedUsuario(ctx);
        var u2 = SeedUsuario(ctx);
        var c = SeedConta(ctx, u1);
        var rec = SeedRecorrente(ctx, u1, c);
        SeedTransacaoPrevisao(ctx, u1, rec.Id, c);

        var svc = CreateService(ctx);
        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            svc.EditarProximaOcorrenciaAsync(rec.Id, new EditarProximaOcorrenciaDto { Valor = 100m }, u2));
    }

    [Fact]
    public async Task EditarProximaOcorrenciaAsync_SelecionaProximaTransacao()
    {
        // Must pick the earliest future Previsao
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var c = SeedConta(ctx, u);
        var rec = SeedRecorrente(ctx, u, c);
        var future1 = SeedTransacaoPrevisao(ctx, u, rec.Id, c, DateTime.UtcNow.Date.AddDays(3));
        var future2 = SeedTransacaoPrevisao(ctx, u, rec.Id, c, DateTime.UtcNow.Date.AddDays(10));

        var svc = CreateService(ctx);
        await svc.EditarProximaOcorrenciaAsync(rec.Id, new EditarProximaOcorrenciaDto { Valor = 555m }, u);

        var t1 = await ctx.Transacoes.FindAsync(future1.Id);
        var t2 = await ctx.Transacoes.FindAsync(future2.Id);
        Assert.Equal(555m, t1!.Valor);      // earliest gets changed
        Assert.Equal(1200m, t2!.Valor);     // later one untouched
    }

    // ── ToggleAtivoAsync ──────────────────────────────────────────────────────

    [Fact]
    public async Task ToggleAtivoAsync_InverteAtivo()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var c = SeedConta(ctx, u);
        var rec = SeedRecorrente(ctx, u, c, ativo: true);

        var svc = CreateService(ctx);
        await svc.ToggleAtivoAsync(rec.Id, u);

        var updated = await ctx.Recorrentes.FindAsync(rec.Id);
        Assert.False(updated!.Ativo);

        await svc.ToggleAtivoAsync(rec.Id, u);
        ctx.Entry(updated).Reload();
        Assert.True(updated.Ativo);
    }

    [Fact]
    public async Task ToggleAtivoAsync_Cancelada_LancaInvalidOperation_ENaoReativa()
    {
        // Bug antigo: a tela mostrava a cancelada como "Pausada" e o "Ativar" a religava.
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var c = SeedConta(ctx, u);
        var rec = SeedRecorrente(ctx, u, c);
        SeedTransacaoPrevisao(ctx, u, rec.Id, c);

        var svc = CreateService(ctx);
        await svc.CancelarAsync(rec.Id, new CancelarRecorrenteDto { Motivo = "Caro" }, u);

        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.ToggleAtivoAsync(rec.Id, u));

        var atual = await ctx.Recorrentes.FindAsync(rec.Id);
        Assert.False(atual!.Ativo);
        Assert.NotNull(atual.CanceladoEm);
    }

    [Fact]
    public async Task ToggleAtivoAsync_OutroUsuario_LancaUnauthorizedAccessException()
    {
        var ctx = CreateContext();
        var u1 = SeedUsuario(ctx);
        var u2 = SeedUsuario(ctx);
        var c = SeedConta(ctx, u1);
        var rec = SeedRecorrente(ctx, u1, c);

        var svc = CreateService(ctx);
        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            svc.ToggleAtivoAsync(rec.Id, u2));
    }

    // ── DeletarAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task DeletarAsync_RemoveRecorrente()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var c = SeedConta(ctx, u);
        var rec = SeedRecorrente(ctx, u, c);

        var svc = CreateService(ctx);
        await svc.DeletarAsync(rec.Id, u);

        Assert.Null(await ctx.Recorrentes.FindAsync(rec.Id));
    }

    [Fact]
    public async Task DeletarAsync_OutroUsuario_LancaUnauthorizedAccessException()
    {
        var ctx = CreateContext();
        var u1 = SeedUsuario(ctx);
        var u2 = SeedUsuario(ctx);
        var c = SeedConta(ctx, u1);
        var rec = SeedRecorrente(ctx, u1, c);

        var svc = CreateService(ctx);
        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            svc.DeletarAsync(rec.Id, u2));
    }

    // ── AtualizarAsync ────────────────────────────────────────────────────────

    [Fact]
    public async Task AtualizarAsync_AtualizaCampos()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var c = SeedConta(ctx, u);
        var rec = SeedRecorrente(ctx, u, c);

        var svc = CreateService(ctx);
        var dto = new CriarRecorrenteDto
        {
            Descricao = "Editado",
            Valor = 500m,
            Tipo = (int)TipoTransacao.Receita,
            ContaId = c,
            Frequencia = (int)FrequenciaRecorrencia.Semanal,
            Dia = 5,
            DataInicio = DateTime.UtcNow.Date
        };
        await svc.AtualizarAsync(rec.Id, dto, u);

        var updated = await ctx.Recorrentes.FindAsync(rec.Id);
        Assert.Equal("Editado", updated!.Descricao);
        Assert.Equal(500m, updated.Valor);
        Assert.Equal(FrequenciaRecorrencia.Semanal, updated.Frequencia);
    }

    [Fact]
    public async Task AtualizarAsync_OutroUsuario_LancaUnauthorizedAccessException()
    {
        var ctx = CreateContext();
        var u1 = SeedUsuario(ctx);
        var u2 = SeedUsuario(ctx);
        var c = SeedConta(ctx, u1);
        var rec = SeedRecorrente(ctx, u1, c);

        var svc = CreateService(ctx);
        var dto = new CriarRecorrenteDto
        {
            Descricao = "x", Valor = 1m, Tipo = 1, ContaId = c,
            Frequencia = 1, Dia = 1, DataInicio = DateTime.UtcNow.Date
        };
        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            svc.AtualizarAsync(rec.Id, dto, u2));
    }

    // ── Stats (#179) ──────────────────────────────────────────────────────────

    [Fact]
    public async Task ObterStatsAsync_AgregaSomenteDoUsuario()
    {
        var ctx = CreateContext();
        var svc = CreateService(ctx);
        var uid = SeedUsuario(ctx);
        var outroUid = SeedUsuario(ctx);
        var conta = SeedConta(ctx, uid);

        // Usuário: 2 ativos mensais despesa (1200 + 800), 1 ativo mensal receita,
        // 1 ativo SEMANAL (não conta no custo mensal), 1 cancelado.
        SeedRecorrente(ctx, uid, conta);                            // ativo despesa mensal 1200
        var r2 = SeedRecorrente(ctx, uid, conta);                   // ativo despesa mensal 800
        r2.Valor = 800m; ctx.SaveChanges();
        var rRec = SeedRecorrente(ctx, uid, conta);                 // ativo RECEITA mensal — não soma em custoMensalDespesas
        rRec.Tipo = TipoTransacao.Receita; ctx.SaveChanges();
        var rSem = SeedRecorrente(ctx, uid, conta);                 // ativo despesa SEMANAL — não soma
        rSem.Frequencia = FrequenciaRecorrencia.Semanal; ctx.SaveChanges();
        SeedRecorrente(ctx, uid, conta, ativo: false);              // inativo
        SeedRecorrente(ctx, outroUid, SeedConta(ctx, outroUid));   // outro usuário

        // Próxima 30 dias: 2 com dataProximaGeracao em 10 dias, 1 em 60 dias, 1 nulo
        var hoje = DateTime.UtcNow;
        var ativos = await ctx.Recorrentes.Where(r => r.CriadoPor == uid && r.Ativo).ToListAsync();
        ativos[0].DataProximaGeracao = hoje.AddDays(10);
        ativos[1].DataProximaGeracao = hoje.AddDays(10);
        ativos[2].DataProximaGeracao = hoje.AddDays(60);  // fora dos 30
        ativos[3].DataProximaGeracao = null;
        await ctx.SaveChangesAsync();

        var stats = await svc.ObterStatsAsync(uid);

        Assert.Equal(4, stats.Ativas);                  // 4 ativos do usuário
        Assert.Equal(2000m, stats.CustoMensalDespesas); // 1200 + 800 (mensais despesa)
        Assert.Equal(2, stats.Proximas30Dias);          // só os 2 dentro do cutoff
        Assert.Equal(5, stats.QtdTotal);                // 4 ativos + 1 inativo
    }

    [Fact]
    public async Task ObterStatsAsync_SemRecorrentes_RetornaZero()
    {
        var ctx = CreateContext();
        var svc = CreateService(ctx);
        var stats = await svc.ObterStatsAsync(Guid.NewGuid());

        Assert.Equal(0, stats.Ativas);
        Assert.Equal(0m, stats.CustoMensalDespesas);
        Assert.Equal(0, stats.Proximas30Dias);
        Assert.Equal(0, stats.QtdTotal);
    }

    // ── Isolamento entre usuários (fix P0 — DonoRecursos) ────────────────────────

    [Fact]
    public async Task AtualizarAsync_ContaDeOutroUsuario_LancaKeyNotFound_MantemContaAntiga()
    {
        var ctx = CreateContext();
        var u1 = SeedUsuario(ctx);
        var u2 = SeedUsuario(ctx);
        var c1 = SeedConta(ctx, u1);
        var c2DeOutro = SeedConta(ctx, u2);
        var rec = SeedRecorrente(ctx, u1, c1);

        var svc = CreateService(ctx);
        var dto = new CriarRecorrenteDto
        {
            Descricao = "Tentativa de redirecionar", Valor = 100m, Tipo = (int)TipoTransacao.Despesa,
            ContaId = c2DeOutro, Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = 1,
            DataInicio = DateTime.UtcNow.Date,
        };

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.AtualizarAsync(rec.Id, dto, u1));

        var atual = await ctx.Recorrentes.FindAsync(rec.Id);
        Assert.Equal(c1, atual!.ContaId);
    }

    [Fact]
    public async Task AtualizarAsync_CartaoDeOutroUsuario_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var u1 = SeedUsuario(ctx);
        var u2 = SeedUsuario(ctx);
        var c1 = SeedConta(ctx, u1);
        var cartaoDeOutro = SeedCartao(ctx, u2);
        var rec = SeedRecorrente(ctx, u1, c1);

        var svc = CreateService(ctx);
        var dto = new CriarRecorrenteDto
        {
            Descricao = "x", Valor = 100m, Tipo = (int)TipoTransacao.Despesa,
            CartaoCreditoId = cartaoDeOutro, Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = 1,
            DataInicio = DateTime.UtcNow.Date,
        };

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.AtualizarAsync(rec.Id, dto, u1));
    }

    [Fact]
    public async Task AtualizarAsync_CategoriaDeOutroUsuario_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var u1 = SeedUsuario(ctx);
        var u2 = SeedUsuario(ctx);
        var c1 = SeedConta(ctx, u1);
        var categoriaDeOutro = SeedCategoria(ctx, u2);
        var rec = SeedRecorrente(ctx, u1, c1);

        var svc = CreateService(ctx);
        var dto = new CriarRecorrenteDto
        {
            Descricao = "x", Valor = 100m, Tipo = (int)TipoTransacao.Despesa,
            ContaId = c1, CategoriaId = categoriaDeOutro, Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = 1,
            DataInicio = DateTime.UtcNow.Date,
        };

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.AtualizarAsync(rec.Id, dto, u1));
    }

    [Fact]
    public async Task AtualizarAsync_SemOrigem_LancaArgumentException()
    {
        var ctx = CreateContext();
        var u1 = SeedUsuario(ctx);
        var c1 = SeedConta(ctx, u1);
        var rec = SeedRecorrente(ctx, u1, c1);

        var svc = CreateService(ctx);
        var dto = new CriarRecorrenteDto
        {
            Descricao = "x", Valor = 100m, Tipo = (int)TipoTransacao.Despesa,
            ContaId = null, CartaoCreditoId = null, Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = 1,
            DataInicio = DateTime.UtcNow.Date,
        };

        await Assert.ThrowsAsync<ArgumentException>(() => svc.AtualizarAsync(rec.Id, dto, u1));
    }

    [Fact]
    public async Task AtualizarAsync_DuasOrigens_LancaArgumentException()
    {
        var ctx = CreateContext();
        var u1 = SeedUsuario(ctx);
        var c1 = SeedConta(ctx, u1);
        var cartao1 = SeedCartao(ctx, u1);
        var rec = SeedRecorrente(ctx, u1, c1);

        var svc = CreateService(ctx);
        var dto = new CriarRecorrenteDto
        {
            Descricao = "x", Valor = 100m, Tipo = (int)TipoTransacao.Despesa,
            ContaId = c1, CartaoCreditoId = cartao1, Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = 1,
            DataInicio = DateTime.UtcNow.Date,
        };

        await Assert.ThrowsAsync<ArgumentException>(() => svc.AtualizarAsync(rec.Id, dto, u1));
    }

    [Fact]
    public async Task CriarAsync_CategoriaDeOutroUsuario_LancaKeyNotFound_NadaEhCriado()
    {
        var ctx = CreateContext();
        var u1 = SeedUsuario(ctx);
        var u2 = SeedUsuario(ctx);
        var c1 = SeedConta(ctx, u1);
        var categoriaDeOutro = SeedCategoria(ctx, u2);

        var svc = CreateService(ctx);
        var dto = new CriarRecorrenteDto
        {
            Descricao = "Assinatura", Valor = 50m, Tipo = (int)TipoTransacao.Despesa,
            ContaId = c1, CategoriaId = categoriaDeOutro, Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = 1,
            DataInicio = DateTime.UtcNow.Date,
        };

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.CriarAsync(dto, u1));
        Assert.Equal(0, await ctx.Recorrentes.CountAsync());
    }

    [Fact]
    public async Task CriarAsync_CategoriaGlobal_Funciona()
    {
        var ctx = CreateContext();
        var u1 = SeedUsuario(ctx);
        var c1 = SeedConta(ctx, u1);
        var categoriaGlobal = SeedCategoria(ctx, null);

        var svc = CreateService(ctx);
        var dto = new CriarRecorrenteDto
        {
            Descricao = "Streaming", Valor = 30m, Tipo = (int)TipoTransacao.Despesa,
            ContaId = c1, CategoriaId = categoriaGlobal, Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = 1,
            DataInicio = DateTime.UtcNow.Date,
        };

        var resultado = await svc.CriarAsync(dto, u1);

        Assert.Equal(categoriaGlobal, resultado.CategoriaId);
        Assert.Equal(1, await ctx.Recorrentes.CountAsync());
    }

    [Fact]
    public async Task EditarProximaOcorrenciaAsync_CategoriaDeOutroUsuario_LancaKeyNotFound_MantemCategoriaAntiga()
    {
        var ctx = CreateContext();
        var u1 = SeedUsuario(ctx);
        var u2 = SeedUsuario(ctx);
        var c1 = SeedConta(ctx, u1);
        var categoriaAntiga = SeedCategoria(ctx, u1);
        var categoriaDeOutro = SeedCategoria(ctx, u2);
        var rec = SeedRecorrente(ctx, u1, c1);
        var transacao = SeedTransacaoPrevisao(ctx, u1, rec.Id, c1);
        transacao.CategoriaId = categoriaAntiga;
        ctx.SaveChanges();

        var svc = CreateService(ctx);
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            svc.EditarProximaOcorrenciaAsync(rec.Id, new EditarProximaOcorrenciaDto { CategoriaId = categoriaDeOutro }, u1));

        var atualizada = await ctx.Transacoes.FindAsync(transacao.Id);
        Assert.Equal(categoriaAntiga, atualizada!.CategoriaId);
    }
}
