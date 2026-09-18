using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ControleFinanceiro.Api.Infrastructure;

/// <summary>
/// Factory de design-time usada pelo `dotnet ef`. Sempre Postgres — a connection
/// string aqui não precisa ser acessível: gerar migrations não conecta ao banco.
/// </summary>
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    // MESMO switch do runtime (Program.cs) — mapeia DateTime → 'timestamp without time zone'.
    // O `dotnet ef` NÃO passa pelo Program.cs, só por esta factory; sem o switch aqui, o
    // model scaffolda 'timestamp with time zone' e diverge do schema real → migration fantasma
    // que reescreveria toda coluna de data (perigoso). Setar antes de qualquer uso do Npgsql.
    static AppDbContextFactory()
    {
        AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
    }

    public AppDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL");
        if (string.IsNullOrEmpty(connectionString))
            connectionString = "Host=localhost;Port=5432;Database=controlefinanceiro;Username=postgres;Password=postgres";

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseNpgsql(connectionString);
        return new AppDbContext(optionsBuilder.Options);
    }
}
