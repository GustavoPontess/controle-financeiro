using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ControleFinanceiro.Api.Tests.Infrastructure;

/// <summary>
/// Sobe a API de verdade (pipeline HTTP completo: JWT cookie, CSRF, middlewares, revogação
/// instantânea) para testes de INTEGRAÇÃO, trocando o Postgres por InMemory e desligando a infra de
/// boot (migrations/seeders/Hangfire) via ASPNETCORE_ENVIRONMENT=Testing (gate no Program.cs).
/// Cada instância tem seu próprio banco InMemory (isolamento entre classes de teste).
/// </summary>
public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _dbName = "itest-" + Guid.NewGuid();

    static CustomWebApplicationFactory()
    {
        // O Program lê estas env vars no boot e lança se faltarem. Valores de teste; o DATABASE_URL é
        // dummy (o AppDbContext vira InMemory abaixo, e o Hangfire é pulado em Testing).
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Testing");
        Environment.SetEnvironmentVariable("JWT_SECRET", "chave-de-teste-suficientemente-grande-para-hs256-0123456789");
        Environment.SetEnvironmentVariable("DATABASE_URL", "Host=localhost;Database=itest;Username=itest;Password=itest");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services =>
        {
            // Troca o AppDbContext (Npgsql) por InMemory. EF Core 9/10: o AddDbContext do app
            // registra a config do provider via IDbContextOptionsConfiguration<AppDbContext> além do
            // DbContextOptions<AppDbContext>. Remover só o segundo deixaria o Npgsql ativo e cairia em
            // "Only a single database provider can be registered". Remove AMBOS (match por FullName pra
            // não depender do nome exato do tipo genérico) antes de re-adicionar como InMemory.
            var efDescriptors = services.Where(d =>
                d.ServiceType == typeof(DbContextOptions<AppDbContext>) ||
                (d.ServiceType.FullName?.Contains("IDbContextOptionsConfiguration") == true &&
                 d.ServiceType.GenericTypeArguments.Contains(typeof(AppDbContext)))).ToList();
            foreach (var d in efDescriptors) services.Remove(d);
            // InMemory não tem transação: sem ignorar o aviso, todo fluxo com BeginTransaction (criar conta
            // fixa, parcelamento…) estourava InvalidOperationException → 409. Mesmo ajuste dos testes de service.
            services.AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase(_dbName)
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning)));

            // Sem Hangfire em Testing → o dispatcher de reset vira no-op (não enfileira job).
            var disp = services.SingleOrDefault(d => d.ServiceType == typeof(IPasswordResetDispatcher));
            if (disp != null) services.Remove(disp);
            services.AddScoped<IPasswordResetDispatcher, NoOpPasswordResetDispatcher>();
        });
    }

    /// <summary>Cria o schema InMemory e devolve um scope pra semear dados direto no banco do teste.</summary>
    public IServiceScope CreateScopeComBanco()
    {
        var scope = Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureCreated();
        return scope;
    }

    private sealed class NoOpPasswordResetDispatcher : IPasswordResetDispatcher
    {
        public void Disparar(string email) { }
    }
}
