namespace ControleFinanceiro.Api.Infrastructure;

/// <summary>
/// Detecta o provedor de banco de dados a partir da connection string em DATABASE_URL.
/// SQLite em dev (connection string com "Data Source="), Postgres em produção
/// (connection string com "Host=").
/// </summary>
public static class DatabaseProvider
{
    static DatabaseProvider()
    {
        // Npgsql 6+ mapeia DateTime para 'timestamp with time zone' e exige
        // Kind=Utc. O domínio usa DateTime naïve (datas civis sem timezone);
        // o modo legado mapeia para 'timestamp without time zone' e aceita
        // qualquer Kind. O ctor estático garante o switch antes de o Npgsql
        // resolver tipos (acessado tanto pelo host quanto pelo design-time).
        AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
    }

    public static bool IsPostgres(string connectionString) =>
        connectionString.Contains("Host=", StringComparison.OrdinalIgnoreCase);
}
