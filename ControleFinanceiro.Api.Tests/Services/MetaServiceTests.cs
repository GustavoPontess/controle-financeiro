using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Familia;
using ControleFinanceiro.Api.DTOs.Meta;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class MetaServiceTests
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

    private static async Task<Guid> SeedFamilia(AppDbContext ctx, Guid donoId)
    {
        var familia = await new FamiliaService(ctx).CriarAsync(new CriarFamiliaDto("F"), donoId);
        return familia.Id;
    }

    private static CriarMetaDto MetaDto(string nome = "Viagem", decimal alvo = 5000m,
        Guid? familiaId = null) =>
        new(nome, null, alvo, null, familiaId, null);

    // ── Criar ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CriarAsync_Valido_PersisteComValorAtualZero()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com", "User");
        var svc = Servico(ctx);

        var dto = await svc.CriarAsync(MetaDto("Casa", 100_000m), user);

        Assert.Equal("Casa", dto.Nome);
        Assert.Equal(100_000m, dto.ValorAlvo);
        Assert.Equal(0m, dto.ValorAtual);
        Assert.NotNull(dto.ContaId);
        Assert.Equal(0m, dto.PercentualConcluido);
        Assert.False(dto.Concluida);
        Assert.Equal(user, dto.UsuarioId);
    }

    [Fact]
    public async Task CriarAsync_FamiliaIdSemMembro_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var estranho = SeedUsuario(ctx, "estranho@test.com");
        var svc = Servico(ctx);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.CriarAsync(MetaDto(familiaId: familiaId), estranho));
    }

    [Fact]
    public async Task CriarAsync_FamiliaIdMembro_Persiste()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = Servico(ctx);

        var dto = await svc.CriarAsync(MetaDto("Viagem", 3000m, familiaId), dono);

        Assert.Equal(familiaId, dto.FamiliaId);
    }

    // ── Listar ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListarAsync_RetornaPessoaisEFamiliares()
    {
        var ctx = CreateContext();
        var ana = SeedUsuario(ctx, "ana@test.com", "Ana");
        var bia = SeedUsuario(ctx, "bia@test.com", "Bia");
        var familiaId = await SeedFamilia(ctx, ana);
        ctx.MembrosFamilia.Add(new MembroFamilia
        {
            Id = Guid.NewGuid(), FamiliaId = familiaId, UsuarioId = bia,
            Papel = "Membro", EntrouEm = DateTime.UtcNow, Ativo = true,
        });
        ctx.SaveChanges();
        var svc = Servico(ctx);

        await svc.CriarAsync(MetaDto("Pessoal Ana"), ana);           // pessoal de Ana
        await svc.CriarAsync(MetaDto("Conjunta", familiaId: familiaId), ana); // conjunta

        // Bia deve ver a conjunta mas não a pessoal de Ana
        var listaBia = await svc.ListarAsync(bia);
        Assert.Single(listaBia);
        Assert.Equal("Conjunta", listaBia[0].Nome);

        // Ana vê as duas
        var listaAna = await svc.ListarAsync(ana);
        Assert.Equal(2, listaAna.Count);
    }

    [Fact]
    public async Task ListarAsync_NaoRetornaInativas()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var svc = Servico(ctx);

        var criada = await svc.CriarAsync(MetaDto(), user);
        await svc.ExcluirAsync(criada.Id, user);

        var lista = await svc.ListarAsync(user);
        Assert.Empty(lista);
    }

    // ── Atualizar ────────────────────────────────────────────────────────────

    [Fact]
    public async Task AtualizarAsync_Valido_AlteraDados()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var svc = Servico(ctx);
        var criada = await svc.CriarAsync(MetaDto("Velha", 1000m), user);

        var atualizada = await svc.AtualizarAsync(
            criada.Id, new CriarMetaDto("Nova", "desc", 2000m, null, null, null), user);

        Assert.Equal("Nova", atualizada.Nome);
        Assert.Equal(2000m, atualizada.ValorAlvo);
    }

    [Fact]
    public async Task AtualizarAsync_NaoCriador_LancaUnauthorized()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var outro = SeedUsuario(ctx, "outro@test.com");
        var svc = Servico(ctx);
        var criada = await svc.CriarAsync(MetaDto(), dono);

        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.AtualizarAsync(criada.Id, MetaDto(), outro));
    }

    // ── Caixinha: guardar e resgatar são transferências de verdade ─────────────

    private static string Chave() => Guid.NewGuid().ToString();
    private static MetaService Servico(AppDbContext ctx) => new(ctx, new TransferenciaService(ctx));

    /// <summary>Conta do usuário com saldo inicial (o saldo real vem de RegrasFinanceiras).</summary>
    private static Guid SeedConta(AppDbContext ctx, Guid usuarioId, decimal saldo, string nome = "Corrente", bool encerrada = false)
    {
        var c = new Conta
        {
            Id = Guid.NewGuid(), Nome = nome, Tipo = TipoConta.ContaCorrente, UsuarioIdProprietario = usuarioId,
            EncerradaEm = encerrada ? DateTime.UtcNow : null,
        };
        ctx.Contas.Add(c);
        if (saldo > 0)
            ctx.Transacoes.Add(new Transacao
            {
                Id = Guid.NewGuid(), Descricao = "Saldo Inicial", Valor = saldo, Tipo = TipoTransacao.Receita, ContaId = c.Id,
                Data = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-5), CriadoPor = usuarioId, EhSaldoInicial = true,
            });
        ctx.SaveChanges();
        return c.Id;
    }

    private static async Task<decimal> Saldo(AppDbContext ctx, Guid contaId, Guid usuarioId) =>
        (await RegrasFinanceiras.SaldoDaContaAsync(ctx, contaId, usuarioId)).Saldo;

    [Fact]
    public async Task Criar_NasceComACaixinhaDela()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var meta = await Servico(ctx).CriarAsync(new CriarMetaDto("Viagem", null, 1000m, null, null, null, "viagem"), user);

        var caixinha = await ctx.Contas.SingleAsync(c => c.Id == meta.ContaId);
        Assert.Equal(TipoConta.Caixinha, caixinha.Tipo);
        Assert.Equal("Viagem", caixinha.Nome);
        Assert.Equal(user, caixinha.UsuarioIdProprietario);
        Assert.Equal("viagem", meta.Icone);
        await Assert.ThrowsAsync<ArgumentException>(
            () => Servico(ctx).CriarAsync(new CriarMetaDto("X", null, 10m, null, null, null, "foguete"), user));
    }

    [Fact]
    public async Task Guardar_TiraDaContaEPoeNaCaixinha_ComTransferencia()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var conta = SeedConta(ctx, user, 1000m);
        var svc = Servico(ctx);
        var meta = await svc.CriarAsync(MetaDto("Viagem", 1000m), user);

        await svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 300m), user, Chave());
        var result = await svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 200m), user, Chave());

        Assert.Equal(500m, result.Guardado);
        Assert.Equal(500m, result.ValorAtual);
        Assert.Equal(500m, result.Falta);
        Assert.Equal(50m, result.PercentualConcluido);
        Assert.Equal(500m, await Saldo(ctx, conta, user));            // o dinheiro SAIU da conta
        Assert.Equal(500m, await Saldo(ctx, meta.ContaId!.Value, user)); // e está na caixinha
        Assert.Equal(2, ctx.Transferencias.Count());
        Assert.All(ctx.Transacoes.Where(t => !t.EhSaldoInicial), t => Assert.True(t.EhTransferencia)); // fora do resultado
        Assert.Contains(ctx.Transacoes, t => t.Descricao == "Guardado em Viagem");
    }

    [Fact]
    public async Task Guardar_NaoPassaDoSaldoDaConta_NemDeContaEncerradaOuDeOutro()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var outro = SeedUsuario(ctx, "outro@test.com");
        var conta = SeedConta(ctx, user, 1000m);
        var encerrada = SeedConta(ctx, user, 1000m, "Velha", encerrada: true);
        var doOutro = SeedConta(ctx, outro, 1000m);
        var svc = Servico(ctx);
        var meta = await svc.CriarAsync(MetaDto("A", 5000m), user);

        var erro = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 1000.01m), user, Chave()));
        Assert.Contains("Só tem", erro.Message);
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.GuardarAsync(meta.Id, new MovimentoMetaDto(encerrada, 10m), user, Chave()));
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.GuardarAsync(meta.Id, new MovimentoMetaDto(doOutro, 10m), user, Chave()));
        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.GuardarAsync(meta.Id, new MovimentoMetaDto(meta.ContaId!.Value, 10m), user, Chave()));
        Assert.Empty(ctx.Transferencias);
    }

    [Fact]
    public async Task Guardar_DaCaixinhaDeOutraMeta_Recusa()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var conta = SeedConta(ctx, user, 1000m);
        var svc = Servico(ctx);
        var a = await svc.CriarAsync(MetaDto("A", 5000m), user);
        var b = await svc.CriarAsync(MetaDto("B", 5000m), user);
        await svc.GuardarAsync(a.Id, new MovimentoMetaDto(conta, 400m), user, Chave());

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.GuardarAsync(b.Id, new MovimentoMetaDto(a.ContaId!.Value, 100m), user, Chave()));
    }

    [Fact]
    public async Task Guardar_MesmaChave_NaoMoveDuasVezes_SemChaveRecusa()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var conta = SeedConta(ctx, user, 1000m);
        var svc = Servico(ctx);
        var meta = await svc.CriarAsync(MetaDto(), user);
        var chave = Chave();

        await svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 1000m), user, chave);
        // Repetir (saldo da conta já é zero): devolve o mesmo, sem barrar por saldo e sem mover de novo.
        var repetido = await svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 1000m), user, chave);

        Assert.Equal(1000m, repetido.Guardado);
        Assert.Single(ctx.Transferencias);
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 999m), user, chave)); // mesma chave, outros dados
        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 1m), user, null));
    }

    [Fact]
    public async Task Resgatar_VoltaPraConta_NaoPassaDoGuardado_EApareceNoHistorico()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var conta = SeedConta(ctx, user, 1000m);
        var outra = SeedConta(ctx, user, 0m, "Poupança");
        var svc = Servico(ctx);
        var meta = await svc.CriarAsync(MetaDto("Viagem"), user);
        await svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 400m), user, Chave());

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.ResgatarAsync(meta.Id, new MovimentoMetaDto(outra, 401m), user, Chave()));
        var depois = await svc.ResgatarAsync(meta.Id, new MovimentoMetaDto(outra, 150m), user, Chave());

        Assert.Equal(250m, depois.Guardado);
        Assert.Equal(150m, await Saldo(ctx, outra, user));
        var historico = await svc.HistoricoAsync(meta.Id, user);
        Assert.Equal(2, historico.Count);
        Assert.Equal(["resgatou", "guardou"], historico.Select(h => h.Tipo)); // mais recente em cima
        Assert.Contains(historico, h => h.Tipo == "guardou" && h.Valor == 400m && h.ContaId == conta && h.ContaNome == "Corrente");
        Assert.Contains(historico, h => h.Tipo == "resgatou" && h.Valor == 150m && h.ContaId == outra && h.ContaNome == "Poupança");
    }

    [Fact]
    public async Task Guardar_AtingeAlvo_MarcaConcluida_PercentualCapado()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var conta = SeedConta(ctx, user, 1000m);
        var svc = Servico(ctx);
        var meta = await svc.CriarAsync(MetaDto("X", 100m), user);

        var result = await svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 150m), user, Chave());

        Assert.Equal(100m, result.PercentualConcluido);
        Assert.True(result.Concluida);
        Assert.Equal("concluida", result.Situacao);
        Assert.Equal(0m, result.Falta);
    }

    [Fact]
    public async Task Excluir_ComDinheiro_Recusa_Zerada_EncerraACaixinha()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var conta = SeedConta(ctx, user, 1000m);
        var svc = Servico(ctx);
        var meta = await svc.CriarAsync(MetaDto(), user);
        await svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 600m), user, Chave());

        var erro = await Assert.ThrowsAsync<InvalidOperationException>(() => svc.ExcluirAsync(meta.Id, user));
        Assert.Contains("Resgate", erro.Message);
        await svc.ResgatarAsync(meta.Id, new MovimentoMetaDto(conta, 600m), user, Chave());
        await svc.ExcluirAsync(meta.Id, user);

        Assert.False((await ctx.Metas.FindAsync(meta.Id))!.Ativo);
        Assert.NotNull((await ctx.Contas.FindAsync(meta.ContaId))!.EncerradaEm);
        Assert.Equal(1000m, await Saldo(ctx, conta, user));
    }

    [Fact]
    public async Task Atualizar_RenomeiaACaixinha()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var svc = Servico(ctx);
        var meta = await svc.CriarAsync(MetaDto("Viagem"), user);

        await svc.AtualizarAsync(meta.Id, new CriarMetaDto("Viagem pra praia", null, 2000m, null, null, null, "viagem"), user);

        Assert.Equal("Viagem pra praia", (await ctx.Contas.FindAsync(meta.ContaId))!.Nome);
    }

    [Fact]
    public async Task MetaAntigaSemCaixinha_GanhaUmaNoPrimeiroGuardar()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var conta = SeedConta(ctx, user, 1000m);
        var antiga = new Meta { Id = Guid.NewGuid(), Nome = "Antiga", ValorAlvo = 500m, UsuarioId = user };
        ctx.Metas.Add(antiga);
        ctx.SaveChanges();

        var result = await Servico(ctx).GuardarAsync(antiga.Id, new MovimentoMetaDto(conta, 100m), user, Chave());

        Assert.NotNull(result.ContaId);
        Assert.Equal(100m, result.Guardado);
    }

    [Fact]
    public async Task Listar_SoPessoais_TiraAsDeFamilia()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = Servico(ctx);
        await svc.CriarAsync(MetaDto("Minha"), dono);
        await svc.CriarAsync(MetaDto("Da casa", 1000m, familiaId), dono);

        var pessoais = await svc.ListarAsync(dono, soPessoais: true);

        Assert.Equal("Minha", Assert.Single(pessoais).Nome);
        Assert.Equal(2, (await svc.ListarAsync(dono)).Count);
    }

    // ── Trava: só Metas mexe na caixinha (AppDbContext.SaveChanges) ──────────────

    [Fact]
    public async Task Caixinha_LancamentoOuTransferenciaPorFora_Recusa()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var conta = SeedConta(ctx, user, 1000m);
        var meta = await Servico(ctx).CriarAsync(MetaDto(), user);
        var caixinha = meta.ContaId!.Value;

        // Transferência avulsa (tela de transferências) pra caixinha.
        var erro = await Assert.ThrowsAsync<InvalidOperationException>(() => new TransferenciaService(ctx).CriarAsync(
            new DTOs.Transferencia.CriarTransferenciaDto { ContaOrigemId = conta, ContaDestinoId = caixinha, Valor = 10m, Data = DateOnly.FromDateTime(DateTime.UtcNow) }, user));
        Assert.Equal(Conta.MensagemCaixinha, erro.Message);
        ctx.ChangeTracker.Clear();

        // Lançamento direto, qualquer caminho.
        ctx.Transacoes.Add(new Transacao { Id = Guid.NewGuid(), Descricao = "x", Valor = 5m, Tipo = TipoTransacao.Despesa, ContaId = caixinha, CriadoPor = user, Data = DateOnly.FromDateTime(DateTime.UtcNow) });
        await Assert.ThrowsAsync<InvalidOperationException>(() => ctx.SaveChangesAsync());
        ctx.ChangeTracker.Clear();

        // Checagem de dono das escritas também recusa (erro cedo, antes de montar o lançamento).
        await Assert.ThrowsAsync<InvalidOperationException>(() => DonoRecursos.ExigirContaAbertaAsync(ctx, caixinha, user));
        Assert.Equal(0m, await Saldo(ctx, caixinha, user));
    }

    [Fact]
    public async Task Caixinha_ExcluirOuMoverAPernaPelaTelaDeTransacoes_Recusa()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var conta = SeedConta(ctx, user, 1000m);
        var svc = Servico(ctx);
        var meta = await svc.CriarAsync(MetaDto(), user);
        await svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 300m), user, Chave());
        var perna = ctx.Transacoes.Single(t => t.ContaId == meta.ContaId);

        perna.Ativo = false;
        await Assert.ThrowsAsync<InvalidOperationException>(() => ctx.SaveChangesAsync());
        perna.Ativo = true;
        perna.ContaId = conta; // tirar da caixinha mudando a conta
        await Assert.ThrowsAsync<InvalidOperationException>(() => ctx.SaveChangesAsync());
        ctx.ChangeTracker.Clear();

        Assert.Equal(300m, await Saldo(ctx, meta.ContaId!.Value, user));
    }

    [Fact]
    public async Task Caixinha_ContaFixaOuCartaoLigadoAEla_Recusa()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var meta = await Servico(ctx).CriarAsync(MetaDto(), user);

        ctx.Recorrentes.Add(new Recorrente { Id = Guid.NewGuid(), Descricao = "Aluguel", Valor = 100m, Tipo = TipoTransacao.Despesa, ContaId = meta.ContaId, CriadoPor = user, Dia = 5, DataInicio = DateTime.UtcNow });
        await Assert.ThrowsAsync<InvalidOperationException>(() => ctx.SaveChangesAsync());
        ctx.ChangeTracker.Clear();
        ctx.CartoesCredito.Add(new CartaoCredito { Id = Guid.NewGuid(), Nome = "Cartão", ContaId = meta.ContaId, CriadoPor = user });
        await Assert.ThrowsAsync<InvalidOperationException>(() => ctx.SaveChangesAsync());
    }

    [Fact]
    public async Task Caixinha_ListaGeralDeTransacoes_MostraSoAPernaDaContaReal()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var conta = SeedConta(ctx, user, 1000m);
        var svc = Servico(ctx);
        var meta = await svc.CriarAsync(MetaDto("Viagem"), user);
        await svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 300m), user, Chave());
        var transacoes = new TransacaoService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx));

        var lista = (await transacoes.ListarAsync(user, q: "Guardado")).Items;

        Assert.Equal(conta, Assert.Single(lista).ContaId);
        // Pedindo a caixinha de propósito, ela aparece (o filtro é só da lista geral).
        Assert.Single((await transacoes.ListarAsync(user, contaId: meta.ContaId)).Items);
    }

    // ── Prazo, por mês e situação (cálculo puro) ─────────────────────────────

    [Fact]
    public void MesesAte_ContaOMesAtual()
    {
        Assert.Equal(16, MetaService.MesesAte(new DateTime(2027, 12, 1), new DateTime(2026, 9, 18)));
        Assert.Equal(1, MetaService.MesesAte(new DateTime(2026, 9, 1), new DateTime(2026, 9, 30)));
        Assert.Null(MetaService.MesesAte(null, DateTime.UtcNow));
    }

    [Fact]
    public void Situacao_PorMes_RitmoEPrazo()
    {
        var hoje = new DateTime(2026, 9, 18);
        // Monarch: 60 mil até dez/2027 com 2 mil guardados → (60.000 − 2.000) / 16 = 3.625 por mês.
        var (s1, meses, porMes) = MetaService.Situacao(60000m, 2000m, new DateTime(2027, 12, 1), new DateTime(2026, 9, 1), hoje);
        Assert.Equal("no-ritmo", s1); // criada este mês: nada era esperado ainda
        Assert.Equal(16, meses);
        Assert.Equal(3625m, porMes);

        // Criada há 4 meses (de 20 até o prazo): já devia ter 4/20 do alvo = 12.000; com 5.000 está atrás.
        var (s2, _, _) = MetaService.Situacao(60000m, 5000m, new DateTime(2027, 12, 1), new DateTime(2026, 5, 1), hoje);
        Assert.Equal("atras", s2);

        Assert.Equal("prazo-passou", MetaService.Situacao(1000m, 10m, new DateTime(2026, 8, 1), new DateTime(2026, 1, 1), hoje).Situacao);
        Assert.Equal("sem-prazo", MetaService.Situacao(1000m, 10m, null, new DateTime(2026, 1, 1), hoje).Situacao);
        Assert.Equal("concluida", MetaService.Situacao(1000m, 1000m, new DateTime(2026, 8, 1), new DateTime(2026, 1, 1), hoje).Situacao);
        // Arredonda o por mês pra cima no centavo (nunca fica faltando um centavo no fim).
        Assert.Equal(333.34m, MetaService.Situacao(1000m, 0m, new DateTime(2026, 11, 1), new DateTime(2026, 9, 1), hoje).PorMes);
    }

    [Fact]
    public async Task Criar_PrazoNumMesQuePassou_Recusa_EGuardaODia1DoMes()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var svc = Servico(ctx);
        var passado = DateTime.UtcNow.AddMonths(-1);
        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.CriarAsync(new CriarMetaDto("X", null, 100m, passado, null, null), user));
        var futuro = DateTime.UtcNow.AddMonths(3);
        var meta = await svc.CriarAsync(new CriarMetaDto("  Y ", null, 100m, new DateTime(futuro.Year, futuro.Month, 17), null, null), user);
        Assert.Equal("Y", meta.Nome);
        Assert.Equal(1, meta.DataLimite!.Value.Day);
    }

    // ── Excluir (soft delete) ────────────────────────────────────────────────

    [Fact]
    public async Task ExcluirAsync_SoftDelete_PreservaRegistro()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var svc = Servico(ctx);
        var meta = await svc.CriarAsync(MetaDto(), user);

        await svc.ExcluirAsync(meta.Id, user);

        var registro = await ctx.Metas.FindAsync(meta.Id);
        Assert.NotNull(registro);
        Assert.False(registro!.Ativo);
    }

    [Fact]
    public async Task ExcluirAsync_NaoCriador_LancaUnauthorized()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var outro = SeedUsuario(ctx, "outro@test.com");
        var svc = Servico(ctx);
        var meta = await svc.CriarAsync(MetaDto(), dono);

        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.ExcluirAsync(meta.Id, outro));
    }

    // ── Isolamento entre usuários (fix P0 — DonoRecursos) ────────────────────────

    [Fact]
    public async Task CriarAsync_CategoriaDeOutroUsuario_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var outro = SeedUsuario(ctx, "outro@test.com");
        var categoriaDeOutro = new Categoria { Id = Guid.NewGuid(), Descricao = "Privada", Finalidade = Finalidade.Despesa, UsuarioId = outro };
        ctx.Categorias.Add(categoriaDeOutro);
        ctx.SaveChanges();
        var svc = Servico(ctx);

        var dto = new CriarMetaDto("Viagem", null, 1000m, null, null, categoriaDeOutro.Id);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.CriarAsync(dto, user));
    }

    [Fact]
    public async Task AtualizarAsync_CategoriaDeOutroUsuario_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var outro = SeedUsuario(ctx, "outro@test.com");
        var svc = Servico(ctx);
        var criada = await svc.CriarAsync(MetaDto("Original", 1000m), user);

        var categoriaDeOutro = new Categoria { Id = Guid.NewGuid(), Descricao = "Privada", Finalidade = Finalidade.Despesa, UsuarioId = outro };
        ctx.Categorias.Add(categoriaDeOutro);
        ctx.SaveChanges();

        var dto = new CriarMetaDto("Editado", null, 2000m, null, null, categoriaDeOutro.Id);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.AtualizarAsync(criada.Id, dto, user));
    }
}
