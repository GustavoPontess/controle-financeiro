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
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Swashbuckle.AspNetCore.SwaggerGen;
using System.Text;

// Load environment variables from .env file if it exists
if (File.Exists(".env"))
{
    Env.Load(".env");
}

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers(options =>
{
    options.Filters.Add(typeof(IdempotencyAttribute));
});

builder.Services.AddDbContext<AppDbContext>(options =>
{
    var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL")
        ?? throw new InvalidOperationException("DATABASE_URL environment variable is not set");
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

    await BancoSeeder.SeedAsync(context, httpClientFactory.CreateClient());
    await CategoriaSeeder.SeedAsync(context);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<GlobalExceptionHandlerMiddleware>();
app.UseMiddleware<CsrfValidationMiddleware>();

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