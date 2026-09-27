using System.Text;
using System.Text.Json;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Middleware;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Middleware;

/// <summary>
/// Regressão do C2: exceções de domínio mapeiam pro status HTTP certo e o ramo 500
/// NUNCA ecoa a mensagem da exceção (vazaria detalhe interno — EF/Npgsql/SQL).
/// </summary>
public class GlobalExceptionHandlerMiddlewareTests
{
    private static async Task<(int status, ErrorResponseDto body)> Invoke(Exception toThrow)
    {
        var ctx = new DefaultHttpContext();
        ctx.Response.Body = new MemoryStream();

        var middleware = new GlobalExceptionHandlerMiddleware(
            _ => throw toThrow,
            NullLogger<GlobalExceptionHandlerMiddleware>.Instance);

        await middleware.InvokeAsync(ctx);

        ctx.Response.Body.Seek(0, SeekOrigin.Begin);
        var json = await new StreamReader(ctx.Response.Body, Encoding.UTF8).ReadToEndAsync();
        var body = JsonSerializer.Deserialize<ErrorResponseDto>(
            json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;

        return (ctx.Response.StatusCode, body);
    }

    [Theory]
    [InlineData(typeof(ArgumentException), 400, "VALIDATION_ERROR")]
    [InlineData(typeof(KeyNotFoundException), 404, "NOT_FOUND")]
    [InlineData(typeof(InvalidOperationException), 409, "BUSINESS_RULE_VIOLATION")]
    [InlineData(typeof(ForbiddenAccessException), 403, "FORBIDDEN")]
    [InlineData(typeof(UnauthorizedAccessException), 401, "UNAUTHORIZED")]
    public async Task ExcecaoMapeada_status_codigo_e_mensagemDeDominioPreservada(
        Type tipo, int statusEsperado, string codeEsperado)
    {
        const string msg = "Mensagem de domínio segura.";
        var ex = (Exception)Activator.CreateInstance(tipo, msg)!;

        var (status, body) = await Invoke(ex);

        Assert.Equal(statusEsperado, status);
        Assert.Equal(codeEsperado, body.Code);
        Assert.Equal(msg, body.Message); // mensagem de domínio (4xx) é segura → preservada
    }

    [Fact]
    public async Task CorpoGrandeDemais_retorna413_naoDeixaVirar500()
    {
        // Kestrel lança BadHttpRequestException(413) quando o corpo excede MaxRequestBodySize.
        // Antes caía no default → 500 (ruído de log + status errado). Deve virar 413 limpo.
        var ex = new BadHttpRequestException("Request body too large.", StatusCodes.Status413PayloadTooLarge);

        var (status, body) = await Invoke(ex);

        Assert.Equal(413, status);
        Assert.Equal("BAD_REQUEST", body.Code);
        Assert.Equal("Requisição grande demais.", body.Message);
    }

    /// <summary>
    /// DbUpdateConcurrencyException REAL do EF, com <c>Entries</c> preenchido como em produção: apagar
    /// uma linha que não existe afeta 0 linhas — o InMemory lança a mesma exceção que o Postgres daria.
    /// (O construtor público só aceita IUpdateEntry, API interna do EF; assim não precisa dela.)
    /// </summary>
    private static async Task<DbUpdateConcurrencyException> ConcorrenciaReal(object entidadeQueSumiu)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
        db.Remove(entidadeQueSumiu);
        return await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task ConflitoDeConcorrenciaNaFatura_retorna409_comMensagemDaFatura_semVazarDetalheDoEf()
    {
        // Concorrência otimista (xmin da Fatura): outra operação alterou a linha no meio. É conflito
        // recuperável pelo cliente (recarregar e refazer) → 409, não 500. A mensagem do EF cita
        // linhas/entidades (detalhe interno) e é trocada por uma fixa e segura.
        var ex = await ConcorrenciaReal(new Fatura { Id = Guid.NewGuid() });
        Assert.Contains(ex.Entries, e => e.Entity is Fatura); // pré-condição: é o formato real do EF

        var (status, body) = await Invoke(ex);

        Assert.Equal(409, status);
        Assert.Equal("CONCURRENCY_CONFLICT", body.Code);
        Assert.Equal(GlobalExceptionHandlerMiddleware.MensagemConflitoFatura, body.Message);
        Assert.Equal("Esta fatura foi alterada por outra operação. Recarregue e tente de novo.", body.Message);
        Assert.DoesNotContain("row(s)", body.Message);
    }

    [Fact]
    public async Task ConflitoDeConcorrenciaEmOutraEntidade_retorna409_comMensagemGenerica_naoDeFatura()
    {
        // O EF lança a mesma exceção em QUALQUER UPDATE/DELETE que afeta 0 linhas — ex.: duplo POST do
        // MFA faz Remove(challenge) 2x. Falar "esta fatura" aí confundiria o usuário.
        var ex = await ConcorrenciaReal(new MfaLoginChallenge { Id = Guid.NewGuid() });

        var (status, body) = await Invoke(ex);

        Assert.Equal(409, status);
        Assert.Equal("CONCURRENCY_CONFLICT", body.Code);
        Assert.Equal("Este registro foi alterado por outra operação. Recarregue e tente de novo.", body.Message);
        Assert.DoesNotContain("fatura", body.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ConflitoDeConcorrenciaSemEntries_retorna409_comMensagemGenerica_semVazarDetalheDoEf()
    {
        // Sem Entries não dá pra saber a entidade → genérica. E a mensagem interna do EF (que aqui até
        // cita "Fatura" e "xmin") nunca vai pro cliente.
        const string internoEf = "The database operation was expected to affect 1 row(s), but actually affected 0 row(s); entity Fatura xmin";
        var ex = new DbUpdateConcurrencyException(internoEf);

        var (status, body) = await Invoke(ex);

        Assert.Equal(409, status);
        Assert.Equal("CONCURRENCY_CONFLICT", body.Code);
        Assert.Equal(GlobalExceptionHandlerMiddleware.MensagemConflitoConcorrencia, body.Message);
        Assert.DoesNotContain("row(s)", body.Message);
        Assert.DoesNotContain("xmin", body.Message);
    }

    [Fact]
    public async Task ExcecaoNaoMapeada_retorna500Generico_semVazarMensagemInterna()
    {
        const string segredo = "Npgsql: relation \"usuarios\" violates FK constraint xyz_secreto";
        var ex = new Exception(segredo);

        var (status, body) = await Invoke(ex);

        Assert.Equal(500, status);
        Assert.Equal("INTERNAL_ERROR", body.Code);
        // C2: o detalhe interno NUNCA pode aparecer na resposta.
        Assert.DoesNotContain("Npgsql", body.Message);
        Assert.DoesNotContain("secreto", body.Message);
        Assert.Equal("Erro interno do servidor. Tente novamente mais tarde.", body.Message);
    }
}
