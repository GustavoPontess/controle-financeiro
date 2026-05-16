namespace ControleFinanceiro.Api.Infrastructure;

/// <summary>
/// Detecta o provedor de banco de dados a partir da connection string em DATABASE_URL.
/// SQLite em dev (connection string com "Data Source="), Postgres em produção
/// (connection string com "Host=").
/// </summary>
public static class DatabaseProvider
{
    public static bool IsPostgres(string connectionString) =>
        connectionString.Contains("Host=", StringComparison.OrdinalIgnoreCase);
}
