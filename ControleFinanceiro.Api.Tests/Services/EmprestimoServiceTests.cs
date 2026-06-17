using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.DTOs.Emprestimo;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

public class EmprestimoServiceTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static CriarEmprestimoDto DtoValido() => new()
    {
        Descricao = "Empréstimo para João",
        Pessoa = "João",
        ValorTotal = 500,
        Tipo = TipoEmprestimo.Emprestei,
        DataInicio = DateTime.UtcNow,
        DataVencimento = DateTime.UtcNow.AddDays(30),
    };

    [Fact]
    public async Task CriarAsync_ValorZero_LancaException()
    {
        var svc = new EmprestimoService(CreateContext());
        var dto = DtoValido();
        dto.ValorTotal = 0;

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(dto, Guid.NewGuid()));
        Assert.Contains("positivo", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_ValorNegativo_LancaException()
    {
        var svc = new EmprestimoService(CreateContext());
        var dto = DtoValido();
        dto.ValorTotal = -100;

        await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(dto, Guid.NewGuid()));
    }

    [Fact]
    public async Task CriarAsync_DataVencimentoAnteriorInicio_LancaException()
    {
        var svc = new EmprestimoService(CreateContext());
        var dto = DtoValido();
        dto.DataInicio = DateTime.UtcNow;
        dto.DataVencimento = DateTime.UtcNow.AddDays(-1);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.CriarAsync(dto, Guid.NewGuid()));
        Assert.Contains("anterior", ex.Message);
    }

    [Fact]
    public async Task CriarAsync_DadosValidos_CriaSucesso()
    {
        var ctx = CreateContext();
        var svc = new EmprestimoService(ctx);
        var usuarioId = Guid.NewGuid();

        var resultado = await svc.CriarAsync(DtoValido(), usuarioId);

        Assert.Equal(500, resultado.ValorTotal);
        Assert.Equal(0, resultado.ValorPago);
        Assert.False(resultado.Quitado);
        Assert.Equal(1, await ctx.Emprestimos.CountAsync());
    }

    [Fact]
    public async Task CriarAsync_SemDataVencimento_CriaSucesso()
    {
        var svc = new EmprestimoService(CreateContext());
        var dto = DtoValido();
        dto.DataVencimento = null;

        var resultado = await svc.CriarAsync(dto, Guid.NewGuid());

        Assert.Null(resultado.DataVencimento);
        Assert.False(resultado.Vencido);
    }

    [Fact]
    public async Task RegistrarPagamentoAsync_ValorZero_LancaException()
    {
        var ctx = CreateContext();
        var svc = new EmprestimoService(ctx);
        var usuarioId = Guid.NewGuid();
        var resultado = await svc.CriarAsync(DtoValido(), usuarioId);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.RegistrarPagamentoAsync(resultado.Id, 0, usuarioId));
        Assert.Contains("positivo", ex.Message);
    }

    [Fact]
    public async Task RegistrarPagamentoAsync_ValorNegativo_LancaException()
    {
        var ctx = CreateContext();
        var svc = new EmprestimoService(ctx);
        var usuarioId = Guid.NewGuid();
        var resultado = await svc.CriarAsync(DtoValido(), usuarioId);

        await Assert.ThrowsAsync<ArgumentException>(() => svc.RegistrarPagamentoAsync(resultado.Id, -50, usuarioId));
    }

    [Fact]
    public async Task RegistrarPagamentoAsync_ValorParcial_AtualizaValorPago()
    {
        var ctx = CreateContext();
        var svc = new EmprestimoService(ctx);
        var usuarioId = Guid.NewGuid();
        var criado = await svc.CriarAsync(DtoValido(), usuarioId);

        await svc.RegistrarPagamentoAsync(criado.Id, 200, usuarioId);

        var emprestimo = await ctx.Emprestimos.FindAsync(criado.Id);
        Assert.Equal(200, emprestimo!.ValorPago);
        Assert.False(emprestimo.Quitado);
    }

    [Fact]
    public async Task RegistrarPagamentoAsync_ValorTotal_QuitaEmprestimo()
    {
        var ctx = CreateContext();
        var svc = new EmprestimoService(ctx);
        var usuarioId = Guid.NewGuid();
        var criado = await svc.CriarAsync(DtoValido(), usuarioId);

        await svc.RegistrarPagamentoAsync(criado.Id, 500, usuarioId);

        var emprestimo = await ctx.Emprestimos.FindAsync(criado.Id);
        Assert.True(emprestimo!.Quitado);
        Assert.Equal(500, emprestimo.ValorPago);
    }

    // ── Stats (#179) ──────────────────────────────────────────────────────────

    [Fact]
    public async Task ObterStatsAsync_AgregaSomenteDoUsuario()
    {
        var ctx = CreateContext();
        var svc = new EmprestimoService(ctx);
        var uid = Guid.NewGuid();
        var outroUid = Guid.NewGuid();

        // Usuário: 2 emprestou ativos (200 + 300), 1 peguei ativo (500), 1 quitado.
        await svc.CriarAsync(new() { Descricao = "A", Pessoa = "X", ValorTotal = 200, Tipo = TipoEmprestimo.Emprestei, DataInicio = DateTime.UtcNow }, uid);
        await svc.CriarAsync(new() { Descricao = "B", Pessoa = "Y", ValorTotal = 300, Tipo = TipoEmprestimo.Emprestei, DataInicio = DateTime.UtcNow }, uid);
        await svc.CriarAsync(new() { Descricao = "C", Pessoa = "Z", ValorTotal = 500, Tipo = TipoEmprestimo.PeguiEmprestado, DataInicio = DateTime.UtcNow }, uid);
        var quitado = await svc.CriarAsync(new() { Descricao = "D", Pessoa = "W", ValorTotal = 100, Tipo = TipoEmprestimo.Emprestei, DataInicio = DateTime.UtcNow }, uid);
        await svc.QuitarAsync(quitado.Id, uid);

        // Outro usuário — não deve entrar no cálculo.
        await svc.CriarAsync(new() { Descricao = "X", Pessoa = "X", ValorTotal = 999, Tipo = TipoEmprestimo.Emprestei, DataInicio = DateTime.UtcNow }, outroUid);

        var stats = await svc.ObterStatsAsync(uid);

        Assert.Equal(500m, stats.TotalAReceber);   // 200 + 300
        Assert.Equal(500m, stats.TotalAPagar);     // 500
        Assert.Equal(3, stats.Ativos);             // 2 emprestei + 1 peguei (quitado fora)
        Assert.Equal(4, stats.QtdTotal);           // todos do uid, incluindo quitado
    }

    [Fact]
    public async Task ObterStatsAsync_SemEmprestimos_RetornaZero()
    {
        var svc = new EmprestimoService(CreateContext());
        var stats = await svc.ObterStatsAsync(Guid.NewGuid());

        Assert.Equal(0m, stats.TotalAReceber);
        Assert.Equal(0m, stats.TotalAPagar);
        Assert.Equal(0, stats.Ativos);
        Assert.Equal(0, stats.QtdTotal);
    }
}
