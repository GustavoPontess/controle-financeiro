using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Jobs;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure.Jobs;

/// <summary>
/// Jobs do motor das contas fixas (correção de 2026-10, branch fix/bugs-dinheiro-p1):
/// <list type="bullet">
/// <item><c>ExecutarRecorrentesJob</c> só efetiva previsão cuja conta fixa existe e está viva (ativa, não cancelada,
/// não excluída). Antes efetivava toda previsão com <c>RecorrenteOrigemId</c> — pausar/excluir não parava a cobrança.</item>
/// <item><c>ExpandirRecorrentesJob</c> realinha ANTES de expandir: cancela previsão de conta fixa que não deve mais
/// cobrar e refaz no dia certo as geradas no dia errado (regra velha "início + 1 mês"); idempotente; só expande
/// a que ainda cobra.</item>
/// </list>
/// Esperado calculado À PARTE (sem chamar <see cref="AgendaRecorrente"/>) e independente do dia em que a suíte roda.
/// </summary>
public class ContaFixaJobsTests
{
    // ── Setup ─────────────────────────────────────────────────────────────────

    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private static RecorrenteService Servico(AppDbContext ctx) =>
        new(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx));

    private static ExpandirRecorrentesJob ExpandirJob(AppDbContext ctx) =>
        new(ctx, new FaturaService(ctx), Servico(ctx), NullLogger<ExpandirRecorrentesJob>.Instance);

    private static ExecutarRecorrentesJob ExecutarJob(AppDbContext ctx) => new(ctx, new NotificacaoService(ctx, NullLogger<NotificacaoService>.Instance));

    private static DateOnly Hoje => HorarioBrasil.Hoje();

    private static DateTime Utc(DateOnly d) => d.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

    private static DateOnly D(int ano, int mes, int dia) => new(ano, mes, dia);

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

    // Sem DiaFechamento: a fatura é o mês calendário inteiro.
    private static Guid SeedCartao(AppDbContext ctx, Guid userId)
    {
        var c = new CartaoCredito { Id = Guid.NewGuid(), Nome = "Cartão", CriadoPor = userId, Ativo = true, TemCredito = true };
        ctx.CartoesCredito.Add(c);
        ctx.SaveChanges();
        return c.Id;
    }

    private static Recorrente SeedRecorrente(
        AppDbContext ctx, Guid userId, Guid? contaId, int dia, DateOnly inicio,
        FrequenciaRecorrencia freq = FrequenciaRecorrencia.Mensal, bool ativo = true, Guid? cartaoId = null,
        decimal valor = 1200m, DateOnly? cursor = null)
    {
        var r = new Recorrente
        {
            Id = Guid.NewGuid(),
            Descricao = "Aluguel",
            Valor = valor,
            Tipo = TipoTransacao.Despesa,
            ContaId = contaId,
            CartaoCreditoId = cartaoId,
            Frequencia = freq,
            Dia = dia,
            DataInicio = Utc(inicio),
            DataProximaGeracao = cursor is { } c ? Utc(c) : null,
            Ativo = ativo,
            CriadoPor = userId,
            CriadoEm = HorarioBrasil.Agora(),
        };
        ctx.Recorrentes.Add(r);
        ctx.SaveChanges();
        return r;
    }

    // Previsão/ocorrência "de" uma conta fixa — ou órfã (recorrenteOrigemId sem linha em Recorrentes).
    private static Transacao SeedTransacao(
        AppDbContext ctx, Recorrente r, DateOnly data, StatusTransacao status, bool ativo = true, Guid? faturaId = null,
        Guid? recorrenteOrigemId = null) => Salvar(ctx, new Transacao
    {
        Id = Guid.NewGuid(),
        Descricao = r.Descricao,
        Valor = r.Valor,
        Tipo = r.Tipo,
        ContaId = r.ContaId,
        CartaoCreditoId = r.CartaoCreditoId,
        FaturaId = faturaId,
        UsadoComoCredito = r.CartaoCreditoId.HasValue,
        StatusTransacao = status,
        Ativo = ativo,
        CanceladoEm = ativo ? null : HorarioBrasil.Agora(),
        CriadoPor = r.CriadoPor,
        Data = data,
        RecorrenteOrigemId = recorrenteOrigemId ?? r.Id,
        CriadoEm = HorarioBrasil.Agora(),
    });

    private static Transacao Salvar(AppDbContext ctx, Transacao t)
    {
        ctx.Transacoes.Add(t);
        ctx.SaveChanges();
        return t;
    }

    private static Task<List<Transacao>> TodasAsync(AppDbContext ctx, Guid recorrenteId) =>
        ctx.Transacoes.IgnoreQueryFilters().AsNoTracking()
            .Where(t => t.RecorrenteOrigemId == recorrenteId)
            .OrderBy(t => t.Data)
            .ToListAsync();

    private static async Task<List<DateOnly>> DatasPrevistasVivasAsync(AppDbContext ctx, Guid recorrenteId) =>
        (await TodasAsync(ctx, recorrenteId))
            .Where(t => t.Ativo && t.StatusTransacao == StatusTransacao.Previsao)
            .Select(t => t.Data).OrderBy(d => d).ToList();

    private static async Task<StatusTransacao> StatusAsync(AppDbContext ctx, Guid transacaoId) =>
        (await ctx.Transacoes.IgnoreQueryFilters().AsNoTracking().SingleAsync(t => t.Id == transacaoId)).StatusTransacao;

    private static Task<Recorrente> LinhaAsync(AppDbContext ctx, Guid id) =>
        ctx.Recorrentes.AsNoTracking().SingleAsync(r => r.Id == id);

    // Foto de TUDO (inclusive cancelado) pra provar que uma 2ª rodada não mexe em nada.
    private static async Task<List<(Guid Id, bool Ativo, DateOnly Data, StatusTransacao Status, decimal Valor)>> FotoAsync(AppDbContext ctx) =>
        (await ctx.Transacoes.IgnoreQueryFilters().AsNoTracking().ToListAsync())
            .OrderBy(t => t.Data).ThenBy(t => t.Id)
            .Select(t => (t.Id, t.Ativo, t.Data, t.StatusTransacao, t.Valor)).ToList();

    private static async Task<List<(Guid Id, DateTime? Cursor, bool Ativo)>> FotoRecorrentesAsync(AppDbContext ctx) =>
        (await ctx.Recorrentes.AsNoTracking().ToListAsync())
            .OrderBy(r => r.Id).Select(r => (r.Id, r.DataProximaGeracao, r.Ativo)).ToList();

    private static List<DateOnly> DatasMensais(DateOnly deInclusivo, DateOnly ateInclusivo, int dia)
    {
        var lista = new List<DateOnly>();
        var mes = D(deInclusivo.Year, deInclusivo.Month, 1);
        while (mes <= ateInclusivo)
        {
            var data = D(mes.Year, mes.Month, Math.Min(dia, DateTime.DaysInMonth(mes.Year, mes.Month)));
            if (data >= deInclusivo && data <= ateInclusivo) lista.Add(data);
            mes = mes.AddMonths(1);
        }
        return lista;
    }

    // Realinhamento (P1-1, 2026-10-05): recomeça do INÍCIO DO PERÍODO — o mês atual sem cobrança viva ganha a
    // sua no dia certo, mesmo que já tenha passado (o ExecutarRecorrentesJob efetiva). Antes era "a partir de
    // hoje" e o mês sumia; estes testes só passavam no dia 5 (quando as duas regras coincidem).
    private static List<DateOnly> DatasMensaisDoMesAtualAteFimDoAno(DateOnly hoje, int dia) =>
        DatasMensais(D(hoje.Year, hoje.Month, 1), D(hoje.Year, 12, 31), dia);

    private static List<DateOnly> DatasMensaisAteFimDoAno(DateOnly hoje, int dia) =>
        DatasMensais(hoje, D(hoje.Year, 12, 31), dia);

    private static DateOnly NoMes(DateOnly referencia, int mesesDepois, int dia)
    {
        var m = referencia.AddMonths(mesesDepois);
        return D(m.Year, m.Month, dia);
    }

    // ══ ExecutarRecorrentesJob ════════════════════════════════════════════════

    [Fact]
    public async Task Executar_ContaFixaAtiva_EfetivaAPrevisaoQueVenceu_ENaoAFutura()
    {
        // Controle: o filtro novo não pode ter quebrado o caminho feliz.
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), 15, hoje.AddMonths(-2));
        var ontem = SeedTransacao(ctx, r, hoje.AddDays(-1), StatusTransacao.Previsao);
        var deHoje = SeedTransacao(ctx, r, hoje, StatusTransacao.Previsao);
        var futura = SeedTransacao(ctx, r, hoje.AddDays(1), StatusTransacao.Previsao);

        await ExecutarJob(ctx).ExecuteAsync();

        Assert.Equal(StatusTransacao.Executado, await StatusAsync(ctx, ontem.Id));
        Assert.Equal(StatusTransacao.Executado, await StatusAsync(ctx, deHoje.Id));
        Assert.Equal(StatusTransacao.Previsao, await StatusAsync(ctx, futura.Id));
    }

    [Fact]
    public async Task Executar_ContaFixaPausada_NaoEfetivaMesmoPrevisaoQueJaExistiaComDataAteHoje()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var pausada = SeedRecorrente(ctx, u, SeedConta(ctx, u), 15, hoje.AddMonths(-2), ativo: false);
        var vencida = SeedTransacao(ctx, pausada, hoje.AddDays(-3), StatusTransacao.Previsao);
        var deHoje = SeedTransacao(ctx, pausada, hoje, StatusTransacao.Previsao);

        await ExecutarJob(ctx).ExecuteAsync();

        Assert.Equal(StatusTransacao.Previsao, await StatusAsync(ctx, vencida.Id));
        Assert.Equal(StatusTransacao.Previsao, await StatusAsync(ctx, deHoje.Id));
    }

    [Theory]
    [InlineData("excluida")]               // ExcluidoEm + Ativo=false (como a exclusão lógica grava)
    [InlineData("excluida-ativo-legado")]  // ExcluidoEm preenchido mas Ativo=true: o filtro tem que olhar o ExcluidoEm
    [InlineData("cancelada")]              // CanceladoEm + Ativo=false
    [InlineData("cancelada-ativo-legado")] // CanceladoEm preenchido mas Ativo=true
    [InlineData("orfa")]                   // RecorrenteOrigemId aponta pra um id que não existe (linha apagada antes da exclusão lógica)
    public async Task Executar_ExcluidaCanceladaOuOrfa_NaoEfetiva(string cenario)
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), 15, hoje.AddMonths(-2));
        switch (cenario)
        {
            case "excluida": r.ExcluidoEm = HorarioBrasil.Agora(); r.Ativo = false; break;
            case "excluida-ativo-legado": r.ExcluidoEm = HorarioBrasil.Agora(); break;
            case "cancelada": r.CanceladoEm = HorarioBrasil.Agora(); r.Ativo = false; break;
            case "cancelada-ativo-legado": r.CanceladoEm = HorarioBrasil.Agora(); break;
        }
        ctx.SaveChanges();
        var previsao = SeedTransacao(ctx, r, hoje.AddDays(-2), StatusTransacao.Previsao,
            recorrenteOrigemId: cenario == "orfa" ? Guid.NewGuid() : null);
        if (cenario == "orfa")
            Assert.Empty(await ctx.Recorrentes.Where(x => x.Id == previsao.RecorrenteOrigemId).ToListAsync()); // sem a linha mesmo

        await ExecutarJob(ctx).ExecuteAsync();

        Assert.Equal(StatusTransacao.Previsao, await StatusAsync(ctx, previsao.Id));
    }

    [Fact]
    public async Task Executar_PrevisaoCancelada_ContinuaCancelada_MesmoDeContaFixaAtiva()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), 15, hoje.AddMonths(-2));
        var cancelada = SeedTransacao(ctx, r, hoje.AddDays(-2), StatusTransacao.Previsao, ativo: false);

        await ExecutarJob(ctx).ExecuteAsync();

        var t = await ctx.Transacoes.IgnoreQueryFilters().AsNoTracking().SingleAsync(x => x.Id == cancelada.Id);
        Assert.False(t.Ativo);
        Assert.Equal(StatusTransacao.Previsao, t.StatusTransacao);
    }

    [Fact]
    public async Task Executar_VariasContasFixas_EfetivaSoAsQueAindaDevemCobrar()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var conta = SeedConta(ctx, u);
        var hoje = Hoje;
        var viva = SeedRecorrente(ctx, u, conta, 15, hoje.AddMonths(-2));
        var pausada = SeedRecorrente(ctx, u, conta, 15, hoje.AddMonths(-2), ativo: false);
        var excluida = SeedRecorrente(ctx, u, conta, 15, hoje.AddMonths(-2));
        excluida.ExcluidoEm = HorarioBrasil.Agora();
        excluida.Ativo = false;
        ctx.SaveChanges();
        var daViva = SeedTransacao(ctx, viva, hoje.AddDays(-1), StatusTransacao.Previsao);
        var daPausada = SeedTransacao(ctx, pausada, hoje.AddDays(-1), StatusTransacao.Previsao);
        var daExcluida = SeedTransacao(ctx, excluida, hoje.AddDays(-1), StatusTransacao.Previsao);
        var orfa = SeedTransacao(ctx, viva, hoje.AddDays(-1), StatusTransacao.Previsao, recorrenteOrigemId: Guid.NewGuid());

        await ExecutarJob(ctx).ExecuteAsync();

        Assert.Equal(StatusTransacao.Executado, await StatusAsync(ctx, daViva.Id));
        Assert.Equal(StatusTransacao.Previsao, await StatusAsync(ctx, daPausada.Id));
        Assert.Equal(StatusTransacao.Previsao, await StatusAsync(ctx, daExcluida.Id));
        Assert.Equal(StatusTransacao.Previsao, await StatusAsync(ctx, orfa.Id));
    }

    // ── Fluxos de ponta a ponta: o ato do usuário + o job que roda depois ─────

    [Fact]
    public async Task PausarDepoisRodarOJob_PrevisaoQueIriaVencer_NaoEhCobrada()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), 15, hoje.AddMonths(-2));
        SeedTransacao(ctx, r, hoje.AddDays(-1), StatusTransacao.Previsao);
        SeedTransacao(ctx, r, hoje, StatusTransacao.Previsao);

        await Servico(ctx).ToggleAtivoAsync(r.Id, u);
        await ExecutarJob(ctx).ExecuteAsync();

        var todas = await TodasAsync(ctx, r.Id);
        Assert.DoesNotContain(todas, t => t.StatusTransacao == StatusTransacao.Executado);
        Assert.All(todas, t => Assert.False(t.Ativo));
    }

    [Fact]
    public async Task ExcluirDepoisRodarOJob_PrevisaoQueIriaVencer_NaoEhCobrada_EHistoricoFica()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), 15, hoje.AddMonths(-2));
        var historico = SeedTransacao(ctx, r, hoje.AddMonths(-1), StatusTransacao.Executado);
        var vencendo = SeedTransacao(ctx, r, hoje, StatusTransacao.Previsao);

        await Servico(ctx).DeletarAsync(r.Id, u);
        await ExecutarJob(ctx).ExecuteAsync();

        var todas = await TodasAsync(ctx, r.Id);
        Assert.False(todas.Single(t => t.Id == vencendo.Id).Ativo);
        Assert.Equal(StatusTransacao.Previsao, todas.Single(t => t.Id == vencendo.Id).StatusTransacao);
        Assert.True(todas.Single(t => t.Id == historico.Id).Ativo); // o que já foi cobrado fica no histórico
    }

    [Fact]
    public async Task RetomarDepoisRodarOJob_CobraSoDeHoje_NaoOsMesesQueFicouParada()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: hoje.Day, inicio: hoje.AddMonths(-4), ativo: false);
        var historico = SeedTransacao(ctx, r, hoje.AddMonths(-3), StatusTransacao.Executado);

        await Servico(ctx).ToggleAtivoAsync(r.Id, u); // retoma: gera a partir de hoje (inclusive)
        await ExecutarJob(ctx).ExecuteAsync();

        var executadas = (await TodasAsync(ctx, r.Id))
            .Where(t => t.Ativo && t.StatusTransacao == StatusTransacao.Executado)
            .Select(t => t.Data).OrderBy(d => d).ToList();
        Assert.Equal(new[] { historico.Data, hoje }, executadas); // histórico + a de hoje; nenhuma retroativa
    }

    // ══ ExpandirRecorrentesJob — realinhar ════════════════════════════════════

    [Fact]
    public async Task Expandir_PrevisoesFuturasNoDiaErrado_SaoCanceladas_ENovasNascemNoDiaCerto_Idempotente()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        // "Dia 5", mas as previsões foram geradas pela regra velha, no dia 20.
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 5, inicio: hoje.AddMonths(-2), cursor: hoje.AddMonths(3));
        var historico = SeedTransacao(ctx, r, hoje.AddMonths(-1), StatusTransacao.Executado);
        var erradaA = SeedTransacao(ctx, r, NoMes(hoje, 1, 20), StatusTransacao.Previsao);
        var erradaB = SeedTransacao(ctx, r, NoMes(hoje, 2, 20), StatusTransacao.Previsao);

        await ExpandirJob(ctx).ExecuteAsync();

        var todas = await TodasAsync(ctx, r.Id);
        foreach (var id in new[] { erradaA.Id, erradaB.Id })
        {
            var errada = todas.Single(t => t.Id == id);
            Assert.False(errada.Ativo);
            Assert.Equal("Realinhada ao dia da conta fixa", errada.MotivoCancelamento);
        }
        Assert.Equal(DatasMensaisDoMesAtualAteFimDoAno(hoje, 5), await DatasPrevistasVivasAsync(ctx, r.Id));
        Assert.True(todas.Single(t => t.Id == historico.Id).Ativo); // histórico intacto
        Assert.Equal(StatusTransacao.Executado, todas.Single(t => t.Id == historico.Id).StatusTransacao);
        Assert.Equal(D(hoje.Year + 1, 1, 5), DateOnly.FromDateTime((await LinhaAsync(ctx, r.Id)).DataProximaGeracao!.Value));

        // Idempotente: a 2ª rodada não cancela nem cria nada.
        var fotoTransacoes = await FotoAsync(ctx);
        var fotoRecorrentes = await FotoRecorrentesAsync(ctx);
        await ExpandirJob(ctx).ExecuteAsync();
        Assert.Equal(fotoTransacoes, await FotoAsync(ctx));
        Assert.Equal(fotoRecorrentes, await FotoRecorrentesAsync(ctx));
    }

    [Fact]
    public async Task Expandir_Semanal_RealinhaPrevisoesForaDoCompassoDe7Dias()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var inicio = hoje.AddDays(-10);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 1, inicio: inicio,
            freq: FrequenciaRecorrencia.Semanal, cursor: hoje.AddDays(60));
        // inicio+11 e inicio+18: nenhuma é múltiplo de 7 a partir do início.
        var erradaA = SeedTransacao(ctx, r, hoje.AddDays(1), StatusTransacao.Previsao);
        var erradaB = SeedTransacao(ctx, r, hoje.AddDays(8), StatusTransacao.Previsao);

        await ExpandirJob(ctx).ExecuteAsync();

        // A semana corrente (inicio+7 … inicio+13) tinha a cobrança no dia errado (inicio+11, cancelada): ganha a
        // sua no dia certo, inicio+7 — já passado, o ExecutarRecorrentesJob efetiva. Antes a semana sumia.
        var esperado = new List<DateOnly>();
        for (var d = inicio; d < D(hoje.Year + 1, 1, 1); d = d.AddDays(7))
            if (d > hoje.AddDays(-7)) esperado.Add(d);
        Assert.Equal(esperado, await DatasPrevistasVivasAsync(ctx, r.Id));
        var todas = await TodasAsync(ctx, r.Id);
        Assert.False(todas.Single(t => t.Id == erradaA.Id).Ativo);
        Assert.False(todas.Single(t => t.Id == erradaB.Id).Ativo);
        Assert.All(esperado, d => Assert.Equal(0, (d.DayNumber - inicio.DayNumber) % 7));
    }

    [Fact]
    public async Task Expandir_PrevisoesDeContaFixaPausadaExcluidaCanceladaOuOrfa_SaoCanceladas_ENadaNovoEhGerado()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var conta = SeedConta(ctx, u);
        var hoje = Hoje;
        var inicio = hoje.AddMonths(-2);

        var pausada = SeedRecorrente(ctx, u, conta, 15, inicio, ativo: false);
        var cancelada = SeedRecorrente(ctx, u, conta, 15, inicio); cancelada.CanceladoEm = HorarioBrasil.Agora(); // Ativo=true legado
        var excluida = SeedRecorrente(ctx, u, conta, 15, inicio); excluida.ExcluidoEm = HorarioBrasil.Agora();    // Ativo=true legado
        var pausadaSemPrevisao = SeedRecorrente(ctx, u, conta, 15, inicio, ativo: false);
        ctx.SaveChanges();
        var previsoes = new[]
        {
            SeedTransacao(ctx, pausada, hoje.AddDays(10), StatusTransacao.Previsao),
            SeedTransacao(ctx, pausada, hoje.AddDays(40), StatusTransacao.Previsao),
            SeedTransacao(ctx, cancelada, hoje.AddDays(10), StatusTransacao.Previsao),
            SeedTransacao(ctx, excluida, hoje.AddDays(10), StatusTransacao.Previsao),
            SeedTransacao(ctx, pausada, hoje.AddDays(10), StatusTransacao.Previsao, recorrenteOrigemId: Guid.NewGuid()), // órfã
        };
        var viva = SeedRecorrente(ctx, u, conta, 15, inicio, cursor: hoje);
        var totalSemAViva = (await ctx.Transacoes.IgnoreQueryFilters().CountAsync());

        await ExpandirJob(ctx).ExecuteAsync();

        foreach (var p in previsoes)
        {
            var t = await ctx.Transacoes.IgnoreQueryFilters().AsNoTracking().SingleAsync(x => x.Id == p.Id);
            Assert.False(t.Ativo);
            Assert.Equal("Conta fixa não está mais ativa", t.MotivoCancelamento);
            Assert.NotNull(t.CanceladoEm);
        }
        // Nada novo pras que não cobram; só a viva expandiu.
        foreach (var r in new[] { pausada, cancelada, excluida, pausadaSemPrevisao })
            Assert.DoesNotContain(await TodasAsync(ctx, r.Id), t => t.Ativo);
        Assert.Empty(await TodasAsync(ctx, pausadaSemPrevisao.Id));
        Assert.Equal(DatasMensaisAteFimDoAno(hoje, 15), await DatasPrevistasVivasAsync(ctx, viva.Id));
        Assert.Equal(totalSemAViva + DatasMensaisAteFimDoAno(hoje, 15).Count, await ctx.Transacoes.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task Expandir_RealinhaDeVariosUsuarios_CadaUmNaSuaConta_SemMisturar()
    {
        var ctx = CreateContext();
        var hoje = Hoje;
        var u1 = SeedUsuario(ctx);
        var u2 = SeedUsuario(ctx);
        var conta1 = SeedConta(ctx, u1);
        var conta2 = SeedConta(ctx, u2);
        var r1 = SeedRecorrente(ctx, u1, conta1, 5, hoje.AddMonths(-2), cursor: hoje.AddMonths(3));
        var r2 = SeedRecorrente(ctx, u2, conta2, 5, hoje.AddMonths(-2), cursor: hoje.AddMonths(3));
        SeedTransacao(ctx, r1, NoMes(hoje, 1, 20), StatusTransacao.Previsao);
        SeedTransacao(ctx, r2, NoMes(hoje, 1, 20), StatusTransacao.Previsao);

        await ExpandirJob(ctx).ExecuteAsync();

        foreach (var (r, u, conta) in new[] { (r1, u1, conta1), (r2, u2, conta2) })
        {
            var vivas = (await TodasAsync(ctx, r.Id)).Where(t => t.Ativo).ToList();
            Assert.Equal(DatasMensaisDoMesAtualAteFimDoAno(hoje, 5), vivas.Select(t => t.Data).OrderBy(d => d).ToList());
            Assert.All(vivas, t =>
            {
                Assert.Equal(u, t.CriadoPor);
                Assert.Equal(conta, t.ContaId);
            });
        }
    }

    // ══ ExpandirRecorrentesJob — expandir ═════════════════════════════════════

    [Fact]
    public async Task Expandir_ContaFixaAtiva_GeraAteFimDoAnoNoDia_ESegundaRodadaNaoMudaNada()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var dia = hoje.Day == 15 ? 20 : 15;
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia, hoje.AddMonths(-2), cursor: hoje);

        await ExpandirJob(ctx).ExecuteAsync();

        var esperado = DatasMensaisAteFimDoAno(hoje, dia);
        Assert.Equal(esperado, await DatasPrevistasVivasAsync(ctx, r.Id));
        Assert.All(await TodasAsync(ctx, r.Id), t =>
        {
            Assert.Equal(StatusTransacao.Previsao, t.StatusTransacao);
            Assert.Null(t.Hora);
            Assert.Equal(1200m, t.Valor);
        });
        Assert.Equal(D(hoje.Year + 1, 1, dia), DateOnly.FromDateTime((await LinhaAsync(ctx, r.Id)).DataProximaGeracao!.Value));

        var foto = await FotoAsync(ctx);
        await ExpandirJob(ctx).ExecuteAsync();
        Assert.Equal(foto, await FotoAsync(ctx));
    }

    [Fact]
    public async Task Expandir_CursorForaDoCompasso_NormalizaPraODia_NuncaGeraNoDiaDoCursor()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var cursor = hoje.AddDays(1);
        var dia = cursor.Day == 5 ? 25 : 5; // diferente do dia do cursor velho
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia, hoje.AddMonths(-2), cursor: cursor);

        await ExpandirJob(ctx).ExecuteAsync();

        var datas = await DatasPrevistasVivasAsync(ctx, r.Id);
        Assert.Equal(DatasMensais(cursor, D(hoje.Year, 12, 31), dia), datas);
        Assert.All(datas, d => Assert.Equal(dia, d.Day));
    }

    [Fact]
    public async Task Expandir_ComDataFim_NaoGeraDepoisDoFim()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var fim = hoje.AddDays(45);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), 15, hoje.AddMonths(-2), cursor: hoje);
        r.DataFim = Utc(fim);
        ctx.SaveChanges();

        await ExpandirJob(ctx).ExecuteAsync();

        var limite = fim < D(hoje.Year, 12, 31) ? fim : D(hoje.Year, 12, 31);
        Assert.Equal(DatasMensais(hoje, limite, 15), await DatasPrevistasVivasAsync(ctx, r.Id));
    }

    // ══ ExpandirRecorrentesJob — cartão ═══════════════════════════════════════

    private static async Task<(Fatura Fatura, decimal Total)> FaturaDoMesAsync(AppDbContext ctx, Guid cartaoId, DateOnly noMes)
    {
        var faturas = await ctx.Faturas.AsNoTracking()
            .Include(f => f.Transacoes).Include(f => f.ParcelasTransacao)
            .Where(f => f.CartaoCreditoId == cartaoId)
            .ToListAsync();
        var f = faturas.Single(x => x.DataFechamento.Year == noMes.Year && x.DataFechamento.Month == noMes.Month);
        return (f, RegrasFinanceiras.ValorTotalFatura(f));
    }

    [Fact]
    public async Task Expandir_CartaoComPrevisaoNoDiaErrado_SaiDaFatura_EANovaEntraNoTotalComoCredito()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var cartao = SeedCartao(ctx, u);
        var r = SeedRecorrente(ctx, u, null, dia: 5, inicio: hoje.AddMonths(-2), cartaoId: cartao, valor: 50m, cursor: hoje.AddMonths(3));
        var dataErrada = NoMes(hoje, 1, 20);
        var faturaDoMes = await new FaturaService(ctx).ObterOuCriarFaturaAsync(cartao, dataErrada, u);
        var errada = SeedTransacao(ctx, r, dataErrada, StatusTransacao.Previsao, faturaId: faturaDoMes.Id);
        Assert.Equal(50m, (await FaturaDoMesAsync(ctx, cartao, dataErrada)).Total); // antes: a errada compõe o total

        await ExpandirJob(ctx).ExecuteAsync();

        Assert.False((await TodasAsync(ctx, r.Id)).Single(t => t.Id == errada.Id).Ativo);
        var (fatura, total) = await FaturaDoMesAsync(ctx, cartao, dataErrada);
        Assert.DoesNotContain(fatura.Transacoes, t => t.Id == errada.Id); // saiu da fatura
        // A do dia certo (dia 5 do mesmo mês) só nasce se couber até 31/12 — nesse caso é a ÚNICA do mês no total.
        var novaDoMes = NoMes(hoje, 1, 5);
        var esperado = novaDoMes < D(hoje.Year + 1, 1, 1) ? 50m : 0m;
        Assert.Equal(esperado, total);
        var novas = (await TodasAsync(ctx, r.Id)).Where(t => t.Ativo).ToList();
        Assert.Equal(DatasMensaisDoMesAtualAteFimDoAno(hoje, 5), novas.Select(t => t.Data).OrderBy(d => d).ToList());
        Assert.All(novas, t =>
        {
            Assert.True(t.UsadoComoCredito);
            Assert.NotNull(t.FaturaId);
            Assert.Equal(cartao, t.CartaoCreditoId);
        });
    }

    [Fact]
    public async Task Expandir_ContaFixaQueJaPassouPeloConsertoUnico_NaoEhRealinhadaDeNovo()
    {
        // P2-2: o conserto de legado roda uma vez por conta fixa (RealinhadoEm); depois o job não mexe mais nas
        // previsões dela — nem lê (antes carregava toda previsão pendente de todos os usuários, todo dia).
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 28, inicio: hoje.AddMonths(-2),
            cursor: D(hoje.Year + 1, 1, 28));
        r.RealinhadoEm = HorarioBrasil.Agora().AddDays(-1);
        ctx.SaveChanges();
        var foraDoDia = SeedTransacao(ctx, r, D(hoje.AddMonths(1).Year, hoje.AddMonths(1).Month, 1), StatusTransacao.Previsao);

        await ExpandirJob(ctx).ExecuteAsync();

        Assert.True((await TodasAsync(ctx, r.Id)).Single(t => t.Id == foraDoDia.Id).Ativo);
    }
}
