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
            Data = DateTime.UtcNow, Descricao = "Reserva"
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
            Data = DateTime.UtcNow, Descricao = "Reserva de emergência"
        }, usuarioId);
        var volta = await service.CriarAsync(new CriarTransferenciaDto
        {
            ContaOrigemId = destino.Id, ContaDestinoId = origem.Id, Valor = 100m,
            Data = DateTime.UtcNow.AddDays(-1), Descricao = "Resgate"
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
            ContaOrigemId = o1.Id, ContaDestinoId = o2.Id, Valor = 10m, Data = DateTime.UtcNow, Descricao = "Reserva"
        }, outroId);
        await service.CriarAsync(new CriarTransferenciaDto
        {
            ContaOrigemId = origem.Id, ContaDestinoId = destino.Id, Valor = 10m, Data = DateTime.UtcNow, Descricao = "Reserva"
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
            Data = DateTime.UtcNow, Descricao = "Reserva"
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
}
