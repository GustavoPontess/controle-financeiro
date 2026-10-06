using System.Runtime.CompilerServices;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Liga, uma vez e antes de qualquer teste, o mesmo switch que o <c>Program.cs</c> e o
/// <c>AppDbContextFactory</c> (design-time, que gera as migrations) ligam. Sem ele o Npgsql mapeia
/// <c>DateTime</c> como "timestamp with time zone" e o modelo montado nos testes (sem passar pelo
/// Program) deixa de bater com o snapshot das migrations ("timestamp without time zone"). Antes
/// dependia de a ordem dos testes já ter subido o Program. Só afeta o provider Npgsql — os testes de
/// serviço (InMemory) não são tocados.
/// </summary>
internal static class NpgsqlTestSetup
{
    [ModuleInitializer]
    internal static void HabilitarTimestampLegado() =>
        AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
}
