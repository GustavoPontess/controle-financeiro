using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Recorrente;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Motor das contas fixas (entidade <see cref="Recorrente"/>) — correção de 2026-10 (branch fix/bugs-dinheiro-p1).
/// Bugs que originaram: (1) o <c>Dia</c> escolhido era ignorado (Aluguel "dia 5" criado em 28/09 cobrava 28/10…);
/// (2) pausar só invertia <c>Ativo</c> e o ExecutarRecorrentesJob seguia efetivando as previsões; (3) retomar
/// cobrava os meses parados; (4) excluir apagava a linha e deixava previsões soltas, ainda cobradas; (5) previsão
/// de cartão cancelada não saía da fatura. Aqui: o serviço (criar/gerar/pausar/retomar/excluir/atualizar/realinhar,
/// leitura de próxima cobrança e stats, isolamento). Os jobs ficam em
/// <c>Infrastructure/Jobs/ContaFixaJobsTests</c>; as datas puras em <see cref="AgendaRecorrenteTests"/>.
/// Datas dos testes: FIXAS (2030) onde o que importa é o dia exato; relativas a hoje nos fluxos que dependem
/// de "agora", sempre com o esperado calculado À PARTE (sem chamar <see cref="AgendaRecorrente"/>) e
/// independente do dia do mês em que a suíte roda.
/// </summary>
public class RecorrenteContaFixaMotorTests
{
    // ── Setup ─────────────────────────────────────────────────────────────────

    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(
                Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);

    private static RecorrenteService CreateService(AppDbContext ctx) =>
        new(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx));

    private static DateOnly Hoje => DateOnly.FromDateTime(DateTime.UtcNow);

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

    // Sem DiaFechamento: a fatura é o mês calendário inteiro (CalcularPeriodo), então o mês da data = a fatura.
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
            CriadoEm = DateTime.UtcNow,
        };
        ctx.Recorrentes.Add(r);
        ctx.SaveChanges();
        return r;
    }

    private static Transacao SeedTransacao(
        AppDbContext ctx, Recorrente r, DateOnly data, StatusTransacao status,
        bool ativo = true, Guid? faturaId = null, decimal? valor = null)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = r.Descricao,
            Valor = valor ?? r.Valor,
            Tipo = r.Tipo,
            ContaId = r.ContaId,
            CartaoCreditoId = r.CartaoCreditoId,
            FaturaId = faturaId,
            UsadoComoCredito = r.CartaoCreditoId.HasValue,
            StatusTransacao = status,
            Ativo = ativo,
            CanceladoEm = ativo ? null : DateTime.UtcNow,
            CriadoPor = r.CriadoPor,
            Data = data,
            RecorrenteOrigemId = r.Id,
            CriadoEm = DateTime.UtcNow,
        };
        ctx.Transacoes.Add(t);
        ctx.SaveChanges();
        return t;
    }

    // Tudo que a conta fixa gerou, inclusive cancelado (o filtro global esconde Ativo=false).
    private static Task<List<Transacao>> TodasAsync(AppDbContext ctx, Guid recorrenteId) =>
        ctx.Transacoes.IgnoreQueryFilters().AsNoTracking()
            .Where(t => t.RecorrenteOrigemId == recorrenteId)
            .OrderBy(t => t.Data)
            .ToListAsync();

    private static async Task<List<Transacao>> VivasAsync(AppDbContext ctx, Guid recorrenteId) =>
        (await TodasAsync(ctx, recorrenteId)).Where(t => t.Ativo).ToList();

    private static async Task<List<DateOnly>> DatasPrevistasVivasAsync(AppDbContext ctx, Guid recorrenteId) =>
        (await VivasAsync(ctx, recorrenteId))
            .Where(t => t.StatusTransacao == StatusTransacao.Previsao)
            .Select(t => t.Data).OrderBy(d => d).ToList();

    private static Task<Recorrente> LinhaAsync(AppDbContext ctx, Guid id) =>
        ctx.Recorrentes.AsNoTracking().SingleAsync(r => r.Id == id);

    private static Task<List<FinancialEventLog>> EventosAsync(AppDbContext ctx, Guid entidadeId) =>
        ctx.FinancialEventLogs.AsNoTracking().Where(e => e.EntidadeId == entidadeId).ToListAsync();

    // Esperado calculado à parte (NÃO chama AgendaRecorrente): toda data "no dia X" de cada mês entre os limites
    // (inclusive), com o clamp de mês curto.
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

    // O que a expansão (e retomar/alterar) gera: de hoje até 31/12 do ano corrente.
    private static List<DateOnly> DatasMensaisAteFimDoAno(DateOnly hoje, int dia) =>
        DatasMensais(hoje, D(hoje.Year, 12, 31), dia);

    // Cursor esperado depois de gerar até o fim do ano: o dia pedido em janeiro do ano seguinte.
    private static DateOnly CursorEmJaneiroDoAnoSeguinte(DateOnly hoje, int dia) => D(hoje.Year + 1, 1, dia);

    private static int DiaDiferenteDe(int dia, int a = 15, int b = 20) => dia == a ? b : a;

    private static CriarRecorrenteDto Dto(
        Recorrente r, int? dia = null, decimal? valor = null, Guid? contaId = null) => new()
    {
        Descricao = r.Descricao,
        Valor = valor ?? r.Valor,
        Tipo = (int)r.Tipo,
        ContaId = contaId ?? r.ContaId,
        CartaoCreditoId = contaId == null ? r.CartaoCreditoId : null,
        Frequencia = (int)r.Frequencia,
        Dia = dia ?? r.Dia,
        DataInicio = r.DataInicio,
        DataFim = r.DataFim,
    };

    // ══ Criar ═════════════════════════════════════════════════════════════════

    [Fact]
    public async Task CriarAsync_DiaEscolhido_GeraPrevisoesNoDia5_NaoNoDiaDoInicio_ECursorApontaProximaDataDepoisDaJanela()
    {
        // O caso do bug: Aluguel "dia 5" criado em 28/09 cobrava 28/10, 28/11… Janela = início + 3 meses (até 28/12, exclusivo).
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var conta = SeedConta(ctx, u);

        var dto = await CreateService(ctx).CriarAsync(new CriarRecorrenteDto
        {
            Descricao = "Aluguel", Valor = 1500m, Tipo = (int)TipoTransacao.Despesa, ContaId = conta,
            Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = 5,
            DataInicio = new DateTime(2030, 9, 28, 0, 0, 0, DateTimeKind.Utc),
        }, u);

        var previsoes = await VivasAsync(ctx, dto.Id);
        Assert.Equal(new[] { D(2030, 10, 5), D(2030, 11, 5), D(2030, 12, 5) }, previsoes.Select(t => t.Data).ToArray());
        Assert.All(previsoes, t =>
        {
            Assert.Equal(StatusTransacao.Previsao, t.StatusTransacao);
            Assert.Equal(1500m, t.Valor);
            Assert.Equal(conta, t.ContaId);
            Assert.Null(t.Hora); // ocorrência de conta fixa é datada, sem hora de relógio
            Assert.False(t.UsadoComoCredito);
        });
        Assert.Equal(D(2031, 1, 5), DateOnly.FromDateTime((await LinhaAsync(ctx, dto.Id)).DataProximaGeracao!.Value));
        Assert.Equal(D(2030, 10, 5), dto.ProximaCobranca); // a tela mostra a cobrança, não o cursor
    }

    [Fact]
    public async Task CriarAsync_Dia31_FevereiroCaiNo28_EMarcoVoltaPro31()
    {
        // Início 31/01/2030, janela até 30/04/2030 (exclusivo): jan 31, fev 28 (2030 não é bissexto), mar 31.
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var conta = SeedConta(ctx, u);

        var dto = await CreateService(ctx).CriarAsync(new CriarRecorrenteDto
        {
            Descricao = "Condomínio", Valor = 800m, Tipo = (int)TipoTransacao.Despesa, ContaId = conta,
            Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = 31,
            DataInicio = new DateTime(2030, 1, 31, 0, 0, 0, DateTimeKind.Utc),
        }, u);

        Assert.Equal(new[] { D(2030, 1, 31), D(2030, 2, 28), D(2030, 3, 31) }, await DatasPrevistasVivasAsync(ctx, dto.Id));
        Assert.Equal(D(2030, 4, 30), DateOnly.FromDateTime((await LinhaAsync(ctx, dto.Id)).DataProximaGeracao!.Value));
    }

    [Fact]
    public async Task CriarAsync_Semanal_GeraACada7Dias_IgnorandoODia()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var conta = SeedConta(ctx, u);
        var inicio = D(2030, 9, 28);

        var dto = await CreateService(ctx).CriarAsync(new CriarRecorrenteDto
        {
            Descricao = "Feira", Valor = 90m, Tipo = (int)TipoTransacao.Despesa, ContaId = conta,
            Frequencia = (int)FrequenciaRecorrencia.Semanal, Dia = 17, // Dia não se aplica à semanal
            DataInicio = Utc(inicio),
        }, u);

        var datas = await DatasPrevistasVivasAsync(ctx, dto.Id);
        // Janela 28/09 → 28/12/2030 (exclusivo) = 91 dias = 13 semanas: 28/09 … 21/12.
        Assert.Equal(13, datas.Count);
        Assert.Equal(inicio, datas.First());
        Assert.Equal(D(2030, 12, 21), datas.Last());
        Assert.All(datas, d => Assert.Equal(0, (d.DayNumber - inicio.DayNumber) % 7));
        Assert.Equal(D(2030, 12, 28), DateOnly.FromDateTime((await LinhaAsync(ctx, dto.Id)).DataProximaGeracao!.Value));
    }

    [Fact]
    public async Task CriarAsync_Anual_PrimeiraCobrancaForaDaJanela_NaoGeraNada_MasCursorApontaAData()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var conta = SeedConta(ctx, u);

        var dto = await CreateService(ctx).CriarAsync(new CriarRecorrenteDto
        {
            Descricao = "Seguro", Valor = 2400m, Tipo = (int)TipoTransacao.Despesa, ContaId = conta,
            Frequencia = (int)FrequenciaRecorrencia.Anual, Dia = 5,
            DataInicio = new DateTime(2030, 9, 28, 0, 0, 0, DateTimeKind.Utc),
        }, u);

        Assert.Empty(await TodasAsync(ctx, dto.Id)); // 05/09/2031 está muito além da janela de 3 meses
        Assert.Equal(D(2031, 9, 5), DateOnly.FromDateTime((await LinhaAsync(ctx, dto.Id)).DataProximaGeracao!.Value));
    }

    [Fact]
    public async Task CriarAsync_ComDataFim_NaoGeraDepoisDoFim_FimEhInclusivo()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var conta = SeedConta(ctx, u);

        var dto = await CreateService(ctx).CriarAsync(new CriarRecorrenteDto
        {
            Descricao = "Curso", Valor = 300m, Tipo = (int)TipoTransacao.Despesa, ContaId = conta,
            Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = 5,
            DataInicio = new DateTime(2030, 9, 28, 0, 0, 0, DateTimeKind.Utc),
            DataFim = new DateTime(2030, 11, 5, 0, 0, 0, DateTimeKind.Utc), // o dia 05/11 ainda cobra
        }, u);

        Assert.Equal(new[] { D(2030, 10, 5), D(2030, 11, 5) }, await DatasPrevistasVivasAsync(ctx, dto.Id));
    }

    // ══ Gerador único ═════════════════════════════════════════════════════════

    [Fact]
    public async Task GerarOcorrenciasAsync_Dia31_CriaNoCompassoDoMesCurto_EAvancaOCursor_SemSalvar()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 31, inicio: D(2030, 1, 31));

        var criadas = await CreateService(ctx).GerarOcorrenciasAsync(r, D(2030, 5, 1), StatusTransacao.Previsao);

        Assert.Equal(4, criadas);
        Assert.Equal(new[] { D(2030, 1, 31), D(2030, 2, 28), D(2030, 3, 31), D(2030, 4, 30) },
            ctx.Transacoes.Local.Select(t => t.Data).OrderBy(d => d).ToArray());
        Assert.Equal(D(2030, 5, 31), DateOnly.FromDateTime(r.DataProximaGeracao!.Value)); // cursor = próxima data do compasso
        Assert.Empty(await ctx.Transacoes.AsNoTracking().ToListAsync());                  // "não salva": o chamador salva
    }

    [Fact]
    public async Task GerarOcorrenciasAsync_DataJaOcupadaNaMemoria_NaoDuplica()
    {
        // O gerador lê o banco E o ChangeTracker: criada agora (ainda não salva) conta como ocupada.
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 5, inicio: D(2030, 9, 6)); // o 05/09 é antes do início
        var svc = CreateService(ctx);
        Assert.Equal(3, await svc.GerarOcorrenciasAsync(r, D(2030, 12, 31), StatusTransacao.Previsao)); // 05/10, 05/11, 05/12

        r.DataProximaGeracao = null; // volta o cursor e gera de novo, sem ter salvo
        var denovo = await svc.GerarOcorrenciasAsync(r, D(2030, 12, 31), StatusTransacao.Previsao);

        Assert.Equal(0, denovo);
        Assert.Equal(3, ctx.Transacoes.Local.Count);
    }

    [Fact]
    public async Task GerarOcorrenciasAsync_DataJaOcupadaNoBanco_NaoDuplica_MasCanceladaNaoContaComoOcupada()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 5, inicio: D(2030, 9, 1));
        SeedTransacao(ctx, r, D(2030, 10, 5), StatusTransacao.Executado);                 // viva: pula
        SeedTransacao(ctx, r, D(2030, 11, 5), StatusTransacao.Previsao, ativo: false);   // cancelada: gera de novo
        var svc = CreateService(ctx);
        r.DataProximaGeracao = Utc(D(2030, 10, 1));

        var criadas = await svc.GerarOcorrenciasAsync(r, D(2030, 12, 31), StatusTransacao.Previsao);
        await ctx.SaveChangesAsync();

        Assert.Equal(2, criadas); // 05/11 (a cancelada não ocupa) e 05/12 — o 05/10 já tinha ocorrência viva
        var vivas = await VivasAsync(ctx, r.Id);
        Assert.Equal(new[] { D(2030, 10, 5), D(2030, 11, 5), D(2030, 12, 5) }, vivas.Select(t => t.Data).ToArray());
        Assert.Equal(StatusTransacao.Executado, vivas[0].StatusTransacao);
    }

    [Fact]
    public async Task GerarOcorrenciasAsync_CursorForaDoCompasso_ENormalizadoPraProximaDataDoDia()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        // Cursor antigo "no dia 28" (gerado pela regra velha), mas a conta fixa é do dia 5.
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 5, inicio: D(2030, 9, 1), cursor: D(2030, 10, 28));

        await CreateService(ctx).GerarOcorrenciasAsync(r, D(2031, 1, 1), StatusTransacao.Previsao);
        await ctx.SaveChangesAsync();

        // 28/10 normaliza pra 05/11 — nunca nasce ocorrência no dia 28.
        Assert.Equal(new[] { D(2030, 11, 5), D(2030, 12, 5) }, await DatasPrevistasVivasAsync(ctx, r.Id));
    }

    [Fact]
    public async Task GerarPendentesAsync_LancaComoExecutadoOQueVenceuAteHoje_NoDia_ESemRepetirNaSegundaChamada()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var inicio = hoje.AddMonths(-2);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 5, inicio: inicio);
        var svc = CreateService(ctx);

        await svc.GerarPendentesAsync(u);

        var esperado = DatasMensais(inicio, hoje, 5);
        var vivas = await VivasAsync(ctx, r.Id);
        Assert.Equal(esperado, vivas.Select(t => t.Data).ToList());
        Assert.All(vivas, t => Assert.Equal(StatusTransacao.Executado, t.StatusTransacao));
        var cursor = DateOnly.FromDateTime((await LinhaAsync(ctx, r.Id)).DataProximaGeracao!.Value);
        Assert.True(cursor > hoje, "o cursor tem que passar de hoje");
        Assert.Equal(5, cursor.Day);

        await svc.GerarPendentesAsync(u); // roda a cada GET da lista: não pode cobrar de novo
        Assert.Equal(esperado.Count, (await VivasAsync(ctx, r.Id)).Count);
    }

    [Fact]
    public async Task GerarPendentesAsync_PausadaCanceladaOuExcluida_NaoLancaNada()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var conta = SeedConta(ctx, u);
        var inicio = Hoje.AddMonths(-2);
        var pausada = SeedRecorrente(ctx, u, conta, 5, inicio, ativo: false);
        var cancelada = SeedRecorrente(ctx, u, conta, 5, inicio, ativo: false);
        cancelada.CanceladoEm = DateTime.UtcNow;
        var excluidaComAtivoLegado = SeedRecorrente(ctx, u, conta, 5, inicio); // Ativo=true mas excluída
        excluidaComAtivoLegado.ExcluidoEm = DateTime.UtcNow;
        ctx.SaveChanges();

        await CreateService(ctx).GerarPendentesAsync(u);

        Assert.Empty(await ctx.Transacoes.IgnoreQueryFilters().Where(t => t.RecorrenteOrigemId != null).ToListAsync());
    }

    // ══ Pausar ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task ToggleAtivoAsync_Pausar_CancelaTodasAsPrevisoesPendentes_MantemHistorico_RegistraEvento()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 15, inicio: hoje.AddMonths(-3));
        var historico = SeedTransacao(ctx, r, hoje.AddMonths(-1), StatusTransacao.Executado);
        var vencida = SeedTransacao(ctx, r, hoje.AddDays(-3), StatusTransacao.Previsao); // ainda não efetivada pelo job
        var proxima = SeedTransacao(ctx, r, hoje.AddDays(5), StatusTransacao.Previsao);
        var distante = SeedTransacao(ctx, r, hoje.AddDays(40), StatusTransacao.Previsao);
        var svc = CreateService(ctx);

        await svc.ToggleAtivoAsync(r.Id, u);

        var linha = await LinhaAsync(ctx, r.Id);
        Assert.False(linha.Ativo);
        Assert.Null(linha.CanceladoEm); // pausada NÃO é cancelada: pode voltar
        var todas = await TodasAsync(ctx, r.Id);
        foreach (var id in new[] { vencida.Id, proxima.Id, distante.Id })
        {
            var t = todas.Single(x => x.Id == id);
            Assert.False(t.Ativo);
            Assert.NotNull(t.CanceladoEm);
            Assert.Equal("Conta fixa pausada", t.MotivoCancelamento);
        }
        Assert.True(todas.Single(x => x.Id == historico.Id).Ativo); // o que já foi cobrado fica
        Assert.Equal(StatusTransacao.Executado, todas.Single(x => x.Id == historico.Id).StatusTransacao);

        var evento = Assert.Single(await EventosAsync(ctx, r.Id));
        Assert.Equal(FinancialEventType.RecorrentePausada, evento.Tipo);
        Assert.Equal("Recorrente", evento.EntidadeAfetada);
        Assert.Equal(u, evento.CriadoPor);
        Assert.Contains("\"previsoesCanceladas\":3", evento.PayloadJson);

        var item = (await svc.ListarAsync(u)).Items.Single();
        Assert.Equal(SituacaoRecorrente.Pausada, item.Situacao);
        Assert.Null(item.ProximaCobranca);
    }

    // ══ Retomar ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task ToggleAtivoAsync_Retomar_GeraAPartirDeHojeNoDia_ENaoCobraOsMesesParados()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var dia = DiaDiferenteDe(hoje.Day);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia, inicio: hoje.AddMonths(-4), ativo: false,
            cursor: hoje.AddMonths(-3)); // cursor velho, de antes da pausa
        SeedTransacao(ctx, r, hoje.AddMonths(-4), StatusTransacao.Executado);
        SeedTransacao(ctx, r, hoje.AddMonths(-3), StatusTransacao.Executado);
        // Parada há ~3 meses: os meses -2, -1 e o começo do atual NÃO podem ser cobrados agora.

        await CreateService(ctx).ToggleAtivoAsync(r.Id, u);

        var linha = await LinhaAsync(ctx, r.Id);
        Assert.True(linha.Ativo);
        var esperado = DatasMensaisAteFimDoAno(hoje, dia);
        Assert.Equal(esperado, await DatasPrevistasVivasAsync(ctx, r.Id));
        var todas = await TodasAsync(ctx, r.Id);
        Assert.Equal(2, todas.Count(t => t.Data < hoje)); // só o histórico semeado; nada retroativo
        Assert.Equal(CursorEmJaneiroDoAnoSeguinte(hoje, dia), DateOnly.FromDateTime(linha.DataProximaGeracao!.Value));

        var evento = Assert.Single(await EventosAsync(ctx, r.Id));
        Assert.Equal(FinancialEventType.RecorrenteRetomada, evento.Tipo);
        Assert.Contains($"\"previsoesCriadas\":{esperado.Count}", evento.PayloadJson);
    }

    [Fact]
    public async Task ToggleAtivoAsync_Retomar_OcorrenciaDeHojeJaEfetivada_NaoDuplica()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: hoje.Day, inicio: hoje.AddMonths(-2), ativo: false);
        var efetivadaHoje = SeedTransacao(ctx, r, hoje, StatusTransacao.Executado);

        await CreateService(ctx).ToggleAtivoAsync(r.Id, u);

        var vivasHoje = (await VivasAsync(ctx, r.Id)).Where(t => t.Data == hoje).ToList();
        var unica = Assert.Single(vivasHoje); // sem cobrança em dobro no mesmo dia
        Assert.Equal(efetivadaHoje.Id, unica.Id);
        Assert.Equal(StatusTransacao.Executado, unica.StatusTransacao);
        Assert.Equal(DatasMensaisAteFimDoAno(hoje, hoje.Day).Where(d => d != hoje).ToList(),
            await DatasPrevistasVivasAsync(ctx, r.Id));
    }

    [Fact]
    public async Task ToggleAtivoAsync_PausarERetomar_RecomecaDeHoje_SemDuplicarPrevisoes()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var dia = DiaDiferenteDe(hoje.Day, 5, 25);
        var svc = CreateService(ctx);
        var dto = await svc.CriarAsync(new CriarRecorrenteDto
        {
            Descricao = "Aluguel", Valor = 1200m, Tipo = (int)TipoTransacao.Despesa, ContaId = SeedConta(ctx, u),
            Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = dia, DataInicio = Utc(hoje),
        }, u);
        Assert.NotEmpty(await DatasPrevistasVivasAsync(ctx, dto.Id)); // janela de 3 meses sempre tem 3 datas do dia

        await svc.ToggleAtivoAsync(dto.Id, u); // pausa
        Assert.Empty(await VivasAsync(ctx, dto.Id));
        await svc.ToggleAtivoAsync(dto.Id, u); // retoma

        var datas = await DatasPrevistasVivasAsync(ctx, dto.Id);
        Assert.Equal(DatasMensaisAteFimDoAno(hoje, dia), datas);
        Assert.Equal(datas.Count, datas.Distinct().Count());
    }

    // ══ Excluir ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task DeletarAsync_SomeDeListaEStats_RegistraEvento_EMantemHistoricoIntocado()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var conta = SeedConta(ctx, u);
        var excluida = SeedRecorrente(ctx, u, conta, 15, hoje.AddMonths(-3), valor: 500m);
        var fica = SeedRecorrente(ctx, u, conta, 15, hoje.AddMonths(-3), valor: 100m);
        var cobrada = SeedTransacao(ctx, excluida, hoje.AddMonths(-1), StatusTransacao.Executado);
        var prevista = SeedTransacao(ctx, excluida, hoje.AddDays(10), StatusTransacao.Previsao);
        SeedTransacao(ctx, fica, hoje.AddDays(12), StatusTransacao.Previsao);
        var svc = CreateService(ctx);
        var antes = await svc.ObterStatsAsync(u);
        Assert.Equal(2, antes.Ativas);
        Assert.Equal(2, antes.QtdTotal);
        Assert.Equal(2, antes.Proximas30Dias);

        await svc.DeletarAsync(excluida.Id, u);

        var depois = await svc.ObterStatsAsync(u);
        Assert.Equal(1, depois.Ativas);
        Assert.Equal(1, depois.QtdTotal);
        Assert.Equal(1, depois.Proximas30Dias);
        Assert.Equal(100m, depois.CustoMensalDespesas);
        var lista = await svc.ListarAsync(u);
        Assert.Equal(1, lista.Total);
        Assert.Equal(fica.Id, lista.Items.Single().Id);

        var linha = await LinhaAsync(ctx, excluida.Id);
        Assert.NotNull(linha.ExcluidoEm);
        Assert.False(linha.Ativo);
        var todas = await TodasAsync(ctx, excluida.Id);
        Assert.False(todas.Single(t => t.Id == prevista.Id).Ativo);
        Assert.Equal("Conta fixa excluída", todas.Single(t => t.Id == prevista.Id).MotivoCancelamento);
        Assert.True(todas.Single(t => t.Id == cobrada.Id).Ativo);

        var evento = Assert.Single(await EventosAsync(ctx, excluida.Id));
        Assert.Equal(FinancialEventType.RecorrenteExcluida, evento.Tipo);
        Assert.Contains("\"previsoesCanceladas\":1", evento.PayloadJson);
    }

    private static async Task OperarAsync(RecorrenteService svc, string operacao, Guid id, Guid usuarioId, Guid contaId)
    {
        switch (operacao)
        {
            case "toggle": await svc.ToggleAtivoAsync(id, usuarioId); break;
            case "cancelar": await svc.CancelarAsync(id, new CancelarRecorrenteDto { Motivo = "x" }, usuarioId); break;
            case "deletar": await svc.DeletarAsync(id, usuarioId); break;
            case "editar-proxima":
                await svc.EditarProximaOcorrenciaAsync(id, new EditarProximaOcorrenciaDto { Valor = 10m }, usuarioId); break;
            case "atualizar":
                await svc.AtualizarAsync(id, new CriarRecorrenteDto
                {
                    Descricao = "x", Valor = 1m, Tipo = (int)TipoTransacao.Despesa, ContaId = contaId,
                    Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = 1, DataInicio = DateTime.UtcNow.Date,
                }, usuarioId);
                break;
            default: throw new ArgumentOutOfRangeException(nameof(operacao));
        }
    }

    [Theory]
    [InlineData("toggle")]
    [InlineData("cancelar")]
    [InlineData("deletar")]
    [InlineData("atualizar")]
    [InlineData("editar-proxima")]
    public async Task Excluida_QualquerOperacao_LancaKeyNotFound_ENadaMuda(string operacao)
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var conta = SeedConta(ctx, u);
        var r = SeedRecorrente(ctx, u, conta, 15, Hoje.AddMonths(-1));
        SeedTransacao(ctx, r, Hoje.AddDays(10), StatusTransacao.Previsao);
        var svc = CreateService(ctx);
        await svc.DeletarAsync(r.Id, u);
        var excluidoEm = (await LinhaAsync(ctx, r.Id)).ExcluidoEm;
        var eventosAntes = (await EventosAsync(ctx, r.Id)).Count;

        await Assert.ThrowsAsync<KeyNotFoundException>(() => OperarAsync(svc, operacao, r.Id, u, conta));

        var linha = await LinhaAsync(ctx, r.Id);
        Assert.Equal(excluidoEm, linha.ExcluidoEm); // a 2ª exclusão não reescreve o carimbo
        Assert.False(linha.Ativo);
        Assert.Equal(eventosAntes, (await EventosAsync(ctx, r.Id)).Count); // nada novo no audit log
        Assert.Empty(await DatasPrevistasVivasAsync(ctx, r.Id));            // nada foi regerado
    }

    [Fact]
    public async Task Excluida_ComAtivoLegadoTrue_NaoApareceEmListarNemEmStats()
    {
        // Defesa: dado incoerente (ExcluidoEm preenchido mas Ativo=true) não pode aparecer nem pesar no hero.
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), 15, Hoje.AddMonths(-1));
        r.ExcluidoEm = DateTime.UtcNow;
        SeedTransacao(ctx, r, Hoje.AddDays(5), StatusTransacao.Previsao);
        ctx.SaveChanges();
        var svc = CreateService(ctx);

        var lista = await svc.ListarAsync(u);
        var stats = await svc.ObterStatsAsync(u);

        Assert.Equal(0, lista.Total);
        Assert.Empty(lista.Items);
        Assert.Equal(0, stats.Ativas);
        Assert.Equal(0, stats.QtdTotal);
        Assert.Equal(0m, stats.CustoMensalDespesas);
        Assert.Equal(0, stats.Proximas30Dias);
    }

    // ══ Atualizar ═════════════════════════════════════════════════════════════

    [Fact]
    public async Task AtualizarAsync_MudandoODia_PrevisoesFuturasPassamPraODiaNovo()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var conta = SeedConta(ctx, u);
        var svc = CreateService(ctx);
        var criada = await svc.CriarAsync(new CriarRecorrenteDto
        {
            Descricao = "Aluguel", Valor = 1200m, Tipo = (int)TipoTransacao.Despesa, ContaId = conta,
            Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = 5, DataInicio = Utc(hoje),
        }, u);
        var antigas = (await VivasAsync(ctx, criada.Id)).Select(t => t.Id).ToList();
        Assert.NotEmpty(antigas);
        var r = await ctx.Recorrentes.FindAsync(criada.Id);

        await svc.AtualizarAsync(criada.Id, Dto(r!, dia: 20), u);

        Assert.Equal(DatasMensaisAteFimDoAno(hoje, 20), await DatasPrevistasVivasAsync(ctx, criada.Id));
        var todas = await TodasAsync(ctx, criada.Id);
        foreach (var id in antigas)
        {
            var antiga = todas.Single(t => t.Id == id);
            Assert.False(antiga.Ativo);
            Assert.Equal("Conta fixa alterada", antiga.MotivoCancelamento);
        }
        var linha = await LinhaAsync(ctx, criada.Id);
        Assert.Equal(20, linha.Dia);
        Assert.Equal(CursorEmJaneiroDoAnoSeguinte(hoje, 20), DateOnly.FromDateTime(linha.DataProximaGeracao!.Value));
    }

    [Fact]
    public async Task AtualizarAsync_OcorrenciaDeHojeJaEfetivada_NaoDuplica_EPrevisoesNovasUsamOValorNovo()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var conta = SeedConta(ctx, u);
        var r = SeedRecorrente(ctx, u, conta, dia: hoje.Day, inicio: hoje.AddMonths(-2), valor: 1200m);
        var efetivadaHoje = SeedTransacao(ctx, r, hoje, StatusTransacao.Executado);
        var proxima = SeedTransacao(ctx, r, hoje.AddMonths(1), StatusTransacao.Previsao);
        var svc = CreateService(ctx);

        await svc.AtualizarAsync(r.Id, Dto(r, valor: 999m), u);

        var vivas = await VivasAsync(ctx, r.Id);
        var deHoje = Assert.Single(vivas, t => t.Data == hoje); // sem 2ª cobrança no dia já efetivado
        Assert.Equal(efetivadaHoje.Id, deHoje.Id);
        Assert.Equal(1200m, deHoje.Valor); // o histórico não é reescrito
        var previsoes = vivas.Where(t => t.StatusTransacao == StatusTransacao.Previsao).ToList();
        Assert.All(previsoes, t => Assert.Equal(999m, t.Valor));
        Assert.Equal(DatasMensaisAteFimDoAno(hoje, hoje.Day).Where(d => d != hoje).ToList(),
            previsoes.Select(t => t.Data).OrderBy(d => d).ToList());
        Assert.False((await TodasAsync(ctx, r.Id)).Single(t => t.Id == proxima.Id).Ativo); // a antiga foi substituída
    }

    [Fact]
    public async Task AtualizarAsync_PrevisaoPendenteDeHoje_ViraUmaSoComOValorNovo()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: hoje.Day, inicio: hoje.AddMonths(-2));
        var antiga = SeedTransacao(ctx, r, hoje, StatusTransacao.Previsao);

        await CreateService(ctx).AtualizarAsync(r.Id, Dto(r, valor: 999m), u);

        var deHoje = Assert.Single(await VivasAsync(ctx, r.Id), t => t.Data == hoje);
        Assert.NotEqual(antiga.Id, deHoje.Id);
        Assert.Equal(StatusTransacao.Previsao, deHoje.StatusTransacao);
        Assert.Equal(999m, deHoje.Valor);
        Assert.False((await TodasAsync(ctx, r.Id)).Single(t => t.Id == antiga.Id).Ativo);
    }

    [Fact]
    public async Task AtualizarAsync_TrocandoDeConta_PrevisoesNovasUsamAContaNova()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var contaVelha = SeedConta(ctx, u);
        var contaNova = SeedConta(ctx, u);
        var r = SeedRecorrente(ctx, u, contaVelha, dia: 15, inicio: hoje.AddMonths(-2));
        SeedTransacao(ctx, r, hoje.AddMonths(1), StatusTransacao.Previsao);

        await CreateService(ctx).AtualizarAsync(r.Id, Dto(r, contaId: contaNova), u);

        var previsoes = (await VivasAsync(ctx, r.Id)).Where(t => t.StatusTransacao == StatusTransacao.Previsao).ToList();
        Assert.All(previsoes, t => Assert.Equal(contaNova, t.ContaId));
        Assert.Equal(DatasMensaisAteFimDoAno(hoje, 15), previsoes.Select(t => t.Data).OrderBy(d => d).ToList());
    }

    [Fact]
    public async Task AtualizarAsync_ContaFixaPausada_AtualizaOsCampos_MasNaoGeraPrevisoes()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var conta = SeedConta(ctx, u);
        var r = SeedRecorrente(ctx, u, conta, dia: 15, inicio: Hoje.AddMonths(-2), ativo: false);

        await CreateService(ctx).AtualizarAsync(r.Id, Dto(r, dia: 20, valor: 777m), u);

        var linha = await LinhaAsync(ctx, r.Id);
        Assert.Equal(20, linha.Dia);
        Assert.Equal(777m, linha.Valor);
        Assert.False(linha.Ativo); // editar não retoma
        Assert.Empty(await TodasAsync(ctx, r.Id));
    }

    // ══ Realinhar (serviço) ═══════════════════════════════════════════════════

    [Fact]
    public async Task RealinharAsync_PrevisoesFuturasNoDiaErrado_CancelaResetaCursor_EEhIdempotente()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 5, inicio: hoje.AddMonths(-2), cursor: hoje.AddMonths(3));
        // Geradas pela regra velha (dia 20, fora do dia 5 da conta fixa).
        var erradaA = SeedTransacao(ctx, r, D(hoje.AddMonths(1).Year, hoje.AddMonths(1).Month, 20), StatusTransacao.Previsao);
        var erradaB = SeedTransacao(ctx, r, D(hoje.AddMonths(2).Year, hoje.AddMonths(2).Month, 20), StatusTransacao.Previsao);
        var svc = CreateService(ctx);

        var canceladas = await svc.RealinharAsync(hoje);
        await ctx.SaveChangesAsync(); // o realinhar não salva: o chamador (job) salva

        Assert.Equal(2, canceladas);
        var todas = await TodasAsync(ctx, r.Id);
        foreach (var id in new[] { erradaA.Id, erradaB.Id })
        {
            var t = todas.Single(x => x.Id == id);
            Assert.False(t.Ativo);
            Assert.Equal("Realinhada ao dia da conta fixa", t.MotivoCancelamento);
        }
        // Cursor volta pro dia certo do INÍCIO DO PERÍODO (dia 5 DESTE mês, mesmo que já tenha passado): o mês sem
        // cobrança viva ganha a sua (P1-1). Antes era "a partir de hoje" e o teste só passava no dia 5.
        Assert.Equal(D(hoje.Year, hoje.Month, 5), DateOnly.FromDateTime((await LinhaAsync(ctx, r.Id)).DataProximaGeracao!.Value));

        // 2ª passada: nada torto → nada muda.
        Assert.Equal(0, await svc.RealinharAsync(hoje));
        await ctx.SaveChangesAsync();
        Assert.Equal(todas.Count, (await TodasAsync(ctx, r.Id)).Count);
    }

    [Fact]
    public async Task RealinharAsync_ContaFixaNoCompasso_NaoMexeEmNada()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var cursor = hoje.AddMonths(3);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 5, inicio: hoje.AddMonths(-2), cursor: cursor);
        SeedTransacao(ctx, r, D(hoje.AddMonths(1).Year, hoje.AddMonths(1).Month, 5), StatusTransacao.Previsao);
        SeedTransacao(ctx, r, D(hoje.AddMonths(2).Year, hoje.AddMonths(2).Month, 5), StatusTransacao.Previsao);

        var canceladas = await CreateService(ctx).RealinharAsync(hoje);
        await ctx.SaveChangesAsync();

        Assert.Equal(0, canceladas);
        Assert.Equal(2, (await VivasAsync(ctx, r.Id)).Count);
        Assert.Equal(cursor, DateOnly.FromDateTime((await LinhaAsync(ctx, r.Id)).DataProximaGeracao!.Value));
    }

    [Fact]
    public async Task RealinharAsync_PrevisaoJaVencidaForaDoCompasso_NaoEhCancelada()
    {
        // Só as FUTURAS fora do dia são realinhadas; a que já venceu segue seu caminho (o job efetiva).
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var vencida = hoje.AddDays(-3);
        var dia = vencida.Day == 5 ? 6 : 5; // a vencida NUNCA cai no dia da conta fixa
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: dia, inicio: hoje.AddMonths(-3));
        SeedTransacao(ctx, r, vencida, StatusTransacao.Previsao);

        var canceladas = await CreateService(ctx).RealinharAsync(hoje);

        Assert.Equal(0, canceladas);
        Assert.True((await VivasAsync(ctx, r.Id)).Single().Ativo);
    }

    // ══ Cartão ════════════════════════════════════════════════════════════════

    private static async Task<List<(Fatura Fatura, decimal Total)>> FaturasComTotalAsync(AppDbContext ctx, Guid cartaoId)
    {
        ctx.ChangeTracker.Clear(); // lê do "banco", não do rastreador
        var faturas = await ctx.Faturas.AsNoTracking()
            .Include(f => f.Transacoes).Include(f => f.ParcelasTransacao)
            .Where(f => f.CartaoCreditoId == cartaoId)
            .OrderBy(f => f.DataFechamento)
            .ToListAsync();
        return faturas.Select(f => (f, RegrasFinanceiras.ValorTotalFatura(f))).ToList();
    }

    private static async Task<(Guid recorrenteId, Guid cartaoId)> CriarNoCartaoAsync(AppDbContext ctx, Guid u)
    {
        var cartao = SeedCartao(ctx, u);
        var dto = await CreateService(ctx).CriarAsync(new CriarRecorrenteDto
        {
            Descricao = "Streaming", Valor = 50m, Tipo = (int)TipoTransacao.Despesa, CartaoCreditoId = cartao,
            Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = 5,
            DataInicio = new DateTime(2030, 9, 28, 0, 0, 0, DateTimeKind.Utc),
        }, u);
        return (dto.Id, cartao);
    }

    [Fact]
    public async Task CriarAsync_NoCartao_PrevisoesEntramNaFaturaDoPeriodoComoCredito_ECompoemOTotal()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);

        var (recId, cartaoId) = await CriarNoCartaoAsync(ctx, u);

        var previsoes = await VivasAsync(ctx, recId);
        Assert.Equal(new[] { D(2030, 10, 5), D(2030, 11, 5), D(2030, 12, 5) }, previsoes.Select(t => t.Data).ToArray());
        Assert.All(previsoes, t =>
        {
            Assert.Equal(cartaoId, t.CartaoCreditoId);
            Assert.Null(t.ContaId);
            Assert.NotNull(t.FaturaId);
            Assert.True(t.UsadoComoCredito); // sem a flag a previsão ficava fora do total e do limite
        });
        var faturas = await FaturasComTotalAsync(ctx, cartaoId);
        Assert.Equal(3, faturas.Count);
        Assert.All(faturas, f => Assert.Equal(50m, f.Total)); // uma ocorrência por fatura, cobrada no total pagável
    }

    [Theory]
    [InlineData("pausar")]
    [InlineData("excluir")]
    [InlineData("cancelar")]
    public async Task Cartao_PausarExcluirCancelar_PrevisaoSaiDoTotalDaFatura_ENaoSobraTransacaoViva(string operacao)
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var (recId, cartaoId) = await CriarNoCartaoAsync(ctx, u);
        Assert.All(await FaturasComTotalAsync(ctx, cartaoId), f => Assert.Equal(50m, f.Total));
        var svc = CreateService(ctx);

        switch (operacao)
        {
            case "pausar": await svc.ToggleAtivoAsync(recId, u); break;
            case "excluir": await svc.DeletarAsync(recId, u); break;
            default: await svc.CancelarAsync(recId, new CancelarRecorrenteDto { Motivo = "Não uso mais" }, u); break;
        }

        var faturas = await FaturasComTotalAsync(ctx, cartaoId);
        Assert.Equal(3, faturas.Count);
        Assert.All(faturas, f =>
        {
            Assert.Equal(0m, f.Total);        // saiu do total pagável da fatura
            Assert.Empty(f.Fatura.Transacoes); // nenhuma transação viva sobrou nela
        });
        Assert.Empty(await VivasAsync(ctx, recId));
        Assert.Equal(3, (await TodasAsync(ctx, recId)).Count); // as 3 continuam como histórico cancelado
    }

    // Monta DIRETO o estado que interessa à reconciliação: fatura 'Fechada' (ou aberta) com compra à vista de 100
    // + previsão da conta fixa de 200 (total 300) e `valorPago` já pago.
    private static async Task<(AppDbContext Ctx, Guid U, Recorrente R, Fatura Fatura, Transacao Previsao)> CenarioFaturaAsync(
        decimal valorPago, bool fechada)
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var cartao = SeedCartao(ctx, u);
        var fatura = new Fatura
        {
            Id = Guid.NewGuid(), CartaoCreditoId = cartao, CriadoPor = u,
            DataInicio = Utc(hoje.AddDays(-50)), DataFechamento = Utc(hoje.AddDays(fechada ? -20 : 10)),
            DataVencimento = Utc(hoje.AddDays(fechada ? -10 : 20)),
            EstadoCiclo = fechada ? EstadoCicloFatura.Fechada : EstadoCicloFatura.Aberta,
            EstadoPagamento = EstadoPagamentoFatura.Parcial, ValorPago = valorPago, EstaAtrasada = true,
        };
        ctx.Faturas.Add(fatura);
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Mercado", Valor = 100m, Tipo = TipoTransacao.Despesa,
            CartaoCreditoId = cartao, FaturaId = fatura.Id, UsadoComoCredito = true,
            StatusTransacao = StatusTransacao.Executado, Ativo = true, CriadoPor = u, Data = hoje.AddDays(-30),
        });
        ctx.SaveChanges();
        var r = SeedRecorrente(ctx, u, null, 15, hoje.AddMonths(-4), cartaoId: cartao, valor: 200m);
        var previsao = SeedTransacao(ctx, r, hoje.AddDays(-25), StatusTransacao.Previsao, faturaId: fatura.Id);
        return (ctx, u, r, fatura, previsao);
    }

    [Theory]
    [InlineData("pausar")]
    [InlineData("excluir")]
    [InlineData("cancelar")]
    public async Task Cartao_FaturaFechadaParcialmentePaga_AoTirarAPrevisao_FicaCobertaEViraPago(string operacao)
    {
        // Total 300, pago 100. A previsão (200) sai → total 100 = pago → restante 0: sem reconciliar a fatura
        // ficava Parcial pra sempre, "vencida", cobrando juros de fatura coberta (regra de dinheiro do CLAUDE.md).
        var (ctx, u, r, fatura, previsao) = await CenarioFaturaAsync(valorPago: 100m, fechada: true);
        var svc = CreateService(ctx);

        switch (operacao)
        {
            case "pausar": await svc.ToggleAtivoAsync(r.Id, u); break;
            case "excluir": await svc.DeletarAsync(r.Id, u); break;
            default: await svc.CancelarAsync(r.Id, new CancelarRecorrenteDto { Motivo = "Não uso mais" }, u); break;
        }

        var f = await ctx.Faturas.AsNoTracking().SingleAsync(x => x.Id == fatura.Id);
        Assert.Equal(EstadoPagamentoFatura.Pago, f.EstadoPagamento);
        Assert.False(f.EstaAtrasada);
        Assert.NotNull(f.DataPagamentoTotal);
        Assert.Equal(100m, f.ValorPago); // nenhum dinheiro novo
        Assert.False((await TodasAsync(ctx, r.Id)).Single(t => t.Id == previsao.Id).Ativo);
        var quitacao = Assert.Single(await EventosAsync(ctx, fatura.Id));
        Assert.Equal(FinancialEventType.FaturaPagaTotal, quitacao.Tipo);
    }

    [Fact]
    public async Task Cartao_FaturaAindaComRestanteDepoisDeTirarAPrevisao_NaoMudaDeEstado()
    {
        // Total 300, pago 50: sem a previsão o total é 100 e ainda restam 50 → continua Parcial e atrasada.
        var (ctx, u, r, fatura, _) = await CenarioFaturaAsync(valorPago: 50m, fechada: true);

        await CreateService(ctx).ToggleAtivoAsync(r.Id, u);

        var f = await ctx.Faturas.AsNoTracking().SingleAsync(x => x.Id == fatura.Id);
        Assert.Equal(EstadoPagamentoFatura.Parcial, f.EstadoPagamento);
        Assert.True(f.EstaAtrasada);
        Assert.Empty(await EventosAsync(ctx, fatura.Id));
    }

    [Fact]
    public async Task Cartao_FaturaAbertaCobertaDepoisDeTirarAPrevisao_FicaParcial_MasSaiDoAtraso()
    {
        // Ciclo aberto não vira Pago (travaria a próxima compra do ciclo) — só sai do atraso.
        var (ctx, u, r, fatura, _) = await CenarioFaturaAsync(valorPago: 100m, fechada: false);

        await CreateService(ctx).DeletarAsync(r.Id, u);

        var f = await ctx.Faturas.AsNoTracking().SingleAsync(x => x.Id == fatura.Id);
        Assert.Equal(EstadoPagamentoFatura.Parcial, f.EstadoPagamento);
        Assert.False(f.EstaAtrasada);
        Assert.Null(f.DataPagamentoTotal);
    }

    // ══ Próxima cobrança e stats ══════════════════════════════════════════════

    [Fact]
    public async Task ListarAsync_ProximaCobranca_EhAProximaPrevisaoPendente_NaoOCursorNemOQueNaoCobra()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), 15, hoje.AddMonths(-3), cursor: hoje.AddDays(200));
        SeedTransacao(ctx, r, hoje.AddDays(10), StatusTransacao.Previsao);                // a próxima de verdade
        SeedTransacao(ctx, r, hoje.AddDays(40), StatusTransacao.Previsao);
        SeedTransacao(ctx, r, hoje.AddDays(3), StatusTransacao.Previsao, ativo: false);   // cancelada não conta
        SeedTransacao(ctx, r, hoje.AddDays(-2), StatusTransacao.Previsao);                // já passou
        SeedTransacao(ctx, r, hoje.AddDays(1), StatusTransacao.Executado);                // não é previsão

        var item = (await CreateService(ctx).ListarAsync(u)).Items.Single();

        Assert.Equal(hoje.AddDays(10), item.ProximaCobranca);
        Assert.Equal(hoje.AddDays(200), DateOnly.FromDateTime(item.DataProximaGeracao!.Value)); // o cursor segue separado
    }

    [Fact]
    public async Task ListarAsync_ProximaCobranca_PrevisaoDeHojeContaComoProxima()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), 15, hoje.AddMonths(-3));
        SeedTransacao(ctx, r, hoje, StatusTransacao.Previsao);
        SeedTransacao(ctx, r, hoje.AddDays(30), StatusTransacao.Previsao);

        var item = (await CreateService(ctx).ListarAsync(u)).Items.Single();

        Assert.Equal(hoje, item.ProximaCobranca);
    }

    [Fact]
    public async Task ListarAsync_ProximaCobranca_NullQuandoPausadaCanceladaOuSemPrevisao()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var conta = SeedConta(ctx, u);
        // Dado legado: pausada/cancelada que AINDA tem previsão viva → mesmo assim a tela não mostra cobrança.
        var pausada = SeedRecorrente(ctx, u, conta, 15, hoje.AddMonths(-3), ativo: false);
        pausada.Descricao = "Pausada";
        var cancelada = SeedRecorrente(ctx, u, conta, 15, hoje.AddMonths(-3), ativo: false);
        cancelada.Descricao = "Cancelada";
        cancelada.CanceladoEm = DateTime.UtcNow;
        var canceladaComAtivoLegado = SeedRecorrente(ctx, u, conta, 15, hoje.AddMonths(-3));
        canceladaComAtivoLegado.Descricao = "CanceladaLegado";
        canceladaComAtivoLegado.CanceladoEm = DateTime.UtcNow;
        var semPrevisao = SeedRecorrente(ctx, u, conta, 15, hoje.AddMonths(-3));
        semPrevisao.Descricao = "SemPrevisao";
        ctx.SaveChanges();
        foreach (var r in new[] { pausada, cancelada, canceladaComAtivoLegado })
            SeedTransacao(ctx, r, hoje.AddDays(7), StatusTransacao.Previsao);

        var itens = (await CreateService(ctx).ListarAsync(u)).Items.ToList();

        Assert.Equal(4, itens.Count);
        Assert.All(itens, i => Assert.Null(i.ProximaCobranca));
    }

    [Fact]
    public async Task ObterStatsAsync_Proximas30Dias_ContaContaFixaAtivaComPrevisaoPendenteNaJanela()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var hoje = Hoje;
        var conta = SeedConta(ctx, u);
        Recorrente Nova(bool ativo = true) => SeedRecorrente(ctx, u, conta, 15, hoje.AddMonths(-3), ativo: ativo, cursor: hoje.AddDays(5));

        var noLimite = Nova();          // previsão em hoje+30 (inclusive) → conta
        SeedTransacao(ctx, noLimite, hoje.AddDays(30), StatusTransacao.Previsao);
        var duasNaJanela = Nova();      // duas previsões na janela → conta UMA vez
        SeedTransacao(ctx, duasNaJanela, hoje.AddDays(3), StatusTransacao.Previsao);
        SeedTransacao(ctx, duasNaJanela, hoje.AddDays(20), StatusTransacao.Previsao);
        var foraDaJanela = Nova();      // hoje+31
        SeedTransacao(ctx, foraDaJanela, hoje.AddDays(31), StatusTransacao.Previsao);
        var jaPassou = Nova();          // ontem
        SeedTransacao(ctx, jaPassou, hoje.AddDays(-1), StatusTransacao.Previsao);
        var pausada = Nova(ativo: false); // pausada não cobra
        SeedTransacao(ctx, pausada, hoje.AddDays(5), StatusTransacao.Previsao);
        var soCancelada = Nova();       // previsão cancelada não conta
        SeedTransacao(ctx, soCancelada, hoje.AddDays(5), StatusTransacao.Previsao, ativo: false);
        var soExecutada = Nova();       // efetivada não é "próxima cobrança"
        SeedTransacao(ctx, soExecutada, hoje.AddDays(5), StatusTransacao.Executado);
        Nova();                         // só o cursor dentro dos 30 dias, sem previsão → NÃO conta (o cursor não é cobrança)

        var stats = await CreateService(ctx).ObterStatsAsync(u);

        Assert.Equal(2, stats.Proximas30Dias);
    }

    // ══ Isolamento entre usuários ═════════════════════════════════════════════

    [Theory]
    [InlineData("pausar")]
    [InlineData("retomar")]
    [InlineData("excluir")]
    public async Task OutroUsuario_PausarRetomarExcluir_LancaForbidden_ENadaMuda(string operacao)
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx);
        var intruso = SeedUsuario(ctx);
        var hoje = Hoje;
        var r = SeedRecorrente(ctx, dono, SeedConta(ctx, dono), 15, hoje.AddMonths(-2), ativo: operacao != "retomar");
        if (operacao != "retomar")
            SeedTransacao(ctx, r, hoje.AddDays(10), StatusTransacao.Previsao);
        var svc = CreateService(ctx);
        var transacoesAntes = (await TodasAsync(ctx, r.Id)).Select(t => (t.Id, t.Ativo, t.Data, t.StatusTransacao)).ToList();

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            operacao == "excluir" ? svc.DeletarAsync(r.Id, intruso) : svc.ToggleAtivoAsync(r.Id, intruso));

        var linha = await LinhaAsync(ctx, r.Id);
        Assert.Equal(operacao != "retomar", linha.Ativo);
        Assert.Null(linha.ExcluidoEm);
        Assert.Null(linha.CanceladoEm);
        Assert.Equal(transacoesAntes, (await TodasAsync(ctx, r.Id)).Select(t => (t.Id, t.Ativo, t.Data, t.StatusTransacao)).ToList());
        Assert.Empty(await ctx.FinancialEventLogs.AsNoTracking().ToListAsync()); // nem audit log do ato recusado
        // E o dono segue vendo a conta fixa dele.
        Assert.Equal(1, (await svc.ListarAsync(dono)).Total);
        Assert.Equal(0, (await svc.ListarAsync(intruso)).Total);
    }

    // ══ Faixa do período e teto do gerador (P1-3: DoS) ════════════════════════

    [Fact]
    public async Task CriarAsync_InicioNoAnoUm_Recusa_SemGerarNada()
    {
        // O ataque: semanal desde 0001-01-01 fazia o GET da lista gerar ~105 mil lançamentos numa requisição.
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var conta = SeedConta(ctx, u);

        await Assert.ThrowsAsync<ArgumentException>(() => CreateService(ctx).CriarAsync(new CriarRecorrenteDto
        {
            Descricao = "Ataque", Valor = 1m, Tipo = (int)TipoTransacao.Despesa, ContaId = conta,
            Frequencia = (int)FrequenciaRecorrencia.Semanal, Dia = 1,
            DataInicio = new DateTime(1, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        }, u));

        Assert.Empty(await ctx.Recorrentes.IgnoreQueryFilters().ToListAsync());
        Assert.Empty(await ctx.Transacoes.IgnoreQueryFilters().ToListAsync());
    }

    [Fact]
    public async Task CriarAsync_FimAntesDoInicio_Recusa()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var conta = SeedConta(ctx, u);

        await Assert.ThrowsAsync<ArgumentException>(() => CreateService(ctx).CriarAsync(new CriarRecorrenteDto
        {
            Descricao = "Aluguel", Valor = 1500m, Tipo = (int)TipoTransacao.Despesa, ContaId = conta,
            Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = 5,
            DataInicio = Utc(Hoje), DataFim = Utc(Hoje.AddDays(-1)),
        }, u));

        Assert.Empty(await ctx.Recorrentes.IgnoreQueryFilters().ToListAsync());
    }

    [Fact]
    public async Task AtualizarAsync_FimAntesDoInicio_Recusa_SemMexerNaLinha()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 5, inicio: Hoje);
        var dto = Dto(r);
        dto.DataFim = Utc(Hoje.AddDays(-1));
        dto.Descricao = "Mudou";

        await Assert.ThrowsAsync<ArgumentException>(() => CreateService(ctx).AtualizarAsync(r.Id, dto, u));

        var linha = await ctx.Recorrentes.AsNoTracking().SingleAsync(x => x.Id == r.Id);
        Assert.Equal("Aluguel", linha.Descricao);
        Assert.Null(linha.DataFim);
    }

    [Fact]
    public async Task GerarOcorrenciasAsync_DadoAntigoSemFaixa_ParaNoTeto_ECursorContinuaDeOndeParou()
    {
        // Linha de antes da validação (início no ano 1, semanal): cada chamada percorre no máximo o teto.
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 1, inicio: D(1, 1, 1), freq: FrequenciaRecorrencia.Semanal);
        var svc = CreateService(ctx);

        var criadas = await svc.GerarOcorrenciasAsync(r, Hoje, StatusTransacao.Executado);

        Assert.Equal(AgendaRecorrente.MaxDatasPorGeracao, criadas);
        var ultima = ctx.Transacoes.Local.Max(t => t.Data);
        Assert.Equal(ultima.AddDays(7), DateOnly.FromDateTime(r.DataProximaGeracao!.Value)); // continua na seguinte

        var maisUmLote = await svc.GerarOcorrenciasAsync(r, Hoje, StatusTransacao.Executado);
        Assert.Equal(AgendaRecorrente.MaxDatasPorGeracao, maisUmLote);
        Assert.Equal(2 * AgendaRecorrente.MaxDatasPorGeracao, ctx.Transacoes.Local.Select(t => t.Data).Distinct().Count());
    }

    // ══ Competência: período já cobrado não repete, período sem cobrança não some (P1-1) ══════════════════

    private static DateOnly PrimeiroDoMes(DateOnly d) => D(d.Year, d.Month, 1);
    private static DateOnly UltimoDoMes(DateOnly d) => D(d.Year, d.Month, DateTime.DaysInMonth(d.Year, d.Month));
    private static string Mes(DateOnly d) => $"M{d.Year:D4}-{d.Month:D2}";

    private static async Task<List<Transacao>> VivasNoMesAsync(AppDbContext ctx, Guid recorrenteId, DateOnly mes) =>
        (await VivasAsync(ctx, recorrenteId)).Where(t => t.Data.Year == mes.Year && t.Data.Month == mes.Month).ToList();

    [Fact]
    public async Task AtualizarAsync_TrocarODia_ComOMesJaCobrado_NaoCobraOMesDeNovo()
    {
        // O caso da revisão: Dia 5→20 com o dia 5 já efetivado gerava o dia 20 (o mês 2×). Aqui: dia 1 efetivado
        // (sem competência — dado de antes da coluna, conta pela data) e troca pro 28.
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var mes = PrimeiroDoMes(Hoje);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 1, inicio: mes.AddMonths(-2));
        var efetivada = SeedTransacao(ctx, r, mes, StatusTransacao.Executado);

        await CreateService(ctx).AtualizarAsync(r.Id, Dto(r, dia: 28), u);

        var noMes = await VivasNoMesAsync(ctx, r.Id, mes);
        Assert.Equal(efetivada.Id, Assert.Single(noMes).Id); // só a que já foi cobrada
        var previstas = (await VivasAsync(ctx, r.Id)).Where(t => t.StatusTransacao == StatusTransacao.Previsao).ToList();
        Assert.Equal(DatasMensais(mes.AddMonths(1), D(Hoje.Year, 12, 31), 28), previstas.Select(t => t.Data).ToList());
        Assert.All(previstas, t => Assert.Equal(Mes(t.Data), t.Competencia)); // ocorrência nova sai com a competência
    }

    [Fact]
    public async Task AtualizarAsync_TrocarProDiaQueJaPassou_SemOMesCobrado_NaoPerdeOMes()
    {
        // O outro lado: Dia 20→5 no dia 10 cancelava o 20 e o cursor ia pro 5 do mês QUE VEM (o mês sumia).
        // Aqui: previsão no último dia do mês (Dia 31) e troca pro dia 1 — que já chegou.
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var mes = PrimeiroDoMes(Hoje);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 31, inicio: mes.AddMonths(-2));
        SeedTransacao(ctx, r, UltimoDoMes(mes.AddMonths(-1)), StatusTransacao.Executado); // mês passado, cobrado
        var antiga = SeedTransacao(ctx, r, UltimoDoMes(mes), StatusTransacao.Previsao);

        await CreateService(ctx).AtualizarAsync(r.Id, Dto(r, dia: 1), u);

        var cobranca = Assert.Single(await VivasNoMesAsync(ctx, r.Id, mes));
        Assert.Equal(mes, cobranca.Data);                                   // dia 1 deste mês…
        // …que já passou: lança como efetivado (se hoje É o dia 1, fica prevista e o job efetiva).
        Assert.Equal(mes < Hoje ? StatusTransacao.Executado : StatusTransacao.Previsao, cobranca.StatusTransacao);
        Assert.Equal(Mes(mes), cobranca.Competencia);
        Assert.False((await TodasAsync(ctx, r.Id)).Single(t => t.Id == antiga.Id).Ativo);
        Assert.Single(await VivasNoMesAsync(ctx, r.Id, mes.AddMonths(-1))); // o mês passado não é mexido
    }

    [Fact]
    public async Task RealinharAsync_DadoLegadoCobradoNoDiaErrado_NaoCobraOMesDeNovo()
    {
        // Motor antigo cobrava no dia do início: Dia 28 já efetivada no dia 1 deste mês + previsão futura no dia 1
        // do mês que vem. Realinhar + expandir (o job das 03:00) gerava o 28 deste mês: o mês 2×.
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var mes = PrimeiroDoMes(Hoje);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 28, inicio: mes.AddMonths(-3));
        var efetivada = SeedTransacao(ctx, r, mes, StatusTransacao.Executado);
        SeedTransacao(ctx, r, mes.AddMonths(1), StatusTransacao.Previsao);
        var svc = CreateService(ctx);

        await svc.RealinharAsync(Hoje);
        await svc.GerarOcorrenciasAsync(r, AgendaRecorrente.HorizonteExpansao(Hoje), StatusTransacao.Previsao);
        await ctx.SaveChangesAsync();

        Assert.Equal(efetivada.Id, Assert.Single(await VivasNoMesAsync(ctx, r.Id, mes)).Id);
        Assert.Equal(DatasMensais(mes.AddMonths(1), D(Hoje.Year, 12, 31), 28), await DatasPrevistasVivasAsync(ctx, r.Id));
    }

    [Fact]
    public async Task RealinharAsync_MesSemCobrancaViva_GanhaASuaNoDiaCerto_MesmoJaPassado()
    {
        // Dia 1 com a previsão legada no último dia deste mês (fora do compasso): cancelada no realinhamento, o
        // mês ficaria sem cobrança. Agora recomeça do início do período → previsão no dia 1 (o job efetiva).
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var mes = PrimeiroDoMes(Hoje);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 1, inicio: mes.AddMonths(-3));
        SeedTransacao(ctx, r, UltimoDoMes(mes), StatusTransacao.Previsao);
        var svc = CreateService(ctx);

        await svc.RealinharAsync(Hoje);
        await svc.GerarOcorrenciasAsync(r, AgendaRecorrente.HorizonteExpansao(Hoje), StatusTransacao.Previsao);
        await ctx.SaveChangesAsync();

        var cobranca = Assert.Single(await VivasNoMesAsync(ctx, r.Id, mes));
        Assert.Equal(mes, cobranca.Data);
        Assert.Equal(Mes(mes), cobranca.Competencia);
    }

    // ══ Pausar/retomar pelo estado pedido (P1-2: duplo clique) ═════════════════════════════════════════

    [Fact]
    public async Task ToggleAtivoAsync_RetomarDuasVezes_NaoDesfazNemDuplica()
    {
        // Antes era só "inverte": o 2º clique em Retomar pausava de novo (ou, simultâneo, gerava 2×).
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 15, inicio: PrimeiroDoMes(Hoje).AddMonths(-1), ativo: false);
        var svc = CreateService(ctx);

        await svc.ToggleAtivoAsync(r.Id, u, ativo: true);
        var depoisDoPrimeiro = await DatasPrevistasVivasAsync(ctx, r.Id);
        await svc.ToggleAtivoAsync(r.Id, u, ativo: true);

        Assert.True((await LinhaAsync(ctx, r.Id)).Ativo);
        Assert.Equal(depoisDoPrimeiro, await DatasPrevistasVivasAsync(ctx, r.Id));
        Assert.Single(await EventosAsync(ctx, r.Id), e => e.Tipo == FinancialEventType.RecorrenteRetomada);
    }

    [Fact]
    public async Task ToggleAtivoAsync_PausarJaPausada_NaoFazNada()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 15, inicio: PrimeiroDoMes(Hoje), ativo: false);

        await CreateService(ctx).ToggleAtivoAsync(r.Id, u, ativo: false);

        Assert.False((await LinhaAsync(ctx, r.Id)).Ativo);
        Assert.Empty(await EventosAsync(ctx, r.Id));
    }

    // ══ P2 da revisão: desempenho, conserto único, preservar o que o usuário fez ══════════════════════════

    private static Recorrente Realinhada(AppDbContext ctx, Recorrente r)
    {
        r.RealinhadoEm = DateTime.UtcNow;
        ctx.SaveChanges();
        return r;
    }

    [Fact]
    public async Task GerarOcorrenciasAsync_EmDia_NaoGeraNada_ESoNormalizaOCursor()
    {
        // P2-1: conta fixa já gerada até o limite volta antes de ir ao banco (caso de quase toda no GET e no job).
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 5, inicio: D(2030, 1, 5), cursor: D(2031, 1, 3));

        var criadas = await CreateService(ctx).GerarOcorrenciasAsync(r, D(2031, 1, 1), StatusTransacao.Previsao);

        Assert.Equal(0, criadas);
        Assert.Empty(ctx.Transacoes.Local);
        Assert.Equal(D(2031, 1, 5), DateOnly.FromDateTime(r.DataProximaGeracao!.Value)); // cursor no compasso do Dia
    }

    [Fact]
    public async Task CriarAsync_NasceComOConsertoUnicoFeito_NaoEntraNoRealinhamento()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var conta = SeedConta(ctx, u);
        var svc = CreateService(ctx);

        var dto = await svc.CriarAsync(new CriarRecorrenteDto
        {
            Descricao = "Aluguel", Valor = 1500m, Tipo = (int)TipoTransacao.Despesa, ContaId = conta,
            Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = 5, DataInicio = Utc(Hoje),
        }, u);

        Assert.NotNull((await LinhaAsync(ctx, dto.Id)).RealinhadoEm);
        Assert.Empty(await svc.IdsParaRealinharAsync());
    }

    [Fact]
    public async Task RealinharAsync_ConsertoDeLegadoEhUnico_DepoisNaoMexeMais()
    {
        // P2-2: antes realinhava (e carregava todas as previsões de todos) TODO dia; agora uma vez por conta fixa.
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var mes = PrimeiroDoMes(Hoje);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 28, inicio: mes.AddMonths(-3));
        var legado = SeedTransacao(ctx, r, mes.AddMonths(1), StatusTransacao.Previsao); // dia 1: fora do Dia 28
        var svc = CreateService(ctx);

        Assert.Equal(new[] { r.Id }, await svc.IdsParaRealinharAsync());
        Assert.Equal(1, await svc.RealinharAsync(Hoje));
        await ctx.SaveChangesAsync();
        Assert.False((await TodasAsync(ctx, r.Id)).Single(t => t.Id == legado.Id).Ativo);
        Assert.NotNull((await LinhaAsync(ctx, r.Id)).RealinhadoEm);

        // Outra fora do dia aparecendo depois: o conserto não roda de novo.
        var depois = SeedTransacao(ctx, r, mes.AddMonths(2), StatusTransacao.Previsao);
        Assert.Empty(await svc.IdsParaRealinharAsync());
        Assert.Equal(0, await svc.RealinharAsync(Hoje));
        Assert.True((await TodasAsync(ctx, r.Id)).Single(t => t.Id == depois.Id).Ativo);
    }

    [Fact]
    public async Task IdsParaRealinharAsync_SoQuemPrecisa_PausadaComPrevisao_Orfa_ESemConserto()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var conta = SeedConta(ctx, u);
        var mes = PrimeiroDoMes(Hoje);
        var emDia = Realinhada(ctx, SeedRecorrente(ctx, u, conta, dia: 1, inicio: mes));
        SeedTransacao(ctx, emDia, mes.AddMonths(1), StatusTransacao.Previsao);
        var pausada = Realinhada(ctx, SeedRecorrente(ctx, u, conta, dia: 1, inicio: mes, ativo: false));
        SeedTransacao(ctx, pausada, mes.AddMonths(1), StatusTransacao.Previsao);
        var semConserto = SeedRecorrente(ctx, u, conta, dia: 1, inicio: mes);
        var orfa = SeedTransacao(ctx, emDia, mes.AddMonths(2), StatusTransacao.Previsao);
        orfa.RecorrenteOrigemId = Guid.NewGuid(); // conta fixa apagada antes da exclusão lógica
        ctx.SaveChanges();

        var ids = await CreateService(ctx).IdsParaRealinharAsync();

        Assert.Equal(
            new[] { pausada.Id, semConserto.Id, orfa.RecorrenteOrigemId!.Value }.OrderBy(x => x),
            ids.OrderBy(x => x));
    }

    [Fact]
    public async Task EditarProxima_DepoisAlterarAContaFixa_AEdicaoDoUsuarioFica()
    {
        // P2-4: alterar a conta fixa regerava por cima da previsão que o usuário tinha editado.
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var mes = PrimeiroDoMes(Hoje);
        var seguinte = mes.AddMonths(1);
        var r = Realinhada(ctx, SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 28, inicio: mes.AddMonths(-1),
            cursor: mes.AddMonths(2)));
        SeedTransacao(ctx, r, mes, StatusTransacao.Executado);                       // este mês: cobrado
        var proxima = SeedTransacao(ctx, r, D(seguinte.Year, seguinte.Month, 28), StatusTransacao.Previsao);
        var svc = CreateService(ctx);

        await svc.EditarProximaOcorrenciaAsync(r.Id, new EditarProximaOcorrenciaDto { Valor = 50m }, u);
        await svc.AtualizarAsync(r.Id, Dto(r, valor: 999m), u);

        var editada = Assert.Single(await VivasNoMesAsync(ctx, r.Id, seguinte)); // nem cancelada, nem duplicada
        Assert.Equal(proxima.Id, editada.Id);
        Assert.Equal(50m, editada.Valor);
        Assert.True(editada.EditadaPeloUsuario);
        Assert.All((await VivasAsync(ctx, r.Id)).Where(t => t.Data > editada.Data), t => Assert.Equal(999m, t.Valor));
    }

    [Fact]
    public async Task MesQueOUsuarioExcluiu_NaoVoltaAoAlterarNemAoRetomar()
    {
        // P2-4: excluir a ocorrência de um mês (pular o mês) e depois alterar/retomar ressuscitava o mês.
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var mes = PrimeiroDoMes(Hoje);
        var seguinte = mes.AddMonths(1);
        var r = Realinhada(ctx, SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 28, inicio: mes.AddMonths(-1),
            cursor: mes.AddMonths(2)));
        SeedTransacao(ctx, r, mes, StatusTransacao.Executado);
        var pulada = SeedTransacao(ctx, r, D(seguinte.Year, seguinte.Month, 28), StatusTransacao.Previsao);
        var svc = CreateService(ctx);

        Assert.True(await new TransacaoService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx)).DeletarAsync(pulada.Id, u));
        ctx.ChangeTracker.Clear(); // cada passo é uma requisição: a excluída tem que vir do BANCO, não da memória
        await svc.AtualizarAsync(r.Id, Dto(r, dia: 15), u);
        Assert.Empty(await VivasNoMesAsync(ctx, r.Id, seguinte));

        ctx.ChangeTracker.Clear();
        await svc.ToggleAtivoAsync(r.Id, u, ativo: false);
        ctx.ChangeTracker.Clear();
        await svc.ToggleAtivoAsync(r.Id, u, ativo: true);
        Assert.Empty(await VivasNoMesAsync(ctx, r.Id, seguinte));
    }

    [Fact]
    public async Task RealinharAsync_PrevisaoForaDoDiaQueOUsuarioEditou_Fica()
    {
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var mes = PrimeiroDoMes(Hoje);
        var r = SeedRecorrente(ctx, u, SeedConta(ctx, u), dia: 28, inicio: mes.AddMonths(-3));
        var movida = SeedTransacao(ctx, r, mes.AddMonths(1), StatusTransacao.Previsao); // dia 1, movida à mão
        movida.EditadaPeloUsuario = true;
        ctx.SaveChanges();

        await CreateService(ctx).RealinharAsync(Hoje);
        await ctx.SaveChangesAsync();

        Assert.True((await TodasAsync(ctx, r.Id)).Single(t => t.Id == movida.Id).Ativo);
        Assert.NotNull((await LinhaAsync(ctx, r.Id)).RealinhadoEm);
    }

    [Fact]
    public async Task CriarAsync_InicioNoPassado_OQueJaVenceuNasceEfetivado_AdeHojeEmDiantePrevista()
    {
        // Validação da conta pessoal (2026-10-20): "Aluguel desde agosto" criado em outubro nascia com agosto,
        // setembro e outubro PREVISTOS: o saldo ficava errado até o job diário rodar. Igual à edição e ao
        // GerarPendentes: o que já venceu entra efetivado; a de hoje fica prevista (o job efetiva).
        var ctx = CreateContext();
        var u = SeedUsuario(ctx);
        var conta = SeedConta(ctx, u);
        var inicio = new DateOnly(Hoje.Year, Hoje.Month, 1).AddMonths(-2);

        var dto = await CreateService(ctx).CriarAsync(new CriarRecorrenteDto
        {
            Descricao = "Aluguel", Valor = 1800m, Tipo = (int)TipoTransacao.Despesa, ContaId = conta,
            Frequencia = (int)FrequenciaRecorrencia.Mensal, Dia = 1, DataInicio = Utc(inicio),
        }, u);

        var vivas = await VivasAsync(ctx, dto.Id);
        Assert.Equal(3, vivas.Count);
        Assert.All(vivas, t => Assert.Equal(t.Data < Hoje ? StatusTransacao.Executado : StatusTransacao.Previsao, t.StatusTransacao));
        Assert.Contains(vivas, t => t.StatusTransacao == StatusTransacao.Executado);
    }
}
