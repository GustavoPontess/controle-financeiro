using System.Net;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>A página de e-mails (e tudo do DevController) só existe em desenvolvimento: fora dele é 404.</summary>
public class DevHttpTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public DevHttpTests(CustomWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task PaginaDeEmails_foraDeDesenvolvimento_404()
    {
        var resp = await _factory.CreateClient().GetAsync("/api/v1/dev/emails");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }
}
