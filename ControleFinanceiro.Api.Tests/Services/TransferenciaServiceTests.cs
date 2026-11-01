using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Transferencia;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class TransferenciaServiceTests
{
    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static (AppDbContext ctx, Guid usuarioId, Conta origem, Conta destino) Seed()
    {
        var ctx = CreateContext();
        var usuarioId = Guid.NewGuid();
        var origem = new Conta { Id = Guid.NewGuid(), Nome = "Origem", UsuarioIdProprietario = usuarioId, Tipo = TipoConta.ContaCorrente };
        var destino = new Conta { Id = Guid.NewGuid(), Nome = "Destino", UsuarioIdProprietario = usuarioId, Tipo = TipoConta.ContaPoupanca };
        ctx.Contas.AddRange(origem, destino);
        ctx.SaveChanges();
        return (ctx, usuarioId, origem, destino);
    }

    [Fact]
    public async Task Criar_MarcaAsDuasPernasComoTransferencia()
    {
        var (ctx, usuarioId, origem, destino) = Seed();
        await new TransferenciaService(ctx).CriarAsync(new CriarTransferenciaDto
        {
            ContaOrigemId = origem.Id, ContaDestinoId = destino.Id, Valor = 500m,
            Data = HorarioBrasil.Hoje(), Descricao = "Reserva"
        }, usuarioId);

        var txns = await ctx.Transacoes.ToListAsync();
        Assert.Equal(2, txns.Count);
        Assert.All(txns, t => Assert.True(t.EhTransferencia));
        // saldo neutro: -500 na origem, +500 no destino
        Assert.Contains(txns, t => t.ContaId == origem.Id && t.Tipo == TipoTransacao.Despesa);
        Assert.Contains(txns, t => t.ContaId == destino.Id && t.Tipo == TipoTransacao.Receita);
    }

    [Fact]
    public async Task Listar_Busca_FiltraNoServidor_PorDescricaoOuConta_SemDiferenciarCaixa()
    {
        var (ctx, usuarioId, origem, destino) = Seed();
        var service = new TransferenciaService(ctx);
        var reserva = await service.CriarAsync(new CriarTransferenciaDto
        {
            ContaOrigemId = origem.Id, ContaDestinoId = destino.Id, Valor = 500m,
            Data = HorarioBrasil.Hoje(), Descricao = "Reserva de emergência"
        }, usuarioId);
        var volta = await service.CriarAsync(new CriarTransferenciaDto
        {
            ContaOrigemId = destino.Id, ContaDestinoId = origem.Id, Valor = 100m,
            Data = HorarioBrasil.Hoje().AddDays(-1), Descricao = "Resgate"
        }, usuarioId);

        // Pela descrição: total já vem filtrado (paginação correta).
        var porDescricao = await service.ListarAsync(usuarioId, pageSize: 1, busca: "  RESERVA ");
        Assert.Equal(1, porDescricao.Total);
        Assert.Equal(reserva.Id, porDescricao.Items.Single().Id);

        // Pelo nome da conta (origem OU destino): as duas passam por "Destino".
        var porConta = await service.ListarAsync(usuarioId, busca: "destino");
        Assert.Equal(2, porConta.Total);

        // Sem busca: tudo (compatível com quem já chamava).
        var todas = await service.ListarAsync(usuarioId);
        Assert.Equal(2, todas.Total);
        Assert.Contains(todas.Items, t => t.Id == volta.Id);
    }

    [Fact]
    public async Task Listar_Busca_NaoVazaTransferenciaDeOutroUsuario()
    {
        var (ctx, usuarioId, origem, destino) = Seed();
        var outroId = Guid.NewGuid();
        var o1 = new Conta { Id = Guid.NewGuid(), Nome = "O1", UsuarioIdProprietario = outroId, Tipo = TipoConta.ContaCorrente };
        var o2 = new Conta { Id = Guid.NewGuid(), Nome = "O2", UsuarioIdProprietario = outroId, Tipo = TipoConta.ContaCorrente };
        ctx.Contas.AddRange(o1, o2);
        ctx.SaveChanges();
        var service = new TransferenciaService(ctx);
        await service.CriarAsync(new CriarTransferenciaDto
        {
            ContaOrigemId = o1.Id, ContaDestinoId = o2.Id, Valor = 10m, Data = HorarioBrasil.Hoje(), Descricao = "Reserva"
        }, outroId);
        await service.CriarAsync(new CriarTransferenciaDto
        {
            ContaOrigemId = origem.Id, ContaDestinoId = destino.Id, Valor = 10m, Data = HorarioBrasil.Hoje(), Descricao = "Reserva"
        }, usuarioId);

        var result = await service.ListarAsync(usuarioId, busca: "reserva");

        Assert.Equal(1, result.Total);
        Assert.Equal("Origem", result.Items.Single().ContaOrigemNome);
    }

    [Fact]
    public async Task Deletar_FazSoftDeleteNasTransacoes()
    {
        var (ctx, usuarioId, origem, destino) = Seed();
        var service = new TransferenciaService(ctx);
        var dto = await service.CriarAsync(new CriarTransferenciaDto
        {
            ContaOrigemId = origem.Id, ContaDestinoId = destino.Id, Valor = 500m,
            Data = HorarioBrasil.Hoje(), Descricao = "Reserva"
        }, usuarioId);

        await service.DeletarAsync(dto.Id, usuarioId);

        // Transações preservadas (soft delete), não removidas fisicamente.
        // IgnoreQueryFilters: o filtro global de Transacao exclui canceladas — aqui
        // queremos justamente confirmar que as linhas ainda EXISTEM no banco.
        var txns = await ctx.Transacoes.IgnoreQueryFilters().ToListAsync();
        Assert.Equal(2, txns.Count);
        Assert.All(txns, t => Assert.False(t.Ativo));
        Assert.All(txns, t => Assert.Equal(StatusTransacao.Cancelado, t.StatusTransacao));
    }

    // ══ Perna de transferência pela tela de Transações (revisão de segurança do #288) ═══════════════════
    // Antes "Excluir" numa perna cancelava SÓ ela: o dinheiro sumia (ou aparecia) numa das contas.

    private static TransacaoService Transacoes(AppDbContext ctx) =>
        new(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx));

    [Fact]
    public async Task ExcluirUmaPernaPelaTelaDeTransacoes_ExcluiAsDuas_EATransferencia()
    {
        var (ctx, usuarioId, origem, destino) = Seed();
        await new TransferenciaService(ctx).CriarAsync(new CriarTransferenciaDto
        {
            ContaOrigemId = origem.Id, ContaDestinoId = destino.Id, Valor = 500m,
            Data = HorarioBrasil.Hoje(), Descricao = "Reserva"
        }, usuarioId);
        var pernaDestino = await ctx.Transacoes.SingleAsync(t => t.ContaId == destino.Id);

        Assert.True(await Transacoes(ctx).DeletarAsync(pernaDestino.Id, usuarioId));

        ctx.ChangeTracker.Clear();
        var pernas = await ctx.Transacoes.IgnoreQueryFilters().Where(t => t.EhTransferencia).ToListAsync();
        Assert.Equal(2, pernas.Count);
        Assert.All(pernas, t => Assert.False(t.Ativo));                 // as DUAS, não só a clicada
        Assert.Empty(await ctx.Transferencias.ToListAsync());
    }

    [Fact]
    public async Task EditarUmaPernaPelaTelaDeTransacoes_Recusa_SemMexerEmNada()
    {
        var (ctx, usuarioId, origem, destino) = Seed();
        await new TransferenciaService(ctx).CriarAsync(new CriarTransferenciaDto
        {
            ContaOrigemId = origem.Id, ContaDestinoId = destino.Id, Valor = 500m,
            Data = HorarioBrasil.Hoje(), Descricao = "Reserva"
        }, usuarioId);
        var perna = await ctx.Transacoes.SingleAsync(t => t.ContaId == origem.Id);

        await Assert.ThrowsAsync<InvalidOperationException>(() => Transacoes(ctx).AtualizarAsync(perna.Id, new Transacao
        {
            Descricao = "Reserva", Valor = 1m, Tipo = TipoTransacao.Despesa, Data = HorarioBrasil.Hoje(),
        }, usuarioId));

        ctx.ChangeTracker.Clear();
        Assert.All(await ctx.Transacoes.Where(t => t.EhTransferencia).ToListAsync(), t => Assert.Equal(500m, t.Valor));
    }

    // ══ Data + hora (achado 2026-10-02: o form exigia a hora e o back jogava fora) ══════════════════════

    [Fact]
    public async Task Criar_ComHora_GravaODiaEAHoraNasDuasPernas_ENaTransferencia()
    {
        var (ctx, usuarioId, origem, destino) = Seed();
        var ontem = HorarioBrasil.Hoje().AddDays(-1);

        var dto = await new TransferenciaService(ctx).CriarAsync(new CriarTransferenciaDto
        {
            ContaOrigemId = origem.Id, ContaDestinoId = destino.Id, Valor = 500m,
            Data = ontem, Hora = new TimeOnly(9, 15), Descricao = "Reserva"
        }, usuarioId);

        var pernas = await ctx.Transacoes.Where(t => t.EhTransferencia).ToListAsync();
        Assert.Equal(2, pernas.Count);
        Assert.All(pernas, t =>
        {
            Assert.Equal(ontem, t.Data);
            Assert.Equal(new TimeOnly(9, 15), t.Hora);
        });
        Assert.Equal(ontem.ToDateTime(new TimeOnly(9, 15)), dto.Data);
    }

    [Fact]
    public async Task Criar_SemHora_PernasFicamSemHora()
    {
        var (ctx, usuarioId, origem, destino) = Seed();
        var hoje = HorarioBrasil.Hoje();

        await new TransferenciaService(ctx).CriarAsync(new CriarTransferenciaDto
        {
            ContaOrigemId = origem.Id, ContaDestinoId = destino.Id, Valor = 500m, Data = hoje, Descricao = "Reserva"
        }, usuarioId);

        Assert.All(await ctx.Transacoes.Where(t => t.EhTransferencia).ToListAsync(), t =>
        {
            Assert.Equal(hoje, t.Data);
            Assert.Null(t.Hora);
        });
    }

    [Fact]
    public async Task Criar_DataFutura_LancaArgumentException_SemCriarNada()
    {
        // As pernas nascem efetivadas: transferência futura moveria no saldo um dinheiro que ainda não saiu.
        var (ctx, usuarioId, origem, destino) = Seed();

        await Assert.ThrowsAsync<ArgumentException>(() => new TransferenciaService(ctx).CriarAsync(new CriarTransferenciaDto
        {
            ContaOrigemId = origem.Id, ContaDestinoId = destino.Id, Valor = 500m,
            Data = HorarioBrasil.Hoje().AddDays(2), Descricao = "Reserva"
        }, usuarioId));

        Assert.Empty(await ctx.Transacoes.ToListAsync());
        Assert.Empty(await ctx.Transferencias.ToListAsync());
    }

    // ── Editar (regra do formulário: mesma conferência de criar, as duas pernas juntas) ─────────────

    private static async Task<(AppDbContext ctx, Guid usuarioId, Conta origem, Conta destino, TransferenciaDto tf)> SeedComTransferencia()
    {
        var (ctx, usuarioId, origem, destino) = Seed();
        var tf = await new TransferenciaService(ctx).CriarAsync(new CriarTransferenciaDto
        {
            ContaOrigemId = origem.Id, ContaDestinoId = destino.Id, Valor = 100m, Data = HorarioBrasil.Hoje(), Descricao = "Reserva",
        }, usuarioId);
        return (ctx, usuarioId, origem, destino, tf);
    }

    [Fact]
    public async Task Editar_MudaContasValorDataHoraEDescricao_NasDuasPernasENaTransferencia()
    {
        var (ctx, usuarioId, origem, destino, tf) = await SeedComTransferencia();
        var terceira = new Conta { Id = Guid.NewGuid(), Nome = "Terceira", UsuarioIdProprietario = usuarioId, Tipo = TipoConta.ContaCorrente };
        ctx.Contas.Add(terceira);
        ctx.SaveChanges();
        var anteontem = HorarioBrasil.Hoje().AddDays(-2);

        var editada = await new TransferenciaService(ctx).EditarAsync(tf.Id, new CriarTransferenciaDto
        {
            ContaOrigemId = destino.Id, ContaDestinoId = terceira.Id, Valor = 250m, Data = anteontem, Hora = new TimeOnly(9, 30), Descricao = "Ajuste",
        }, usuarioId);

        var t = await ctx.Transferencias.SingleAsync();
        var saida = await ctx.Transacoes.SingleAsync(x => x.Id == t.TransacaoOrigemId);
        var entrada = await ctx.Transacoes.SingleAsync(x => x.Id == t.TransacaoDestinoId);
        Assert.Equal((destino.Id, TipoTransacao.Despesa), (saida.ContaId!.Value, saida.Tipo));
        Assert.Equal((terceira.Id, TipoTransacao.Receita), (entrada.ContaId!.Value, entrada.Tipo));
        Assert.All(new[] { saida, entrada }, p =>
        {
            Assert.Equal(250m, p.Valor);
            Assert.Equal(anteontem, p.Data);
            Assert.Equal(new TimeOnly(9, 30), p.Hora);
            Assert.Equal("Ajuste", p.Descricao);
            Assert.True(p.EhTransferencia);
        });
        Assert.Equal((destino.Id, terceira.Id, 250m), (t.ContaOrigemId, t.ContaDestinoId, t.Valor));
        Assert.Equal(anteontem.ToDateTime(new TimeOnly(9, 30)), t.Data);
        Assert.Equal("Terceira", editada.ContaDestinoNome);
    }

    [Fact]
    public async Task Editar_DescricaoVazia_ViraOPadraoComAsContasNovas_ESemHoraFicaSemHora()
    {
        var (ctx, usuarioId, origem, destino, tf) = await SeedComTransferencia();

        await new TransferenciaService(ctx).EditarAsync(tf.Id, new CriarTransferenciaDto
        {
            ContaOrigemId = destino.Id, ContaDestinoId = origem.Id, Valor = 100m, Data = HorarioBrasil.Hoje(), Hora = null, Descricao = " ",
        }, usuarioId);

        Assert.All(await ctx.Transacoes.ToListAsync(), p =>
        {
            Assert.Equal("Transferência: Destino → Origem", p.Descricao);
            Assert.Null(p.Hora);
        });
    }

    [Fact]
    public async Task Editar_ComAsMesmasRegrasDeCriar_RecusaSemMexerEmNada()
    {
        var (ctx, usuarioId, origem, destino, tf) = await SeedComTransferencia();
        var deOutro = new Conta { Id = Guid.NewGuid(), Nome = "De outro", UsuarioIdProprietario = Guid.NewGuid(), Tipo = TipoConta.ContaCorrente };
        var encerrada = new Conta { Id = Guid.NewGuid(), Nome = "Encerrada", UsuarioIdProprietario = usuarioId, Tipo = TipoConta.ContaCorrente, EncerradaEm = DateTime.UtcNow };
        ctx.Contas.AddRange(deOutro, encerrada);
        ctx.SaveChanges();
        var service = new TransferenciaService(ctx);
        CriarTransferenciaDto Com(Guid de, Guid para, decimal valor = 100m, int dias = 0) =>
            new() { ContaOrigemId = de, ContaDestinoId = para, Valor = valor, Data = HorarioBrasil.Hoje().AddDays(dias), Descricao = "X" };

        await Assert.ThrowsAsync<ArgumentException>(() => service.EditarAsync(tf.Id, Com(origem.Id, origem.Id), usuarioId));
        await Assert.ThrowsAsync<ArgumentException>(() => service.EditarAsync(tf.Id, Com(origem.Id, destino.Id, valor: 0m), usuarioId));
        await Assert.ThrowsAsync<ArgumentException>(() => service.EditarAsync(tf.Id, Com(origem.Id, destino.Id, dias: 1), usuarioId));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.EditarAsync(tf.Id, Com(origem.Id, deOutro.Id), usuarioId));
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.EditarAsync(tf.Id, Com(encerrada.Id, destino.Id), usuarioId));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.EditarAsync(tf.Id, Com(origem.Id, destino.Id), Guid.NewGuid()));

        Assert.All(await ctx.Transacoes.ToListAsync(), p => { Assert.Equal(100m, p.Valor); Assert.Equal("Reserva", p.Descricao); });
    }

    [Fact]
    public async Task Editar_PraCaixinhaDeMeta_Recusa_SoMetasMexeNela()
    {
        var (ctx, usuarioId, origem, _, tf) = await SeedComTransferencia();
        var caixinha = new Conta { Id = Guid.NewGuid(), Nome = "Caixinha Viagem", UsuarioIdProprietario = usuarioId, Tipo = TipoConta.Caixinha };
        ctx.Contas.Add(caixinha);
        ctx.SaveChanges();

        var erro = await Assert.ThrowsAsync<InvalidOperationException>(() => new TransferenciaService(ctx).EditarAsync(tf.Id, new CriarTransferenciaDto
        {
            ContaOrigemId = origem.Id, ContaDestinoId = caixinha.Id, Valor = 100m, Data = HorarioBrasil.Hoje(), Descricao = "Reserva",
        }, usuarioId));
        Assert.Equal(Conta.MensagemCaixinha, erro.Message);
    }

    [Fact]
    public async Task ObterPelaPerna_AchaPelasDuasPernas_DizSeTemCaixinha_ENaoVazaDeOutroUsuario()
    {
        var (ctx, usuarioId, origem, destino, tf) = await SeedComTransferencia();
        var service = new TransferenciaService(ctx);
        var pernas = await ctx.Transacoes.Select(p => p.Id).ToListAsync();

        foreach (var perna in pernas)
        {
            var achada = await service.ObterPelaPernaAsync(perna, usuarioId);
            Assert.Equal(tf.Id, achada.Id);
            Assert.False(achada.ComCaixinha);
        }
        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.ObterPelaPernaAsync(pernas[0], Guid.NewGuid()));

        // Guardar numa meta (transferência pra caixinha, só com a trava liberada como o MetaService faz).
        var caixinha = new Conta { Id = Guid.NewGuid(), Nome = "Caixinha", UsuarioIdProprietario = usuarioId, Tipo = TipoConta.Caixinha };
        ctx.Contas.Add(caixinha);
        ctx.SaveChanges();
        TransferenciaDto guardar;
        using (ctx.LiberarCaixinha())
            guardar = await service.CriarAsync(new CriarTransferenciaDto { ContaOrigemId = origem.Id, ContaDestinoId = caixinha.Id, Valor = 10m, Data = HorarioBrasil.Hoje(), Descricao = "Guardar" }, usuarioId);
        var pernaGuardar = (await ctx.Transferencias.SingleAsync(x => x.Id == guardar.Id)).TransacaoOrigemId;
        Assert.True((await service.ObterPelaPernaAsync(pernaGuardar, usuarioId)).ComCaixinha);
    }
    // ── Log financeiro (achado 2026-10-31: transferência mexia no saldo de duas contas sem deixar registro) ──

    private static async Task<List<FinancialEventLog>> Log(AppDbContext ctx, FinancialEventType tipo) =>
        await ctx.FinancialEventLogs.Where(e => e.Tipo == tipo).ToListAsync();

    [Fact]
    public async Task Criar_GravaNoLog_UmEventoPorConta_ComOSaldoDeAntesEODeDepois_NaMesmaOperacao()
    {
        var (ctx, usuarioId, origem, destino) = Seed();
        ctx.Transacoes.Add(new Transacao { Id = Guid.NewGuid(), Descricao = "Salário", Valor = 1000m, Tipo = TipoTransacao.Receita, ContaId = origem.Id, CriadoPor = usuarioId, Data = HorarioBrasil.Hoje() });
        ctx.SaveChanges();

        var tf = await new TransferenciaService(ctx).CriarAsync(new CriarTransferenciaDto
        {
            ContaOrigemId = origem.Id, ContaDestinoId = destino.Id, Valor = 300m, Data = HorarioBrasil.Hoje(), Descricao = "Reserva"
        }, usuarioId);

        var eventos = await Log(ctx, FinancialEventType.TransferenciaCriada);
        Assert.Equal(2, eventos.Count);
        Assert.Single(eventos.Select(e => e.CorrelationId).Distinct());
        Assert.All(eventos, e => Assert.Equal(("Conta", usuarioId), (e.EntidadeAfetada, e.CriadoPor)));
        Assert.All(eventos, e => Assert.Contains(tf.Id.ToString(), e.PayloadJson));
        var naOrigem = eventos.Single(e => e.EntidadeId == origem.Id);
        Assert.Equal((1000m, 700m), (naOrigem.ValorAntes, naOrigem.ValorDepois));
        var noDestino = eventos.Single(e => e.EntidadeId == destino.Id);
        Assert.Equal((0m, 300m), (noDestino.ValorAntes, noDestino.ValorDepois));
    }

    [Fact]
    public async Task Editar_TrocandoAContaEOValor_GravaNoLogTodasAsContasMexidas_ComOAntesEODepois()
    {
        var (ctx, usuarioId, origem, destino, tf) = await SeedComTransferencia();
        var terceira = new Conta { Id = Guid.NewGuid(), Nome = "Terceira", UsuarioIdProprietario = usuarioId, Tipo = TipoConta.ContaCorrente };
        ctx.Contas.Add(terceira);
        ctx.SaveChanges();
        var valorAntigo = (await ctx.Transferencias.SingleAsync()).Valor;

        await new TransferenciaService(ctx).EditarAsync(tf.Id, new CriarTransferenciaDto
        {
            ContaOrigemId = origem.Id, ContaDestinoId = terceira.Id, Valor = valorAntigo + 50m, Data = HorarioBrasil.Hoje(), Descricao = "Mudou"
        }, usuarioId);

        var eventos = await Log(ctx, FinancialEventType.TransferenciaEditada);
        Assert.Equal(3, eventos.Count); // origem (a mesma), o destino velho e o novo
        var naOrigem = eventos.Single(e => e.EntidadeId == origem.Id);
        Assert.Equal(-50m, naOrigem.ValorDepois - naOrigem.ValorAntes); // saiu 50 a mais
        var destinoVelho = eventos.Single(e => e.EntidadeId == destino.Id);
        Assert.Equal((valorAntigo, 0m), (destinoVelho.ValorAntes, destinoVelho.ValorDepois));
        var destinoNovo = eventos.Single(e => e.EntidadeId == terceira.Id);
        Assert.Equal((0m, valorAntigo + 50m), (destinoNovo.ValorAntes, destinoNovo.ValorDepois));
        Assert.Contains("\"antes\"", naOrigem.PayloadJson);
        Assert.Contains("Mudou", naOrigem.PayloadJson);
    }

    [Fact]
    public async Task Excluir_PelaTelaDeTransferenciasOuPelaPerna_GravaNoLogAVoltaDoSaldo()
    {
        var (ctx, usuarioId, origem, destino, tf) = await SeedComTransferencia();
        var valor = (await ctx.Transferencias.SingleAsync()).Valor;
        await new TransferenciaService(ctx).DeletarAsync(tf.Id, usuarioId);

        var eventos = await Log(ctx, FinancialEventType.TransferenciaExcluida);
        Assert.Equal(2, eventos.Count);
        Assert.Equal((-valor, 0m), (eventos.Single(e => e.EntidadeId == origem.Id).ValorAntes, eventos.Single(e => e.EntidadeId == origem.Id).ValorDepois));
        Assert.Equal((valor, 0m), (eventos.Single(e => e.EntidadeId == destino.Id).ValorAntes, eventos.Single(e => e.EntidadeId == destino.Id).ValorDepois));

        // Pela tela de Transações (excluir uma perna), o mesmo registro.
        var outra = await new TransferenciaService(ctx).CriarAsync(new CriarTransferenciaDto
        {
            ContaOrigemId = origem.Id, ContaDestinoId = destino.Id, Valor = 20m, Data = HorarioBrasil.Hoje(), Descricao = "Outra"
        }, usuarioId);
        var perna = (await ctx.Transferencias.SingleAsync(x => x.Id == outra.Id)).TransacaoDestinoId;
        Assert.True(await Transacoes(ctx).DeletarAsync(perna, usuarioId));
        Assert.Equal(4, (await Log(ctx, FinancialEventType.TransferenciaExcluida)).Count);
    }
}
