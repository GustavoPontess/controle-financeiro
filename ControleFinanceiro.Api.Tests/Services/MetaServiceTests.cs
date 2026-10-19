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
        var svc = new MetaService(ctx);

        var dto = await svc.CriarAsync(MetaDto("Casa", 100_000m), user);

        Assert.Equal("Casa", dto.Nome);
        Assert.Equal(100_000m, dto.ValorAlvo);
        Assert.Equal(0m, dto.ValorAtual);
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
        var svc = new MetaService(ctx);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.CriarAsync(MetaDto(familiaId: familiaId), estranho));
    }

    [Fact]
    public async Task CriarAsync_FamiliaIdMembro_Persiste()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = new MetaService(ctx);

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
        var svc = new MetaService(ctx);

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
        var svc = new MetaService(ctx);

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
        var svc = new MetaService(ctx);
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
        var svc = new MetaService(ctx);
        var criada = await svc.CriarAsync(MetaDto(), dono);

        await Assert.ThrowsAsync<ForbiddenAccessException>(
            () => svc.AtualizarAsync(criada.Id, MetaDto(), outro));
    }

    // ── Guardar / tirar (reserva do saldo de conta real) ─────────────────────

    private static string Chave() => Guid.NewGuid().ToString();

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

    [Fact]
    public async Task Guardar_ReservaDoSaldo_SemCriarLancamento_ESomaNaMesmaConta()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var conta = SeedConta(ctx, user, 1000m);
        var svc = new MetaService(ctx);
        var meta = await svc.CriarAsync(MetaDto("Viagem", 1000m), user);
        var lancamentosAntes = ctx.Transacoes.Count();

        await svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 300m), user, Chave());
        var result = await svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 200m), user, Chave());

        Assert.Equal(500m, result.Guardado);
        Assert.Equal(500m, result.ValorAtual);
        Assert.Equal(500m, result.Falta);
        Assert.Equal(50m, result.PercentualConcluido);
        var reserva = Assert.Single(result.Reservas);
        Assert.Equal(conta, reserva.ContaId);
        Assert.Equal(500m, reserva.Valor);
        Assert.Equal(lancamentosAntes, ctx.Transacoes.Count()); // nada de dinheiro inventado
        var livre = (await svc.ContasLivresAsync(user)).Single();
        Assert.Equal(1000m, livre.Saldo);
        Assert.Equal(500m, livre.Reservado);
        Assert.Equal(500m, livre.Livre);
    }

    [Fact]
    public async Task Guardar_NaoPassaDoLivreDaConta_ContandoOutrasMetas()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var conta = SeedConta(ctx, user, 1000m);
        var svc = new MetaService(ctx);
        var a = await svc.CriarAsync(MetaDto("A", 5000m), user);
        var b = await svc.CriarAsync(MetaDto("B", 5000m), user);
        await svc.GuardarAsync(a.Id, new MovimentoMetaDto(conta, 800m), user, Chave());

        var erro = await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.GuardarAsync(b.Id, new MovimentoMetaDto(conta, 201m), user, Chave()));
        Assert.Contains("livre", erro.Message);
        var ok = await svc.GuardarAsync(b.Id, new MovimentoMetaDto(conta, 200m), user, Chave());
        Assert.Equal(200m, ok.Guardado);
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.GuardarAsync(a.Id, new MovimentoMetaDto(conta, 1m), user, Chave()));
    }

    [Fact]
    public async Task Guardar_ContaDeOutroOuEncerrada_Recusa()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var outro = SeedUsuario(ctx, "outro@test.com");
        var contaDoOutro = SeedConta(ctx, outro, 1000m);
        var encerrada = SeedConta(ctx, user, 1000m, "Velha", encerrada: true);
        var svc = new MetaService(ctx);
        var meta = await svc.CriarAsync(MetaDto(), user);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.GuardarAsync(meta.Id, new MovimentoMetaDto(contaDoOutro, 10m), user, Chave()));
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.GuardarAsync(meta.Id, new MovimentoMetaDto(encerrada, 10m), user, Chave()));
        Assert.Empty(ctx.MetasReservas);
    }

    [Fact]
    public async Task Guardar_MesmaChave_NaoReservaDuasVezes_SemChaveRecusa()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var conta = SeedConta(ctx, user, 1000m);
        var svc = new MetaService(ctx);
        var meta = await svc.CriarAsync(MetaDto(), user);
        var outra = await svc.CriarAsync(MetaDto("Outra"), user);
        var chave = Chave();

        await svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 100m), user, chave);
        var repetido = await svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 100m), user, chave);

        Assert.Equal(100m, repetido.Guardado);
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.GuardarAsync(outra.Id, new MovimentoMetaDto(conta, 100m), user, chave));
        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 100m), user, null));
    }

    [Fact]
    public async Task Tirar_SoltaAReserva_EApagaAoZerar_NaoPassaDoReservado()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var conta = SeedConta(ctx, user, 1000m);
        var svc = new MetaService(ctx);
        var meta = await svc.CriarAsync(MetaDto(), user);
        await svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 400m), user, Chave());

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.TirarAsync(meta.Id, new MovimentoMetaDto(conta, 401m), user, Chave()));
        var parcial = await svc.TirarAsync(meta.Id, new MovimentoMetaDto(conta, 150m), user, Chave());
        Assert.Equal(250m, parcial.Guardado);
        var zerado = await svc.TirarAsync(meta.Id, new MovimentoMetaDto(conta, 250m), user, Chave());
        Assert.Equal(0m, zerado.Guardado);
        Assert.Empty(ctx.MetasReservas);
        Assert.Equal(1000m, (await svc.ContasLivresAsync(user)).Single().Livre);
    }

    [Fact]
    public async Task Guardar_AtingeAlvo_MarcaConcluida_PercentualCapado()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var conta = SeedConta(ctx, user, 1000m);
        var svc = new MetaService(ctx);
        var meta = await svc.CriarAsync(MetaDto("X", 100m), user);

        var result = await svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 150m), user, Chave());

        Assert.Equal(100m, result.PercentualConcluido);
        Assert.True(result.Concluida);
        Assert.Equal("concluida", result.Situacao);
        Assert.Equal(0m, result.Falta);
    }

    [Fact]
    public async Task MembroDaFamilia_GuardaDaPropriaConta_NaMetaDaFamilia()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var bia = SeedUsuario(ctx, "bia@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        ctx.MembrosFamilia.Add(new MembroFamilia
        {
            Id = Guid.NewGuid(), FamiliaId = familiaId, UsuarioId = bia,
            Papel = "Membro", EntrouEm = DateTime.UtcNow, Ativo = true,
        });
        ctx.SaveChanges();
        var contaBia = SeedConta(ctx, bia, 1000m, "Conta da Bia");
        var contaDono = SeedConta(ctx, dono, 1000m, "Conta do dono");
        var svc = new MetaService(ctx);
        var meta = await svc.CriarAsync(MetaDto("Conjunta", 1000m, familiaId), dono);

        var result = await svc.GuardarAsync(meta.Id, new MovimentoMetaDto(contaBia, 400m), bia, Chave());
        Assert.Equal(400m, result.Guardado);
        // A Bia não reserva da conta do dono
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.GuardarAsync(meta.Id, new MovimentoMetaDto(contaDono, 1m), bia, Chave()));
    }

    [Fact]
    public async Task Excluir_SoltaAsReservas()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var conta = SeedConta(ctx, user, 1000m);
        var svc = new MetaService(ctx);
        var meta = await svc.CriarAsync(MetaDto(), user);
        await svc.GuardarAsync(meta.Id, new MovimentoMetaDto(conta, 600m), user, Chave());

        await svc.ExcluirAsync(meta.Id, user);

        Assert.Empty(ctx.MetasReservas);
        Assert.Equal(1000m, (await svc.ContasLivresAsync(user)).Single().Livre);
    }

    [Fact]
    public async Task Listar_SoPessoais_TiraAsDeFamilia()
    {
        var ctx = CreateContext();
        var dono = SeedUsuario(ctx, "dono@test.com");
        var familiaId = await SeedFamilia(ctx, dono);
        var svc = new MetaService(ctx);
        await svc.CriarAsync(MetaDto("Minha"), dono);
        await svc.CriarAsync(MetaDto("Da casa", 1000m, familiaId), dono);

        var pessoais = await svc.ListarAsync(dono, soPessoais: true);

        Assert.Equal("Minha", Assert.Single(pessoais).Nome);
        Assert.Equal(2, (await svc.ListarAsync(dono)).Count);
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
        var svc = new MetaService(ctx);
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
        var svc = new MetaService(ctx);
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
        var svc = new MetaService(ctx);
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
        var svc = new MetaService(ctx);

        var dto = new CriarMetaDto("Viagem", null, 1000m, null, null, categoriaDeOutro.Id);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.CriarAsync(dto, user));
    }

    [Fact]
    public async Task AtualizarAsync_CategoriaDeOutroUsuario_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var user = SeedUsuario(ctx, "u@test.com");
        var outro = SeedUsuario(ctx, "outro@test.com");
        var svc = new MetaService(ctx);
        var criada = await svc.CriarAsync(MetaDto("Original", 1000m), user);

        var categoriaDeOutro = new Categoria { Id = Guid.NewGuid(), Descricao = "Privada", Finalidade = Finalidade.Despesa, UsuarioId = outro };
        ctx.Categorias.Add(categoriaDeOutro);
        ctx.SaveChanges();

        var dto = new CriarMetaDto("Editado", null, 2000m, null, null, categoriaDeOutro.Id);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.AtualizarAsync(criada.Id, dto, user));
    }
}
