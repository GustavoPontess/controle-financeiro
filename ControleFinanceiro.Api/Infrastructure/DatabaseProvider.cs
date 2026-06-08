namespace ControleFinanceiro.Api.Infrastructure;

/// <summary>
/// Configura o provedor Postgres. DATABASE_URL deve conter uma connection string
/// Npgsql válida (com "Host=").
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
}
