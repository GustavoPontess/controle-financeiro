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
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
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
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
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
    public async Task ToggleAtivoAsync_OutroUsuario_LancaUnauthorizedAccessException()
    {
        var ctx = CreateContext();
        var u1 = SeedUsuario(ctx);
        var u2 = SeedUsuario(ctx);
        var c = SeedConta(ctx, u1);
        var rec = SeedRecorrente(ctx, u1, c);

        var svc = CreateService(ctx);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
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
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
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
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            svc.AtualizarAsync(rec.Id, dto, u2));
    }
}
