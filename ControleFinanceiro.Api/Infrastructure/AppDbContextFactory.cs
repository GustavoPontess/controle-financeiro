using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ControleFinanceiro.Api.Infrastructure;

/// <summary>
/// Factory de design-time usada pelo `dotnet ef`. Fixa o provider em Postgres
/// para que as migrations versionadas sejam sempre geradas para Postgres
/// (provider de produção). SQLite em dev não usa migrations — cria o schema
/// via EnsureCreated. A connection string aqui não precisa ser acessível:
/// gerar migrations não conecta ao banco.
/// </summary>
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL");
        if (string.IsNullOrEmpty(connectionString) || !DatabaseProvider.IsPostgres(connectionString))
            connectionString = "Host=localhost;Port=5432;Database=controlefinanceiro;Username=postgres;Password=postgres";

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseNpgsql(connectionString);
        return new AppDbContext(optionsBuilder.Options);
    }
}
