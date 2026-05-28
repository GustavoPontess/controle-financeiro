using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Orcamento;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class OrcamentoServiceTests
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

    private static Guid SeedUsuario(AppDbContext ctx, string email = "u@test.com")
    {
        var u = new Usuario { Id = Guid.NewGuid(), Email = email, Nome = "User", PasswordHash = "x" };
        ctx.Usuarios.Add(u);
        ctx.SaveChanges();
        return u.Id;
    }

    private static Guid SeedCategoria(AppDbContext ctx, string nome = "Alimentação")
    {
        var c = new Categoria { Id = Guid.NewGuid(), Descricao = nome, Finalidade = Finalidade.Despesa };
        ctx.Categorias.Add(c);
        ctx.SaveChanges();
        return c.Id;
    }

    private static CriarOrcamentoDto OrcDto(Guid? categoriaId = null, decimal limite = 1000m,
        int mes = 5, int ano = 2026, decimal alerta = 80m) =>
        new() { CategoriaId = categoriaId, ValorLimite = limite, Mes = mes, Ano = ano, PercentualAlerta = alerta };

    // ── Criar ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CriarAsync_Valido_PersisteOrcamento()
    {
        var ctx = CreateContext();
        var userId = SeedUsuario(ctx);
        var catId = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);

        var result = await svc.CriarAsync(OrcDto(catId), userId);

        Assert.Equal(catId, result.CategoriaId);
        Assert.Equal(1000m, result.ValorLimite);
        Assert.Equal(80m, result.PercentualAlerta);
        Assert.Equal(0m, result.ValorGasto);
        Assert.False(result.EmAlerta);
        Assert.False(result.Ultrapassado);
    }

    [Fact]
    public async Task CriarAsync_SemCategoria_CriaOrcamentoGeral()
    {
        var ctx = CreateContext();
        var userId = SeedUsuario(ctx);
        var svc = new OrcamentoService(ctx);

        var result = await svc.CriarAsync(OrcDto(null), userId);

        Assert.Null(result.CategoriaId);
    }

    [Fact]
    public async Task CriarAsync_Duplicado_LancaInvalidOperation()
    {
        var ctx = CreateContext();
        var userId = SeedUsuario(ctx);
        var catId = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);

        await svc.CriarAsync(OrcDto(catId), userId);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => svc.CriarAsync(OrcDto(catId), userId));
    }

    [Fact]
    public async Task CriarAsync_ValorLimiteZero_LancaArgumentException()
    {
        var ctx = CreateContext();
        var userId = SeedUsuario(ctx);
        var svc = new OrcamentoService(ctx);

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.CriarAsync(OrcDto(null, limite: 0m), userId));
    }

    [Fact]
    public async Task CriarAsync_MesInvalido_LancaArgumentException()
    {
        var ctx = CreateContext();
        var userId = SeedUsuario(ctx);
        var svc = new OrcamentoService(ctx);

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.CriarAsync(OrcDto(null, mes: 13), userId));
    }

    [Fact]
    public async Task CriarAsync_PercentualAlertaForaDoRange_LancaArgumentException()
    {
        var ctx = CreateContext();
        var userId = SeedUsuario(ctx);
        var svc = new OrcamentoService(ctx);

        await Assert.ThrowsAsync<ArgumentException>(
            () => svc.CriarAsync(OrcDto(null, alerta: 0m), userId));
    }

    // ── Listar ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListarAsync_SemTransacoes_RetornaGastoZero()
    {
        var ctx = CreateContext();
        var userId = SeedUsuario(ctx);
        var catId = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);

        await svc.CriarAsync(OrcDto(catId, mes: 5, ano: 2026), userId);
        var lista = await svc.ListarAsync(userId, 5, 2026);

        Assert.Single(lista);
        Assert.Equal(0m, lista[0].ValorGasto);
        Assert.Equal(1000m, lista[0].ValorRestante);
        Assert.Equal(0m, lista[0].PercentualConsumido);
        Assert.False(lista[0].EmAlerta);
    }

    [Fact]
    public async Task ListarAsync_ComDespesaExecutada_ComputaGastoCorreto()
    {
        var ctx = CreateContext();
        var userId = SeedUsuario(ctx);
        var catId = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);

        // Cria orçamento
        await svc.CriarAsync(OrcDto(catId, limite: 1000m, mes: 5, ano: 2026), userId);

        // Adiciona despesa executada na mesma categoria/mês
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = "Almoço",
            Valor = 300m,
            Tipo = TipoTransacao.Despesa,
            CategoriaId = catId,
            CriadoPor = userId,
            Data = new DateTime(2026, 5, 10, 12, 0, 0, DateTimeKind.Utc),
            StatusTransacao = StatusTransacao.Executado,
            Ativo = true,
        });
        await ctx.SaveChangesAsync();

        var lista = await svc.ListarAsync(userId, 5, 2026);

        Assert.Equal(300m, lista[0].ValorGasto);
        Assert.Equal(700m, lista[0].ValorRestante);
        Assert.Equal(30m, lista[0].PercentualConsumido);
        Assert.False(lista[0].EmAlerta);
        Assert.False(lista[0].Ultrapassado);
    }

    [Fact]
    public async Task ListarAsync_GastoAcimaDo80Pct_EmAlerta()
    {
        var ctx = CreateContext();
        var userId = SeedUsuario(ctx);
        var catId = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);

        await svc.CriarAsync(OrcDto(catId, limite: 1000m, mes: 5, ano: 2026, alerta: 80m), userId);

        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = "Mercado",
            Valor = 850m,
            Tipo = TipoTransacao.Despesa,
            CategoriaId = catId,
            CriadoPor = userId,
            Data = new DateTime(2026, 5, 15, 0, 0, 0, DateTimeKind.Utc),
            StatusTransacao = StatusTransacao.Executado,
            Ativo = true,
        });
        await ctx.SaveChangesAsync();

        var lista = await svc.ListarAsync(userId, 5, 2026);

        Assert.Equal(850m, lista[0].ValorGasto);
        Assert.True(lista[0].EmAlerta);
        Assert.False(lista[0].Ultrapassado);
    }

    [Fact]
    public async Task ListarAsync_GastoAcimaDoLimite_Ultrapassado()
    {
        var ctx = CreateContext();
        var userId = SeedUsuario(ctx);
        var catId = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);

        await svc.CriarAsync(OrcDto(catId, limite: 500m, mes: 5, ano: 2026), userId);

        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = "Gasto excessivo",
            Valor = 600m,
            Tipo = TipoTransacao.Despesa,
            CategoriaId = catId,
            CriadoPor = userId,
            Data = new DateTime(2026, 5, 20, 0, 0, 0, DateTimeKind.Utc),
            StatusTransacao = StatusTransacao.Executado,
            Ativo = true,
        });
        await ctx.SaveChangesAsync();

        var lista = await svc.ListarAsync(userId, 5, 2026);

        Assert.True(lista[0].Ultrapassado);
        Assert.True(lista[0].EmAlerta);
        Assert.Equal(-100m, lista[0].ValorRestante);
    }

    [Fact]
    public async Task ListarAsync_TransferenciaEhExcluida()
    {
        var ctx = CreateContext();
        var userId = SeedUsuario(ctx);
        var catId = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);

        await svc.CriarAsync(OrcDto(catId, limite: 1000m, mes: 5, ano: 2026), userId);

        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = "Transferência",
            Valor = 500m,
            Tipo = TipoTransacao.Despesa,
            CategoriaId = catId,
            CriadoPor = userId,
            Data = new DateTime(2026, 5, 5, 0, 0, 0, DateTimeKind.Utc),
            StatusTransacao = StatusTransacao.Executado,
            Ativo = true,
            EhTransferencia = true,
        });
        await ctx.SaveChangesAsync();

        var lista = await svc.ListarAsync(userId, 5, 2026);

        Assert.Equal(0m, lista[0].ValorGasto); // transferência não conta
    }

    [Fact]
    public async Task ListarAsync_TransacaoPrevisao_EhExcluida()
    {
        var ctx = CreateContext();
        var userId = SeedUsuario(ctx);
        var catId = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);

        await svc.CriarAsync(OrcDto(catId, limite: 1000m, mes: 5, ano: 2026), userId);

        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = "Assinatura futura",
            Valor = 200m,
            Tipo = TipoTransacao.Despesa,
            CategoriaId = catId,
            CriadoPor = userId,
            Data = new DateTime(2026, 5, 28, 0, 0, 0, DateTimeKind.Utc),
            StatusTransacao = StatusTransacao.Previsao,
            Ativo = true,
        });
        await ctx.SaveChangesAsync();

        var lista = await svc.ListarAsync(userId, 5, 2026);

        Assert.Equal(0m, lista[0].ValorGasto);
    }

    [Fact]
    public async Task ListarAsync_OutroPeriodo_NaoContaGasto()
    {
        var ctx = CreateContext();
        var userId = SeedUsuario(ctx);
        var catId = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);

        await svc.CriarAsync(OrcDto(catId, limite: 1000m, mes: 5, ano: 2026), userId);

        // Despesa em ABRIL, não maio
        ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(),
            Descricao = "Gasto em abril",
            Valor = 400m,
            Tipo = TipoTransacao.Despesa,
            CategoriaId = catId,
            CriadoPor = userId,
            Data = new DateTime(2026, 4, 20, 0, 0, 0, DateTimeKind.Utc),
            StatusTransacao = StatusTransacao.Executado,
            Ativo = true,
        });
        await ctx.SaveChangesAsync();

        var lista = await svc.ListarAsync(userId, 5, 2026);

        Assert.Equal(0m, lista[0].ValorGasto);
    }

    // ── Atualizar ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task AtualizarAsync_Valido_AlteraLimite()
    {
        var ctx = CreateContext();
        var userId = SeedUsuario(ctx);
        var catId = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);

        var criado = await svc.CriarAsync(OrcDto(catId, limite: 1000m), userId);
        var atualizado = await svc.AtualizarAsync(criado.Id, OrcDto(catId, limite: 2000m), userId);

        Assert.Equal(2000m, atualizado.ValorLimite);
    }

    [Fact]
    public async Task AtualizarAsync_OutroUsuario_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var userId = SeedUsuario(ctx, "u1@test.com");
        var outro = SeedUsuario(ctx, "u2@test.com");
        var catId = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);

        var criado = await svc.CriarAsync(OrcDto(catId), userId);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.AtualizarAsync(criado.Id, OrcDto(catId, limite: 999m), outro));
    }

    // ── Deletar ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task DeletarAsync_Valido_RemoveOrcamento()
    {
        var ctx = CreateContext();
        var userId = SeedUsuario(ctx);
        var catId = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);

        var criado = await svc.CriarAsync(OrcDto(catId), userId);
        await svc.DeletarAsync(criado.Id, userId);

        var lista = await svc.ListarAsync(userId, 5, 2026);
        Assert.Empty(lista);
    }

    [Fact]
    public async Task DeletarAsync_OutroUsuario_LancaKeyNotFound()
    {
        var ctx = CreateContext();
        var userId = SeedUsuario(ctx, "u1@test.com");
        var outro = SeedUsuario(ctx, "u2@test.com");
        var catId = SeedCategoria(ctx);
        var svc = new OrcamentoService(ctx);

        var criado = await svc.CriarAsync(OrcDto(catId), userId);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.DeletarAsync(criado.Id, outro));
    }
}
