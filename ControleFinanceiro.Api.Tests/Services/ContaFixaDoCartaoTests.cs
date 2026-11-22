using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Services;

/// <summary>
/// Passo 5 de docs/features/cartao-credito/fatura-a-detalhar.md: cobrança que se repete no cartão vira SUGESTÃO de conta
/// fixa (nunca criada sozinha). "Hoje" = 22/11/2026; cartão fecha dia 1.
/// </summary>
public class ContaFixaDoCartaoTests
{
    private static readonly DateTime Agora = new(2026, 11, 22, 15, 0, 0, DateTimeKind.Utc);

    private sealed record Cenario(AppDbContext Ctx, ContaFixaDoCartaoService Servico, Guid U, Guid CartaoId);

    private static Cenario Build()
    {
        var ctx = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        var u = Guid.NewGuid();
        var cartao = new CartaoCredito { Id = Guid.NewGuid(), Nome = "Nubank", TemCredito = true, DiaFechamento = 1, DiaVencimento = 8, CriadoPor = u, Ativo = true };
        ctx.CartoesCredito.Add(cartao);
        ctx.SaveChanges();
        var transacoes = new TransacaoService(ctx, new FaturaService(ctx), new FinancialEventLogService(ctx));
        var importacao = new ImportacaoService(ctx, new ExtratoImportService(), transacoes);
        return new Cenario(ctx, new ContaFixaDoCartaoService(ctx, importacao), u, cartao.Id);
    }

    /// <summary>Uma compra no ciclo do mês (fatura que fecha no dia 1 do mês seguinte).</summary>
    private static void Compra(Cenario c, string descricao, decimal valor, int ano, int mes, int dia = 10)
    {
        var fechamento = new DateTime(ano, mes, 1).AddMonths(1);
        var fatura = c.Ctx.Faturas.FirstOrDefault(f => f.CartaoCreditoId == c.CartaoId && f.DataFechamento == fechamento);
        if (fatura is null)
        {
            fatura = new Fatura { Id = Guid.NewGuid(), CartaoCreditoId = c.CartaoId, DataInicio = fechamento.AddMonths(-1), DataFechamento = fechamento, DataVencimento = fechamento.AddDays(7), CriadoPor = c.U };
            c.Ctx.Faturas.Add(fatura);
        }
        c.Ctx.Transacoes.Add(new Transacao
        {
            Id = Guid.NewGuid(), Descricao = descricao, Valor = valor, Tipo = TipoTransacao.Despesa, CartaoCreditoId = c.CartaoId,
            FaturaId = fatura.Id, UsadoComoCredito = true, CriadoPor = c.U, Data = new DateOnly(ano, mes, dia),
            StatusTransacao = StatusTransacao.Executado, Ativo = true,
        });
        c.Ctx.SaveChanges();
    }

    [Fact]
    public async Task TresFaturasSeguidasComValorParecido_ViraSugestao_SemCriarNada()
    {
        using var _ = HorarioBrasil.FixarParaTeste(Agora);
        var c = Build();
        Compra(c, "Claude.ai Subscription", 110m, 2026, 8);
        Compra(c, "Claude.ai Subscription", 110m, 2026, 9);
        Compra(c, "Claude.ai Subscription", 112m, 2026, 10);
        Compra(c, "Claude.ai Subscription", 115m, 2026, 11);
        Compra(c, "Padaria", 30m, 2026, 10); // uma vez só

        var s = Assert.Single(await c.Servico.SugestoesAsync(c.CartaoId, c.U));

        Assert.Equal((115m, 4, new DateOnly(2026, 11, 10)), (s.Valor, s.Meses, s.Ultima));
        Assert.Empty(c.Ctx.Recorrentes);
    }

    [Fact]
    public async Task ValorQueVariaMuito_OuSoDuasFaturas_OuParouDeCobrar_NaoSugere()
    {
        using var _ = HorarioBrasil.FixarParaTeste(Agora);
        var c = Build();
        foreach (var (v, m) in new[] { (40m, 8), (95m, 9), (22m, 10), (60m, 11) }) Compra(c, "Uber Trip", v, 2026, m);
        Compra(c, "Spotify", 21.90m, 2026, 10);
        Compra(c, "Spotify", 21.90m, 2026, 11);
        foreach (var m in new[] { 3, 4, 5, 6 }) Compra(c, "Academia Antiga", 99m, 2026, m);

        Assert.Empty(await c.Servico.SugestoesAsync(c.CartaoId, c.U));
    }

    [Fact]
    public async Task JaEContaFixa_OuDispensada_NaoVolta()
    {
        using var _ = HorarioBrasil.FixarParaTeste(Agora);
        var c = Build();
        foreach (var m in new[] { 9, 10, 11 }) { Compra(c, "Netflix.com", 44.90m, 2026, m); Compra(c, "Claude.ai Subscription", 110m, 2026, m); }
        c.Ctx.Recorrentes.Add(new Recorrente { Id = Guid.NewGuid(), Descricao = "Netflix.com", Valor = 44.90m, CartaoCreditoId = c.CartaoId, CriadoPor = c.U, Ativo = true, Dia = 10 });
        c.Ctx.SaveChanges();

        var antes = Assert.Single(await c.Servico.SugestoesAsync(c.CartaoId, c.U));
        await c.Servico.DispensarAsync(c.CartaoId, c.U, antes.Chave);
        await c.Servico.DispensarAsync(c.CartaoId, c.U, antes.Chave); // repetir não duplica

        Assert.Empty(await c.Servico.SugestoesAsync(c.CartaoId, c.U));
        Assert.Single(c.Ctx.SugestoesContaFixaDispensadas);
    }

    [Fact]
    public async Task CartaoDeOutraPessoa_NaoEncontrado()
    {
        var c = Build();
        await Assert.ThrowsAsync<KeyNotFoundException>(() => c.Servico.SugestoesAsync(c.CartaoId, Guid.NewGuid()));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => c.Servico.DispensarAsync(c.CartaoId, Guid.NewGuid(), "d:x"));
    }

    [Fact]
    public void FaltaDetalhar_EOPagoAcimaDoTotal_NuncaNegativo()
    {
        Assert.Equal(0.03m, RegrasFinanceiras.ValorADetalharFatura(3273.77m, 3273.80m));
        Assert.Equal(0m, RegrasFinanceiras.ValorADetalharFatura(500m, 300m));
    }
}
