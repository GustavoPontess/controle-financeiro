using System.Text;
using System.Text.Json;
using ControleFinanceiro.Api.DTOs.Common;
using ControleFinanceiro.Api.Infrastructure.Middleware;
using Microsoft.AspNetCore.Http;
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
