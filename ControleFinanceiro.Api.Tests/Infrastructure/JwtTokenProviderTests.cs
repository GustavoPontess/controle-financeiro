using ControleFinanceiro.Api.Infrastructure.Identity;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// O JWT carrega o claim "sid" (FamiliaId da sessão) quando informado — é o que o OnTokenValidated
/// usa pra revogação instantânea (checa se a sessão ainda está viva por request).
/// </summary>
public class JwtTokenProviderTests
{
    private static JwtTokenProvider Provider() =>
        new("chave-de-teste-suficientemente-grande-0123456789", "test", "test");

    [Fact]
    public void GenerateToken_comSessionId_incluiClaimSid()
    {
        var provider = Provider();
        var sid = Guid.NewGuid();

        var token = provider.GenerateToken(Guid.NewGuid(), "u@test.com", "User", sid);

        var principal = provider.ValidateToken(token);
        Assert.NotNull(principal);
        Assert.Equal(sid.ToString(), principal!.FindFirst("sid")?.Value);
    }

    [Fact]
    public void GenerateToken_semSessionId_naoTemSid()
    {
        var provider = Provider();

        var token = provider.GenerateToken(Guid.NewGuid(), "u@test.com", "User");

        var principal = provider.ValidateToken(token);
        Assert.NotNull(principal);
        Assert.Null(principal!.FindFirst("sid"));
    }
}
