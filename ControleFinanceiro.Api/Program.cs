using Asp.Versioning;
using ControleFinanceiro.Api.Data;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Filters;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Infrastructure.Jobs;
using ControleFinanceiro.Api.Infrastructure.Middleware;
using ControleFinanceiro.Api.Infrastructure.Security;
using ControleFinanceiro.Api.Services;
using DotNetEnv;
using Hangfire;
using Hangfire.MemoryStorage;
using Hangfire.PostgreSql;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Swashbuckle.AspNetCore.SwaggerGen;
using System.Text;
using System.Threading.RateLimiting;
using Serilog;
using Serilog.Formatting.Compact;

// Load environment variables from .env file if it exists
if (File.Exists(".env"))
{
    Env.Load(".env");
}

var builder = WebApplication.CreateBuilder(args);

// Serilog — logs estruturados em JSON: console + arquivo rotativo diário.
// Sentry só é anexado se SENTRY_DSN estiver definido (produção): captura
// logs de nível Error+ (o GlobalExceptionHandlerMiddleware loga exceções
// como Error, então erros não tratados chegam ao Sentry com o CorrelationId).
builder.Host.UseSerilog((context, config) =>
{
    config
        .Enrich.FromLogContext()
        .WriteTo.Console(new CompactJsonFormatter())
        .WriteTo.File(new CompactJsonFormatter(), "logs/log-.json", rollingInterval: RollingInterval.Day);

    var sentryDsn = Environment.GetEnvironmentVariable("SENTRY_DSN");
    if (!string.IsNullOrEmpty(sentryDsn))
    {
        config.WriteTo.Sentry(o =>
        {
            o.Dsn = sentryDsn;
            o.Environment = context.HostingEnvironment.EnvironmentName;
            o.MinimumEventLevel = Serilog.Events.LogEventLevel.Error;
            o.MinimumBreadcrumbLevel = Serilog.Events.LogEventLevel.Information;
        });
    }
});

builder.Services.AddControllers(options =>
{
    options.Filters.Add(typeof(IdempotencyAttribute));
});

var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? throw new InvalidOperationException("DATABASE_URL environment variable is not set");
var usePostgres = DatabaseProvider.IsPostgres(databaseUrl);

builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (usePostgres)
        options.UseNpgsql(databaseUrl);
    else
        options.UseSqlite(databaseUrl);
});

builder.Services.AddScoped<TransacaoService>();
builder.Services.AddScoped<CategoriaService>();
builder.Services.AddScoped<ContaService>();
builder.Services.AddScoped<BancoService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<CsrfTokenService>();
builder.Services.AddScoped<DashboardService>();
builder.Services.AddScoped<RelatorioService>();
builder.Services.AddScoped<TransferenciaService>();
builder.Services.AddScoped<RecorrenteService>();
builder.Services.AddScoped<EmprestimoService>();
builder.Services.AddScoped<CartaoCreditoService>();
builder.Services.AddScoped<FaturaService>();
builder.Services.AddScoped<OrcamentoService>();

// Issue #22 — Família + Membros
builder.Services.AddScoped<FamiliaService>();
builder.Services.AddScoped<ConviteService>();

// Issue #23 — Despesa Compartilhada
builder.Services.AddScoped<DespesaCompartilhadaService>();

// Issue #24 — Dependentes
builder.Services.AddScoped<DependenteService>();

// Issue #25 — Modos de rateio
builder.Services.AddScoped<RateioService>();

// Issue #26 — Acerto de contas
builder.Services.AddScoped<AcertoService>();

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

// Hangfire: Postgres (prod) persiste a fila de jobs entre deploys; SQLite
// (dev) usa MemoryStorage — jobs não sobrevivem a restart, aceitável em dev.
builder.Services.AddHangfire(config =>
{
    if (usePostgres)
        config.UsePostgreSqlStorage(
            c => c.UseNpgsqlConnection(databaseUrl),
            new PostgreSqlStorageOptions
            {
                SchemaName = "hangfire",
                PrepareSchemaIfNecessary = true,
            });
    else
        config.UseMemoryStorage();
});
builder.Services.AddHangfireServer();

// Health checks: /health (liveness, leve) e /health/ready (readiness:
// banco + Hangfire). Usa AddDbContextCheck — provider-agnóstico, funciona
// tanto em SQLite quanto Postgres.
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("database", tags: new[] { "ready" })
    .AddHangfire(options => options.MinimumAvailableServers = 1, name: "hangfire", tags: new[] { "ready" });

// Rate Limiting — protege endpoints de autenticação contra brute force.
// Todas as políticas particionam por IP de origem.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    static string PartitionByIp(HttpContext ctx) =>
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    options.AddPolicy("auth-login", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(PartitionByIp(ctx), _ =>
            new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(5),
                QueueLimit = 0,
            }));

    options.AddPolicy("auth-register", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(PartitionByIp(ctx), _ =>
            new FixedWindowRateLimiterOptions
            {
                PermitLimit = 3,
                Window = TimeSpan.FromHours(1),
                QueueLimit = 0,
            }));

    options.AddPolicy("auth-forgot-password", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(PartitionByIp(ctx), _ =>
            new FixedWindowRateLimiterOptions
            {
                PermitLimit = 1,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0,
            }));

    options.OnRejected = async (context, token) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            context.HttpContext.Response.Headers.RetryAfter =
                ((int)retryAfter.TotalSeconds).ToString();
        }

        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { message = "Muitas tentativas. Tente novamente mais tarde." }, token);
    };
});

builder.Services.AddHttpContextAccessor();

// JWT Configuration
var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET")
    ?? throw new InvalidOperationException("JWT_SECRET environment variable is not set");
var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? "ControleFinanceiro";
var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? "ControleFinanceiroUsers";
var jwtExpirationMinutes = int.Parse(Environment.GetEnvironmentVariable("JWT_EXPIRATION_MINUTES") ?? "60");

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
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = ctx =>
        {
            if (ctx.Request.Cookies.TryGetValue("jwt", out var jwtCookie) && !string.IsNullOrEmpty(jwtCookie))
                ctx.Token = jwtCookie;
            return Task.CompletedTask;
        }
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

var corsOrigins = (Environment.GetEnvironmentVariable("CORS_ALLOWED_ORIGINS") ?? "http://localhost:5173").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy.WithOrigins(corsOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        });
});

var app = builder.Build();

// Seed bancos na primeira execução
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var httpClientFactory = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();

    // Postgres (prod) usa migrations versionadas; SQLite (dev) cria o schema
    // direto do modelo via EnsureCreated — mais rápido para subir, sem histórico.
    if (usePostgres)
        await context.Database.MigrateAsync();
    else
        await context.Database.EnsureCreatedAsync();

    await BancoSeeder.SeedAsync(context, httpClientFactory.CreateClient());
    await CategoriaSeeder.SeedAsync(context);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<CorrelationIdMiddleware>();

app.UseSerilogRequestLogging();

app.UseMiddleware<GlobalExceptionHandlerMiddleware>();
app.UseMiddleware<CsrfValidationMiddleware>();

app.UseHttpsRedirection();

app.UseCors("AllowFrontend");

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

// Hangfire Dashboard — protegido: exige usuário autenticado
app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = new[] { new HangfireDashboardAuthFilter() }
});

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

// /health — liveness: responde se o processo está de pé (sem checar deps)
app.MapHealthChecks("/health", new HealthCheckOptions
{
    Predicate = _ => false
});

// /health/ready — readiness: checa banco e Hangfire
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});

app.Run();