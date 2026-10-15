using System.Net;
using System.Security.Cryptography;
using System.Text;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Identity;

/// <summary>
/// Checagem de senha vazada (Pwned Passwords, k-anonymity) sem internet: um handler falso faz o papel do serviço.
/// Garante que só os 5 primeiros caracteres do SHA-1 saem, que achar o sufixo (com contagem &gt; 0) é vazamento,
/// que o enchimento (contagem 0) não é, e que serviço fora do ar deixa passar (fail-open).
/// </summary>
public class VerificadorSenhaVazadaTests
{
    private sealed class HandlerFalso(Func<HttpRequestMessage, HttpResponseMessage> responder) : HttpMessageHandler
    {
        public HttpRequestMessage? Ultima { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Ultima = request;
            return Task.FromResult(responder(request));
        }
    }

    private static (PwnedPasswordsVerificador v, HandlerFalso h) Criar(Func<HttpRequestMessage, HttpResponseMessage> responder)
    {
        var h = new HandlerFalso(responder);
        var http = new HttpClient(h) { BaseAddress = new Uri("https://api.pwnedpasswords.com/") };
        return (new PwnedPasswordsVerificador(http, NullLogger<PwnedPasswordsVerificador>.Instance), h);
    }

    private static string Sha1(string s) => Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(s)));
    private static HttpResponseMessage Ok(string corpo) => new(HttpStatusCode.OK) { Content = new StringContent(corpo) };

    [Fact]
    public async Task SoOPrefixoDe5Sai_ESufixoComContagemEhVazamento()
    {
        const string senha = "uma senha que vazou feio";
        var hash = Sha1(senha);
        var (v, h) = Criar(_ => Ok($"0000000000000000000000000000000000A:3\r\n{hash[5..]}:42\r\nFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:0"));

        Assert.True(await v.EstaVazadaAsync(senha));
        Assert.Equal($"/range/{hash[..5]}", h.Ultima!.RequestUri!.AbsolutePath);
        Assert.DoesNotContain(hash[5..], h.Ultima.RequestUri.ToString()); // o resto do hash nunca vai
    }

    [Fact]
    public async Task SufixoSoNoEnchimento_ContagemZero_NaoEhVazamento()
    {
        const string senha = "outra frase qualquer aqui";
        var (v, _) = Criar(_ => Ok($"{Sha1(senha)[5..]}:0"));

        Assert.False(await v.EstaVazadaAsync(senha));
    }

    [Fact]
    public async Task SufixoAusente_NaoEhVazamento()
    {
        var (v, _) = Criar(_ => Ok("0123456789ABCDEF0123456789ABCDEF012:7"));

        Assert.False(await v.EstaVazadaAsync("frase inédita de verdade"));
    }

    [Fact]
    public async Task ServicoForaDoAr_DeixaPassar()
    {
        var (v, _) = Criar(_ => throw new HttpRequestException("sem rede"));
        Assert.False(await v.EstaVazadaAsync("qualquer frase comprida"));

        var (v503, _) = Criar(_ => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
        Assert.False(await v503.EstaVazadaAsync("qualquer frase comprida"));
    }

    [Fact]
    public async Task AcentoComposto_EDecomposto_DaoOMesmoHash()
    {
        const string composto = "minha frase com café";
        var decomposto = composto.Normalize(NormalizationForm.FormD);
        var (v, h) = Criar(_ => Ok($"{Sha1(composto)[5..]}:1"));

        Assert.True(await v.EstaVazadaAsync(decomposto)); // normaliza (NFC) antes do hash
        Assert.Equal($"/range/{Sha1(composto)[..5]}", h.Ultima!.RequestUri!.AbsolutePath);
    }
}
