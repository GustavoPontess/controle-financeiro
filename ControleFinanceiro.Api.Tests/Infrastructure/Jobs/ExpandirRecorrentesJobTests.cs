using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Jobs;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure.Jobs;

/// <summary>
/// Regressão do fix de isolamento (P0): antes, uma Recorrente com referência inválida (ex.: cartão de
/// OUTRO usuário, gravada antes de existir a checagem de dono em RecorrenteService) derrubava a
/// expansão de TODOS os usuários assim que <c>ObterOuCriarFaturaAsync</c> lançava — uma linha ruim
/// travava o job inteiro. Agora o ExpandirRecorrentesJob captura o <see cref="KeyNotFoundException"/>
/// por recorrente, loga warning e segue expandindo as demais.
/// </summary>
public class ExpandirRecorrentesJobTests
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

    private static Recorrente NovaRecorrente(Guid criadoPor, Guid? contaId = null, Guid? cartaoId = null) => new()
    {
        Id = Guid.NewGuid(),
        Descricao = "Aluguel",
        Valor = 1000m,
        Tipo = TipoTransacao.Despesa,
        ContaId = contaId,
        CartaoCreditoId = cartaoId,
        Frequencia = FrequenciaRecorrencia.Mensal,
        Dia = 1,
        DataInicio = DateTime.UtcNow.Date.AddMonths(-1),
        Ativo = true,
        CriadoPor = criadoPor,
        CriadoEm = DateTime.UtcNow,
    };

    [Fact]
    public async Task ExecuteAsync_RecorrenteComCartaoDeOutroUsuario_EhPulada_DemaisSaoExpandidas()
    {
        var ctx = CreateContext();

        var usuario1 = Guid.NewGuid();
        var usuario2 = Guid.NewGuid();

        // Recorrente válida do usuário 1 (conta própria) — deve gerar previsões normalmente.
        var contaU1 = new Conta { Id = Guid.NewGuid(), Nome = "Conta", UsuarioIdProprietario = usuario1, Tipo = TipoConta.ContaCorrente };
        ctx.Contas.Add(contaU1);
        var recorrenteValida = NovaRecorrente(usuario1, contaId: contaU1.Id);
        ctx.Recorrentes.Add(recorrenteValida);

        // Cartão pertence ao usuário 2.
        var cartaoU2 = new CartaoCredito { Id = Guid.NewGuid(), Nome = "Cartão U2", CriadoPor = usuario2, Ativo = true, TemCredito = true };
        ctx.CartoesCredito.Add(cartaoU2);

        // Recorrente "ruim": CriadoPor=usuario1 mas aponta pro cartão do usuario2 — simula dado
        // gravado ANTES do fix (a checagem de dono não existia em RecorrenteService.AtualizarAsync).
        var recorrenteInvalida = NovaRecorrente(usuario1, cartaoId: cartaoU2.Id);
        ctx.Recorrentes.Add(recorrenteInvalida);

        await ctx.SaveChangesAsync();

        var job = new ExpandirRecorrentesJob(ctx, new FaturaService(ctx), new RecorrenteService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx), new HttpContextAccessor()), NullLogger<ExpandirRecorrentesJob>.Instance);

        // Não pode lançar mesmo com a recorrente inválida na leva — essa é a regressão.
        await job.ExecuteAsync();

        var transacoesValida = await ctx.Transacoes
            .Where(t => t.RecorrenteOrigemId == recorrenteValida.Id)
            .ToListAsync();
        Assert.NotEmpty(transacoesValida);
        Assert.All(transacoesValida, t => Assert.Equal(StatusTransacao.Previsao, t.StatusTransacao));

        var transacoesInvalida = await ctx.Transacoes
            .Where(t => t.RecorrenteOrigemId == recorrenteInvalida.Id)
            .ToListAsync();
        Assert.Empty(transacoesInvalida);

        // A recorrente inválida falhou já na 1ª iteração — DataProximaGeracao nunca avançou.
        var invalidaDb = await ctx.Recorrentes.FindAsync(recorrenteInvalida.Id);
        Assert.Null(invalidaDb!.DataProximaGeracao);

        // A válida teve DataProximaGeracao avançada normalmente.
        var validaDb = await ctx.Recorrentes.FindAsync(recorrenteValida.Id);
        Assert.NotNull(validaDb!.DataProximaGeracao);
    }
}
