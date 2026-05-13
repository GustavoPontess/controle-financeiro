using Asp.Versioning;
using ControleFinanceiro.Api.Data;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Filters;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Infrastructure.Jobs;
using ControleFinanceiro.Api.Services;
using Hangfire;
using Hangfire.MemoryStorage;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Swashbuckle.AspNetCore.SwaggerGen;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers(options =>
{
    options.Filters.Add(typeof(IdempotencyAttribute));
});

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlite("Data Source=controlefinanceiro.db");
});

builder.Services.AddScoped<TransacaoService>();
builder.Services.AddScoped<CategoriaService>();
builder.Services.AddScoped<ContaService>();
builder.Services.AddScoped<BancoService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<DashboardService>();
builder.Services.AddScoped<RelatorioService>();
builder.Services.AddScoped<TransferenciaService>();
builder.Services.AddScoped<RecorrenteService>();
builder.Services.AddScoped<EmprestimoService>();
builder.Services.AddScoped<CartaoCreditoService>();
builder.Services.AddScoped<FaturaService>();

// Issue #1 — Parcelamento Flexível
builder.Services.AddScoped<FinancialEventLogService>();
builder.Services.AddScoped<LimiteCalculatorService>();
builder.Services.AddScoped<ParcelamentoService>();
builder.Services.AddScoped<ParcelaTransacaoService>();

// Hangfire Background Jobs
builder.Services.AddScoped<FaturaFechamentoJob>();
builder.Services.AddScoped<FaturaAtrasoJob>();
builder.Services.AddScoped<ExpandirRecorrentesJob>();
builder.Services.AddScoped<ExecutarRecorrentesJob>();
builder.Services.AddScoped<RecalcularLimitesJob>();

builder.Services.AddHangfire(config =>
    config.UseMemoryStorage());
builder.Services.AddHangfireServer();

builder.Services.AddHttpContextAccessor();

// JWT Configuration
var jwtSecret = builder.Configuration["JwtSettings:Secret"] ?? "your-secret-key-change-this-in-production-very-long-string";
var jwtIssuer = builder.Configuration["JwtSettings:Issuer"] ?? "ControleFinanceiro";
var jwtAudience = builder.Configuration["JwtSettings:Audience"] ?? "ControleFinanceiroUsers";
var jwtExpirationMinutes = int.Parse(builder.Configuration["JwtSettings:ExpirationMinutes"] ?? "60");

var key = Encoding.ASCII.GetBytes(jwtSecret);
builder.Services.AddSingleton(new JwtTokenProvider(jwtSecret, jwtIssuer, jwtAudience, jwtExpirationMinutes));

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddHttpClient();
builder.Services.AddEndpointsApiExplorer();

// ── API Versioning ────────────────────────────────────────────────────────────
builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;
    options.ApiVersionReader = new UrlSegmentApiVersionReader();
})
.AddMvc(options =>
{
    options.Conventions.Add(new DefaultApiVersionConvention());
})
.AddApiExplorer(options =>
{
    options.GroupNameFormat = "'v'VVV";
    options.SubstituteApiVersionInUrl = true;
});

// Swagger/OpenAPI Configuration with JWT Support + Versioning
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "Controle Financeiro API",
        Version = "v1",
        Description = "API de gerenciamento financeiro pessoal — v1.",
        Contact = new Microsoft.OpenApi.Models.OpenApiContact
        {
            Name = "Gustavo Pontes",
            Email = "gut.n.pontes@gmail.com"
        }
    });

    // Add JWT Bearer authentication to Swagger
    options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        Description = "Enter your JWT token in the format: Bearer {token}"
    });

    options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });

    // Include XML comments from controllers
    var xmlFile = Path.Combine(AppContext.BaseDirectory, "ControleFinanceiro.Api.xml");
    if (File.Exists(xmlFile))
    {
        options.IncludeXmlComments(xmlFile);
    }

    // Order endpoints by path
    options.OrderActionsBy(x => x.RelativePath);
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy.WithOrigins("http://localhost:5173")
                  .AllowAnyOrigin()
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});

var app = builder.Build();

// Seed bancos na primeira execução
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var httpClientFactory = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();
    await context.Database.MigrateAsync();

    // Aplica diretamente o schema do sistema de faturas, caso a migração
    // tenha ficado registrada no histórico mas sem executar o DDL no banco.
    await AplicarSistemaFaturasAsync(context);

    await BancoSeeder.SeedAsync(context, httpClientFactory.CreateClient());
    await CategoriaSeeder.SeedAsync(context);
}

static async Task AplicarSistemaFaturasAsync(ControleFinanceiro.Api.Infrastructure.AppDbContext ctx)
{
    Console.WriteLine("[Startup] Verificando schema do sistema de faturas...");

    var conn = ctx.Database.GetDbConnection();
    await conn.OpenAsync();

    try
    {
        // ── Tabela Faturas ────────────────────────────────────────────────
        var tabelaExiste = false;
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='Faturas'";
            tabelaExiste = (long)(await cmd.ExecuteScalarAsync())! > 0;
        }

        if (!tabelaExiste)
        {
            Console.WriteLine("[Startup] Criando tabela Faturas...");
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                CREATE TABLE ""Faturas"" (
                    ""Id""               TEXT    NOT NULL,
                    ""CartaoCreditoId""  TEXT    NOT NULL,
                    ""DataInicio""       TEXT    NOT NULL,
                    ""DataFechamento""   TEXT    NOT NULL,
                    ""DataVencimento""   TEXT    NOT NULL,
                    ""Status""           INTEGER NOT NULL,
                    ""ValorPago""        TEXT    NOT NULL,
                    ""CriadoPor""        TEXT    NOT NULL,
                    CONSTRAINT ""PK_Faturas"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_Faturas_CartoesCredito"" FOREIGN KEY (""CartaoCreditoId"")
                        REFERENCES ""CartoesCredito"" (""Id"") ON DELETE RESTRICT
                )";
            await cmd.ExecuteNonQueryAsync();

            using var idx = conn.CreateCommand();
            idx.CommandText = @"CREATE INDEX ""IX_Faturas_CartaoCreditoId"" ON ""Faturas"" (""CartaoCreditoId"")";
            await idx.ExecuteNonQueryAsync();
            Console.WriteLine("[Startup] Tabela Faturas criada.");
        }
        else
        {
            Console.WriteLine("[Startup] Tabela Faturas já existe. Pulando.");
        }

        // ── Colunas em Transacoes ─────────────────────────────────────────
        var colunas = new List<string>();
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = "PRAGMA table_info(Transacoes)";
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                colunas.Add(reader.GetString(1)); // coluna "name"
        }

        var novasColunas = new[]
        {
            ("FaturaId",          "TEXT"),
            ("Parcelas",          "INTEGER"),
            ("NumeroParcela",     "INTEGER"),
            ("TransacaoOrigemId", "TEXT"),
        };

        foreach (var (nome, tipo) in novasColunas)
        {
            if (!colunas.Contains(nome))
            {
                Console.WriteLine($"[Startup] Adicionando coluna Transacoes.{nome}...");
                using var cmd = conn.CreateCommand();
                cmd.CommandText = $@"ALTER TABLE ""Transacoes"" ADD COLUMN ""{nome}"" {tipo}";
                await cmd.ExecuteNonQueryAsync();
                Console.WriteLine($"[Startup] Coluna {nome} adicionada.");
            }
            else
            {
                Console.WriteLine($"[Startup] Coluna {nome} já existe. Pulando.");
            }
        }

        // ── Índice FaturaId ───────────────────────────────────────────────
        var indiceExiste = false;
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='IX_Transacoes_FaturaId'";
            indiceExiste = (long)(await cmd.ExecuteScalarAsync())! > 0;
        }
        if (!indiceExiste)
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"CREATE INDEX ""IX_Transacoes_FaturaId"" ON ""Transacoes"" (""FaturaId"")";
            await cmd.ExecuteNonQueryAsync();
        }

        // ── Histórico de migração ─────────────────────────────────────────
        using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = @"
                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                SELECT '20260505120000_AddFaturaSystem', '8.0.0'
                WHERE NOT EXISTS (
                    SELECT 1 FROM ""__EFMigrationsHistory""
                    WHERE ""MigrationId"" = '20260505120000_AddFaturaSystem'
                )";
            await cmd.ExecuteNonQueryAsync();
        }

        Console.WriteLine("[Startup] Schema do sistema de faturas OK.");
    }
    finally
    {
        await conn.CloseAsync();
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

// Hangfire Dashboard
app.UseHangfireDashboard("/hangfire");

// Schedule recurring jobs
var bgJob = app.Services.GetRequiredService<IBackgroundJobClient>();
var recManager = app.Services.GetRequiredService<IRecurringJobManager>();

// Daily invoice closure (02:00 UTC)
recManager.AddOrUpdate<FaturaFechamentoJob>(
    "fatura-fechamento",
    job => job.ExecuteAsync(),
    "0 2 * * *",
    new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });

// Daily overdue mark (02:30 UTC)
recManager.AddOrUpdate<FaturaAtrasoJob>(
    "fatura-atraso",
    job => job.ExecuteAsync(),
    "30 2 * * *",
    new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });

// Daily expand recurring window (03:00 UTC)
recManager.AddOrUpdate<ExpandirRecorrentesJob>(
    "expandir-recorrentes",
    job => job.ExecuteAsync(),
    "0 3 * * *",
    new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });

// Daily execute pending transactions (03:30 UTC)
recManager.AddOrUpdate<ExecutarRecorrentesJob>(
    "executar-recorrentes",
    job => job.ExecuteAsync(),
    "30 3 * * *",
    new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });

// Hourly recalculate limits
recManager.AddOrUpdate<RecalcularLimitesJob>(
    "recalcular-limites",
    job => job.ExecuteAsync(),
    "0 * * * *",
    new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });

app.MapControllers();

app.Run();