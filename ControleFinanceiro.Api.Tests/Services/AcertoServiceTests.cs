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
            Data = new DateTime(2026, 5, 10), Ativo = true,
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
        Assert.Equal(DateTime.UtcNow.Month, dto.Mes);
        Assert.Equal(DateTime.UtcNow.Year, dto.Ano);
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

        var balanco = await new DespesaCompartilhadaService(ctx, TestHelpers.Notif(ctx))
            .ObterBalancoAsync(familiaId, ana, 5, 2026);

        // Após o acerto, ambos os saldos vão a zero.
        Assert.Equal(0m, balanco.Saldos.First(s => s.UsuarioId == ana).Saldo);
        Assert.Equal(0m, balanco.Saldos.First(s => s.UsuarioId == bia).Saldo);
    }
}
