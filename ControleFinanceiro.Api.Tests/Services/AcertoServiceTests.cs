using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class AcertoServiceTests
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

    private static AcertoService NewSvc(AppDbContext ctx) =>
        new(ctx, TestHelpers.Notif(ctx), TestHelpers.EventLog(ctx));

    /// <summary>RegistrarAcertoDto com idempotencyKey aleatório (override quando o teste precisa fixá-lo).</summary>
    private static RegistrarAcertoDto Dto(
        Guid de, Guid para, decimal valor,
        int? mes = null, int? ano = null, string? obs = null, string? key = null) =>
        new(de, para, valor, mes, ano, obs, key ?? Guid.NewGuid().ToString());

    private static Guid SeedUsuario(AppDbContext ctx, string email, string nome = "User")
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = email, Nome = nome, PasswordHash = "x" };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u.Id;
    }

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

    private static Guid SeedDespesa(AppDbContext ctx, Guid criadoPor, decimal valor, Guid familiaId)
    {
        var t = new Transacao
        {
            Id = Guid.NewGuid(), Descricao = "Despesa", Valor = valor,
            Tipo = TipoTransacao.Despesa, CriadoPor = criadoPor,
            Data = new DateOnly(2026, 5, 10), Ativo = true,
            StatusTransacao = StatusTransacao.Executado, FamiliaId = familiaId,
        };
        ctx.Transacoes.Add(t);
        ctx.SaveChanges();
        return t.Id;
    }

    [Fact]
    public async Task RegistrarAsync_NaoMembro_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = NewSvc(ctx);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.RegistrarAsync(familiaId, Guid.NewGuid(), Dto(dono, dono, 100m)));
    }

    [Fact]
    public async Task RegistrarAsync_SemIdempotencyKey_LancaInvalidOperation()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        var svc = NewSvc(ctx);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.RegistrarAsync(familiaId, ana,
                new RegistrarAcertoDto(ana, bia, 100m, null, null, null, "  ")));
    }

    [Fact]
    public async Task RegistrarAsync_MesmoPagadorRecebedor_LancaArgument()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = NewSvc(ctx);

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.RegistrarAsync(familiaId, dono, Dto(dono, dono, 100m)));
    }

    [Fact]
    public async Task RegistrarAsync_ValorZero_LancaArgument()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        var svc = NewSvc(ctx);

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.RegistrarAsync(familiaId, ana, Dto(ana, bia, 0m)));
    }

    [Fact]
    public async Task RegistrarAsync_RecebedorNaoMembro_LancaArgument()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var estranho = SeedUsuario(ctx, "estranho@test.com", "Estranho");
        var familiaId = await SeedFamilia(ctx, ana);
        var svc = NewSvc(ctx);

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.RegistrarAsync(familiaId, ana, Dto(ana, estranho, 100m)));
    }

    [Fact]
    public async Task RegistrarAsync_Valido_PersisteComMesAnoCorrente()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        var svc = NewSvc(ctx);

        var dto = await svc.RegistrarAsync(familiaId, ana, Dto(ana, bia, 150m, obs: "PIX"));

        Assert.Equal(150m, dto.Valor);
        Assert.Equal("Ana", dto.DeNome);
        Assert.Equal("Bia", dto.ParaNome);
        // O mês do acerto é o de Brasília (HorarioBrasil): com o relógio UTC, das 21h à meia-noite do último dia o teste errava.
        Assert.Equal(HorarioBrasil.Agora().Month, dto.Mes);
        Assert.Equal(HorarioBrasil.Agora().Year, dto.Ano);
    }

    [Fact]
    public async Task RegistrarAsync_MesmaIdempotencyKey_NaoDuplica()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        var svc = NewSvc(ctx);

        var key = Guid.NewGuid().ToString();
        var primeiro = await svc.RegistrarAsync(familiaId, ana, Dto(ana, bia, 80m, key: key));
        var replay = await svc.RegistrarAsync(familiaId, ana, Dto(ana, bia, 80m, key: key));

        Assert.Equal(primeiro.Id, replay.Id); // retry retorna o mesmo acerto
        Assert.Single(await ctx.AcertosContas.ToListAsync()); // não duplicou
    }

    [Fact]
    public async Task RegistrarAsync_GravaFinancialEventLog()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        var svc = NewSvc(ctx);

        var acerto = await svc.RegistrarAsync(familiaId, ana, Dto(ana, bia, 120m));

        var log = await ctx.FinancialEventLogs
            .SingleAsync(e => e.Tipo == FinancialEventType.AcertoRegistrado);
        Assert.Equal("AcertoContas", log.EntidadeAfetada);
        Assert.Equal(acerto.Id, log.EntidadeId);
        Assert.Equal(120m, log.ValorDepois);
    }

    [Fact]
    public async Task ListarAsync_FiltraPorMesAno_ESomenteAtivos()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        var svc = NewSvc(ctx);

        await svc.RegistrarAsync(familiaId, ana, Dto(ana, bia, 10m, 5, 2026));
        await svc.RegistrarAsync(familiaId, ana, Dto(ana, bia, 20m, 4, 2026));

        var maio = await svc.ListarAsync(familiaId, ana, 5, 2026);

        Assert.Single(maio);
        Assert.Equal(10m, maio[0].Valor);
    }

    [Fact]
    public async Task CancelarAsync_SoftDelete_RemoveDaListagem()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        var svc = NewSvc(ctx);

        var acerto = await svc.RegistrarAsync(familiaId, ana, Dto(ana, bia, 10m, 5, 2026));

        await svc.CancelarAsync(familiaId, acerto.Id, ana);

        Assert.Empty(await svc.ListarAsync(familiaId, ana, 5, 2026));
        var registro = await ctx.AcertosContas.FindAsync(acerto.Id);
        Assert.NotNull(registro);
        Assert.False(registro!.Ativo);
    }

    [Fact]
    public async Task CancelarAsync_PorTerceiro_LancaForbidden()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");   // dono + criador do acerto
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");   // pagador
        var caio = SeedUsuario(ctx, "caio@test.com", "Caio"); // terceiro, não envolvido
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        AddMembro(ctx, familiaId, caio);
        var svc = NewSvc(ctx);

        // Ana registra: Bia pagou Ana. Partes: Bia/Ana. Criador: Ana.
        var acerto = await svc.RegistrarAsync(familiaId, ana, Dto(bia, ana, 50m));

        // Caio (membro, mas não criador nem parte) não pode cancelar.
        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.CancelarAsync(familiaId, acerto.Id, caio));

        var registro = await ctx.AcertosContas.FindAsync(acerto.Id);
        Assert.True(registro!.Ativo); // não foi cancelado
    }

    [Fact]
    public async Task CancelarAsync_PorParticipante_Funciona()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");   // criador
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");   // pagador (parte)
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        var svc = NewSvc(ctx);

        var acerto = await svc.RegistrarAsync(familiaId, ana, Dto(bia, ana, 50m));

        // Bia é parte (pagador), mesmo não sendo a criadora → pode cancelar.
        await svc.CancelarAsync(familiaId, acerto.Id, bia);

        var registro = await ctx.AcertosContas.FindAsync(acerto.Id);
        Assert.False(registro!.Ativo);
    }

    [Fact]
    public async Task CancelarAsync_GravaFinancialEventLog()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        var svc = NewSvc(ctx);

        var acerto = await svc.RegistrarAsync(familiaId, ana, Dto(ana, bia, 30m));
        await svc.CancelarAsync(familiaId, acerto.Id, ana);

        var log = await ctx.FinancialEventLogs
            .SingleAsync(e => e.Tipo == FinancialEventType.AcertoCancelado);
        Assert.Equal(acerto.Id, log.EntidadeId);
        Assert.Equal(30m, log.ValorAntes);
    }

    [Fact]
    public async Task RegistrarAsync_Dependente_LancaForbidden()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var dep = SeedUsuario(ctx, "dep@test.com", "Dep");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, dep, PapelFamilia.Dependente);
        var svc = NewSvc(ctx);

        // Dependente é só-leitura → não registra acerto (2.3).
        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.RegistrarAsync(familiaId, dep, Dto(dep, ana, 50m)));
    }

    [Fact]
    public async Task ObterBalanco_AcertoAbateSaldoDoMes()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);

        // Ana pagou 200, igualitário: cota 100 cada. Bia deve 100 a Ana.
        SeedDespesa(ctx, ana, 200m, familiaId);

        var acertoSvc = NewSvc(ctx);
        // Bia paga os 100 que devia a Ana.
        await acertoSvc.RegistrarAsync(familiaId, ana, Dto(bia, ana, 100m, 5, 2026));

        var balanco = await new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx), new RateioService(ctx))
            .ObterBalancoAsync(familiaId, ana, 5, 2026);

        // Após o acerto, ambos os saldos vão a zero.
        Assert.Equal(0m, balanco.Saldos.First(s => s.UsuarioId == ana).Saldo);
        Assert.Equal(0m, balanco.Saldos.First(s => s.UsuarioId == bia).Saldo);
    }

    // ── Passo 3: o acerto vira lançamento nas contas (decisão do Gustavo 2026-10-19: espera quem recebeu confirmar) ──

    private sealed record Casal(AppDbContext Ctx, Guid FamiliaId, Guid Ana, Guid Bia, Guid ContaAna, Guid ContaBia);

    private static async Task<Casal> SeedCasal()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana Souza");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia Lima");
        var familiaId = await SeedFamilia(ctx, ana);
        AddMembro(ctx, familiaId, bia);
        Guid Conta(Guid dono, string nome)
        {
            var c = new Conta { Id = Guid.NewGuid(), Nome = nome, Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = dono };
            ctx.Contas.Add(c);
            ctx.SaveChanges();
            return c.Id;
        }
        return new Casal(ctx, familiaId, ana, bia, Conta(ana, "Nubank Ana"), Conta(bia, "Itau Bia"));
    }

    private static RegistrarAcertoDto DtoConta(Guid de, Guid para, decimal valor, Guid? conta, DateOnly? data = null) =>
        new(de, para, valor, 5, 2026, null, Guid.NewGuid().ToString(), conta, data ?? new DateOnly(2026, 5, 20));

    private static async Task<decimal> SaldoNoEquilibrio(Casal c, Guid quem) =>
        (await new DespesaCompartilhadaService(c.Ctx, TestHelpers.Notif(c.Ctx), new RateioService(c.Ctx))
            .ObterBalancoAsync(c.FamiliaId, c.Ana, 5, 2026)).Saldos.First(s => s.UsuarioId == quem).Saldo;

    [Fact]
    public async Task QuemPassouRegistra_SaidaNaContaDele_EsperaConfirmar_ForaDoEquilibrio()
    {
        var c = await SeedCasal();
        SeedDespesa(c.Ctx, c.Ana, 200m, c.FamiliaId); // Ana pagou 200; Bia pagou 100 a menos

        var dto = await NewSvc(c.Ctx).RegistrarAsync(c.FamiliaId, c.Bia, DtoConta(c.Bia, c.Ana, 100m, c.ContaBia));

        Assert.Null(dto.ConfirmadoEm);
        var saida = await c.Ctx.Transacoes.SingleAsync(t => t.Id == dto.MinhaTransacaoId);
        Assert.Equal(TipoTransacao.Despesa, saida.Tipo);
        Assert.Equal(100m, saida.Valor);
        Assert.Equal(c.ContaBia, saida.ContaId);
        Assert.True(saida.EhAcerto);
        Assert.Equal("Acerto com Ana · F", saida.Descricao);
        Assert.Equal(new DateOnly(2026, 5, 20), saida.Data);
        Assert.False(RegrasFinanceiras.EntraNoResultadoEmMemoria(saida)); // não é gasto
        // Esperando a Ana confirmar: o equilíbrio ainda mostra a Bia 100 a menos.
        Assert.Equal(-100m, await SaldoNoEquilibrio(c, c.Bia));
        // A Ana não vê o id do lançamento da Bia.
        Assert.Null((await NewSvc(c.Ctx).ListarAsync(c.FamiliaId, c.Ana, 5, 2026)).Single().MinhaTransacaoId);
    }

    [Fact]
    public async Task QuemRecebeuConfirma_EntraNoEquilibrio_ENasceAEntrada_ESoEleConfirma()
    {
        var c = await SeedCasal();
        SeedDespesa(c.Ctx, c.Ana, 200m, c.FamiliaId);
        var svc = NewSvc(c.Ctx);
        var acerto = await svc.RegistrarAsync(c.FamiliaId, c.Bia, DtoConta(c.Bia, c.Ana, 100m, c.ContaBia));

        await Assert.ThrowsAsync<ForbiddenAccessException>(() => svc.ConfirmarAsync(c.FamiliaId, acerto.Id, c.Bia, new ContaDoAcertoDto(null, null)));
        var confirmado = await svc.ConfirmarAsync(c.FamiliaId, acerto.Id, c.Ana, new ContaDoAcertoDto(c.ContaAna, null));

        Assert.NotNull(confirmado.ConfirmadoEm);
        var entrada = await c.Ctx.Transacoes.SingleAsync(t => t.Id == confirmado.MinhaTransacaoId);
        Assert.Equal(TipoTransacao.Receita, entrada.Tipo);
        Assert.Equal(c.ContaAna, entrada.ContaId);
        Assert.True(entrada.EhAcerto);
        Assert.Equal("Acerto com Bia · F", entrada.Descricao);
        Assert.Equal(new DateOnly(2026, 5, 20), entrada.Data); // o dia em que o dinheiro passou
        Assert.Equal(0m, await SaldoNoEquilibrio(c, c.Bia));
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.ConfirmarAsync(c.FamiliaId, acerto.Id, c.Ana, new ContaDoAcertoDto(null, null)));
    }

    [Fact]
    public async Task QuemRecebeuRegistra_JaVale_EQuemPassouLancaDepois_UmaVezSo()
    {
        var c = await SeedCasal();
        SeedDespesa(c.Ctx, c.Ana, 200m, c.FamiliaId);
        var svc = NewSvc(c.Ctx);

        var acerto = await svc.RegistrarAsync(c.FamiliaId, c.Ana, DtoConta(c.Bia, c.Ana, 100m, null)); // sem conta
        Assert.NotNull(acerto.ConfirmadoEm);
        Assert.Null(acerto.MinhaTransacaoId);
        Assert.Equal(0m, await SaldoNoEquilibrio(c, c.Bia));

        var daBia = await svc.LancarNaMinhaContaAsync(c.FamiliaId, acerto.Id, c.Bia, new ContaDoAcertoDto(c.ContaBia, null));
        Assert.Equal(TipoTransacao.Despesa, (await c.Ctx.Transacoes.SingleAsync(t => t.Id == daBia.MinhaTransacaoId)).Tipo);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.LancarNaMinhaContaAsync(c.FamiliaId, acerto.Id, c.Bia, new ContaDoAcertoDto(c.ContaBia, null)));
        // Conta de outra pessoa: 404.
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            svc.LancarNaMinhaContaAsync(c.FamiliaId, acerto.Id, c.Ana, new ContaDoAcertoDto(c.ContaBia, null)));
    }

    [Fact]
    public async Task QuemRecebeu_NaoLancaAntesDeConfirmar()
    {
        var c = await SeedCasal();
        var svc = NewSvc(c.Ctx);
        var acerto = await svc.RegistrarAsync(c.FamiliaId, c.Bia, DtoConta(c.Bia, c.Ana, 50m, null));
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.LancarNaMinhaContaAsync(c.FamiliaId, acerto.Id, c.Ana, new ContaDoAcertoDto(c.ContaAna, null)));
    }

    [Fact]
    public async Task Terceiro_NaoRegistra_EDiaNoFuturo_ERecusado()
    {
        var c = await SeedCasal();
        var caio = SeedUsuario(c.Ctx, "caio@test.com", "Caio");
        AddMembro(c.Ctx, c.FamiliaId, caio);
        var svc = NewSvc(c.Ctx);

        await Assert.ThrowsAsync<ArgumentException>(() => svc.RegistrarAsync(c.FamiliaId, caio, DtoConta(c.Bia, c.Ana, 50m, null)));
        var amanha = HorarioBrasil.Hoje().AddDays(1);
        await Assert.ThrowsAsync<ArgumentException>(() => svc.RegistrarAsync(c.FamiliaId, c.Bia, DtoConta(c.Bia, c.Ana, 50m, c.ContaBia, amanha)));
        Assert.Empty(await c.Ctx.AcertosContas.ToListAsync());
        Assert.Empty(await c.Ctx.Transacoes.Where(t => t.EhAcerto).ToListAsync());
    }

    [Fact]
    public async Task MesmaChave_ComOutroValor_Recusa_ESemDuplicarLancamento()
    {
        var c = await SeedCasal();
        var svc = NewSvc(c.Ctx);
        var dto = DtoConta(c.Bia, c.Ana, 50m, c.ContaBia);
        await svc.RegistrarAsync(c.FamiliaId, c.Bia, dto);
        await svc.RegistrarAsync(c.FamiliaId, c.Bia, dto); // retry: o mesmo

        Assert.Single(await c.Ctx.Transacoes.Where(t => t.EhAcerto).ToListAsync());
        await Assert.ThrowsAsync<InvalidOperationException>(() => svc.RegistrarAsync(c.FamiliaId, c.Bia, dto with { Valor = 60m }));
    }

    [Fact]
    public async Task Desfazer_CancelaOsLancamentosDosDoisLados()
    {
        var c = await SeedCasal();
        var svc = NewSvc(c.Ctx);
        var acerto = await svc.RegistrarAsync(c.FamiliaId, c.Bia, DtoConta(c.Bia, c.Ana, 50m, c.ContaBia));
        await svc.ConfirmarAsync(c.FamiliaId, acerto.Id, c.Ana, new ContaDoAcertoDto(c.ContaAna, null));

        await svc.CancelarAsync(c.FamiliaId, acerto.Id, c.Ana);

        var lancamentos = await c.Ctx.Transacoes.IgnoreQueryFilters().Where(t => t.EhAcerto).ToListAsync();
        Assert.Equal(2, lancamentos.Count);
        Assert.All(lancamentos, t => Assert.False(t.Ativo));
    }
}
