using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Metadados do modelo EF no provider REAL (Npgsql), sem banco. Os testes de serviço rodam em
/// InMemory, que não aplica índice único nem xmin: se alguém apagar o <c>.IsRowVersion()</c> da
/// Fatura ou o <c>.IsUnique()</c> do RegistroIdempotencia, nenhum teste de comportamento quebra — e a
/// proteção contra pagar a fatura em dobro some calada em produção. Aqui o modelo é montado com
/// UseNpgsql e uma connection string que nunca é aberta (montar o modelo não conecta).
/// </summary>
public class AppDbContextModeloNpgsqlTests
{
    private static AppDbContext ContextoNpgsqlSemBanco() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=unused")
            .Options);

    // Modelo de design-time: o de runtime (ctx.Model) é otimizado e pode não carregar todas as
    // anotações relacionais (nome/tipo de coluna) que os asserts leem.
    private static IModel Modelo(AppDbContext ctx) => ctx.GetService<IDesignTimeModel>().Model;

    [Fact]
    public void ModeloEhDoNpgsql_senaoOsOutrosTestesSeriamVazios()
    {
        using var ctx = ContextoNpgsqlSemBanco();

        Assert.Equal("Npgsql.EntityFrameworkCore.PostgreSQL", ctx.Database.ProviderName);
    }

    [Fact]
    public void Fatura_Versao_EhTokenDeConcorrencia_MapeadoNaColunaDeSistemaXmin()
    {
        // É o que faz o UPDATE da fatura sair com "WHERE xmin = @original": sem isto, dois pagamentos
        // simultâneos voltam a ter lost update (ValorPago sobrescrito, pagamento acima do restante).
        using var ctx = ContextoNpgsqlSemBanco();
        var versao = Modelo(ctx).FindEntityType(typeof(Fatura))!.FindProperty(nameof(Fatura.Versao))!;

        Assert.True(versao.IsConcurrencyToken);
        Assert.Equal(ValueGenerated.OnAddOrUpdate, versao.ValueGenerated);
        Assert.Equal("xmin", versao.GetColumnName());
        Assert.Equal("xid", versao.GetColumnType());
    }

    [Fact]
    public void Transacao_Data_EhDate_EHora_EhTimeAnulavel_NaoMaisTimestampUnico()
    {
        // O timestamp único saía sem 'Z' no JSON e o front deslocava +3h (rolava o dia). Dia e hora são
        // colunas separadas SEM fuso: Data = date (obrigatória), Hora = time (null = lançamento sem hora).
        // Em InMemory qualquer tipo "funciona", então só o modelo do Npgsql pega a regressão de volta a timestamp.
        using var ctx = ContextoNpgsqlSemBanco();
        var transacao = Modelo(ctx).FindEntityType(typeof(Transacao))!;

        var data = transacao.FindProperty(nameof(Transacao.Data))!;
        Assert.Equal(typeof(DateOnly), data.ClrType);
        Assert.Equal("date", data.GetColumnType());
        Assert.False(data.IsNullable);

        var hora = transacao.FindProperty(nameof(Transacao.Hora))!;
        Assert.Equal(typeof(TimeOnly?), hora.ClrType);
        Assert.Equal("time without time zone", hora.GetColumnType());
        Assert.True(hora.IsNullable);
    }

    [Fact]
    public void RegistroIdempotencia_IndiceUsuarioOperacaoChave_EhUnico()
    {
        // É o índice único que torna a idempotência atômica: a 2ª requisição simultânea com a mesma
        // chave estoura aqui (23505) e vira replay, em vez de pagar de novo.
        using var ctx = ContextoNpgsqlSemBanco();
        var entidade = Modelo(ctx).FindEntityType(typeof(RegistroIdempotencia))!;
        string[] colunas =
        [
            nameof(RegistroIdempotencia.UsuarioId),
            nameof(RegistroIdempotencia.Operacao),
            nameof(RegistroIdempotencia.Chave),
        ];

        var indice = entidade.GetIndexes()
            .SingleOrDefault(i => i.Properties.Select(p => p.Name).SequenceEqual(colunas));

        Assert.NotNull(indice);
        Assert.True(indice!.IsUnique);
    }
}
