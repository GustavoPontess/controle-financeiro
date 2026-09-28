using ControleFinanceiro.Api.Services;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// O ParcelamentoService ganhou um parâmetro opcional (TimeProvider) pra testar o "hoje" com data fixa.
/// O Program.cs não registra TimeProvider: aqui prova que o container da API real ainda monta o service
/// (sem registro, vale o default = relógio do sistema) em vez de quebrar o endpoint em runtime.
/// </summary>
// Sobe o host de verdade: serializa com as outras classes que sobem o host/mexem em env var global.
[Collection("PasswordHasherEnv")]
public class ParcelamentoServiceDiTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public ParcelamentoServiceDiTests(CustomWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public void ContainerDaApi_ResolveParcelamentoService_SemTimeProviderRegistrado()
    {
        using var scope = _factory.CreateScopeComBanco();

        var service = scope.ServiceProvider.GetRequiredService<ParcelamentoService>();

        Assert.NotNull(service);
    }
}
