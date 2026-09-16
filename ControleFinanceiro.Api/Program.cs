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
using Hangfire.PostgreSql;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
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

// Npgsql 6+ mapeia DateTime p/ 'timestamp with time zone' e exige Kind=Utc. O
// domínio usa DateTime naïve (datas civis sem timezone); o modo legado mapeia p/
// 'timestamp without time zone' e aceita qualquer Kind. DEVE ser setado antes de
// o Npgsql resolver tipos. (Antes vivia no ctor estático de DatabaseProvider, mas
// o #114 removeu a última referência a essa classe — então nunca mais rodava, e
// um DB novo crashava no seed. Setado explícito aqui pra não depender disso.)
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

// Ambiente de teste HTTP (WebApplicationFactory, ASPNETCORE_ENVIRONMENT=Testing): pula a infra de
// boot que exige Postgres/Hangfire reais (migrations, seeders, Hangfire server/dashboard/jobs). A
// factory troca o AppDbContext por InMemory. NÃO altera nada em Development/Production.
var isTesting = builder.Environment.IsEnvironment("Testing");

// Backstop de payload: limita o tamanho do corpo de QUALQUER request a 10 MB (default do Kestrel
// é 30 MB). Protege contra payload gigante travar/consumir memória — complementa o [MaxLength]
// por campo nos DTOs (que barra "caracteres infinitos" num campo específico com 400). 10 MB cobre
// import de OFX/CSV com folga; request de API JSON normal fica muito abaixo disso.
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 10 * 1024 * 1024);

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

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(databaseUrl);
});

builder.Services.AddScoped<TransacaoService>();
builder.Services.AddScoped<CategoriaService>();
builder.Services.AddScoped<SubcategoriaService>();
builder.Services.AddScoped<ContaService>();
builder.Services.AddScoped<BancoService>();
builder.Services.AddScoped<MfaService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<AdminAuditService>();
builder.Services.AddScoped<AdminUsuarioService>();
builder.Services.AddScoped<AdminLgpdService>();
builder.Services.AddScoped<RegistroAcessoService>();
builder.Services.AddScoped<NotificacaoAdminService>();
builder.Services.AddScoped<EmailOtpService>();
builder.Services.AddScoped<MinhaContaService>();
builder.Services.AddScoped<IContaEmailSender, LoggingContaEmailSender>();
builder.Services.AddScoped<IPasswordResetEmailSender, LoggingPasswordResetEmailSender>();
builder.Services.AddScoped<IPasswordResetDispatcher, HangfirePasswordResetDispatcher>();
builder.Services.AddScoped<PasswordResetEmailJob>();
builder.Services.AddScoped<CsrfTokenService>();
builder.Services.AddScoped<DashboardService>();
builder.Services.AddScoped<RelatorioService>();
builder.Services.AddScoped<TransferenciaService>();
builder.Services.AddScoped<RecorrenteService>();
builder.Services.AddScoped<EmprestimoService>();
builder.Services.AddScoped<CartaoCreditoService>();
builder.Services.AddScoped<FaturaService>();
builder.Services.AddScoped<OrcamentoService>();
builder.Services.AddScoped<MetaService>();

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

// Issue #27 — Importação de extrato OFX/CSV
builder.Services.AddScoped<ExtratoImportService>();
builder.Services.AddScoped<ImportacaoService>();

// Issue #29 — Onboarding guiado
builder.Services.AddScoped<OnboardingService>();

// Issue #30 — Notificações
builder.Services.AddScoped<NotificacaoService>();

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
builder.Services.AddScoped<PurgaExclusaoExpiradaJob>();
builder.Services.AddScoped<PurgaRegistroAcessoExpiradoJob>();

// Hangfire exige Postgres real (storage + server) — pulado em teste (a factory usa InMemory e não
// exercita jobs). O IPasswordResetDispatcher é sobrescrito por um no-op na factory.
if (!isTesting)
{
    builder.Services.AddHangfire(config =>
    {
        config.UsePostgreSqlStorage(
            c => c.UseNpgsqlConnection(databaseUrl),
            new PostgreSqlStorageOptions
            {
                SchemaName = "hangfire",
                PrepareSchemaIfNecessary = true,
            });
    });
    builder.Services.AddHangfireServer();
}

// Health checks: /health (liveness, leve) e /health/ready (readiness:
// banco + Hangfire). Usa AddDbContextCheck — provider-agnóstico, funciona
// tanto em SQLite quanto Postgres.
var healthChecks = builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("database", tags: new[] { "ready" });
if (!isTesting)
    healthChecks.AddHangfire(options => options.MinimumAvailableServers = 1, name: "hangfire", tags: new[] { "ready" });

// Rate Limiting — protege endpoints de autenticação contra brute force.
// Todas as políticas particionam por IP de origem.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    static string PartitionByIp(HttpContext ctx) =>
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    // Em Development, limite alto para não bloquear testes E2E repetidos localmente
    var isDev = builder.Environment.IsDevelopment();
    options.AddPolicy("auth-login", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(PartitionByIp(ctx), _ =>
            new FixedWindowRateLimiterOptions
            {
                PermitLimit = isDev ? 100 : 5,
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

    // Confirmar ativação / verificar login / desativar MFA — código de 6 dígitos, precisa de
    // limite estrito (OWASP MFA Cheat Sheet: "SHOULD apply strict attempt limits").
    options.AddPolicy("auth-mfa", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(PartitionByIp(ctx), _ =>
            new FixedWindowRateLimiterOptions
            {
                PermitLimit = isDev ? 100 : 5,
                Window = TimeSpan.FromMinutes(5),
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
// Access token curto (15min) — encurta a janela de exposição; a revogação INSTANTÂNEA vem do
// OnTokenValidated abaixo (checagem de sessão viva por request). Silent refresh no front renova
// transparente pelo refresh (7d). Sobrescrevível por env em prod.
var jwtExpirationMinutes = int.Parse(Environment.GetEnvironmentVariable("JWT_EXPIRATION_MINUTES") ?? "15");

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
        },
        // Revogação INSTANTÂNEA (não espera os 15min do access token): valida por request se a sessão
        // (claim "sid" = FamiliaId do refresh) ainda tem um refresh VIVO e se o usuário segue Ativo.
        // Se não, o access token é rejeitado na hora. Cobre num só lugar: encerrar sessão,
        // sair-de-todos, reset de senha, reuse-detection E bloqueio/exclusão do usuário. Query
        // indexada (IX_RefreshTokens_FamiliaId) — barata no beta; cache com invalidação fica pra
        // escala. Tokens legados sem "sid" passam (compat de transição pós-deploy).
        OnTokenValidated = async ctx =>
        {
            var sid = ctx.Principal?.FindFirst("sid")?.Value;
            if (string.IsNullOrEmpty(sid) || !Guid.TryParse(sid, out var familiaId))
                return;

            var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
            var agora = DateTime.UtcNow;
            var status = await db.RefreshTokens
                .Where(r => r.FamiliaId == familiaId && !r.Revogado && r.ExpiresAt > agora)
                .Select(r => (ControleFinanceiro.Api.Domain.Enums.StatusUsuario?)r.Usuario.Status)
                .FirstOrDefaultAsync();

            if (status is null || status != ControleFinanceiro.Api.Domain.Enums.StatusUsuario.Ativo)
                ctx.Fail("Sessão revogada.");
        }
    };
});

// ── Autorização — policy de admin global (re-check no banco, ver AdminAuthorizationHandler) ──
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AdminRequirement.PolicyName, p =>
    {
        p.RequireAuthenticatedUser();
        p.AddRequirements(new AdminRequirement());
    });
});
builder.Services.AddScoped<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, AdminAuthorizationHandler>();

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

// Achado do pentest ao vivo (2026-08-23): atrás de qualquer proxy/load balancer que
// termina TLS na borda (padrão de praticamente todo host gerenciado de container — o
// container recebe HTTP puro internamente), `Request.IsHttps` fica sempre false, mesmo
// o usuário estando em HTTPS de verdade. Isso quebrava o `Secure` do cookie de sessão
// (AuthController.SetAuthCookies usa Request.IsHttps), confirmado simulando o header
// X-Forwarded-Proto sem esse middleware. KnownNetworks/KnownProxies limpos porque o
// container só é alcançável pelo proxy do próprio host (rede interna isolada), sem IP
// fixo de proxy pra fixar. IMPORTANTE: se a hospedagem escolhida NÃO isolar assim a
// rede do container, restringir KnownProxies ao IP do proxy antes de confiar no header.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

// Migrations + seeds rodam antes de servir. Ordem importa: BancoSeeder primeiro
// (DevDataSeeder usa a lista de bancos). O BancoSeeder chama a BrasilAPI mas tem
// timeout interno (15s) + try/catch — se a API externa estiver lenta/fora, ele
// desiste e segue, sem travar o boot. /health então sobe de forma previsível.
// Pulado em teste (InMemory não tem migrations; BancoSeeder chama a BrasilAPI).
if (!isTesting)
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var httpClientFactory = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();

    await context.Database.MigrateAsync();

    await BancoSeeder.SeedAsync(context, httpClientFactory.CreateClient());
    await CategoriaSeeder.SeedAsync(context);
    await SubcategoriaSeeder.SeedAsync(context);

    // Concede IsAdmin aos e-mails de ADMIN_EMAILS (única via pela app; ver AdminSeeder). Roda
    // em todos os ambientes; sem a env var, é no-op.
    await AdminSeeder.SeedAsync(context);

    // Dados de exemplo para o atlas Playwright / revisão visual do redesign.
    // Só em Development e idempotente (não roda se o usuário dev já existir).
    if (app.Environment.IsDevelopment())
        await DevDataSeeder.SeedAsync(context);

    // Seeder pessoal de dogfooding — Data/MeuCenarioSeeder.cs é gitignored (cada
    // dev cria o seu, com dados reais que nunca vão pro Git). Carregado via
    // reflection pra Program.cs compilar igual em qualquer checkout, com ou
    // sem o arquivo (CI, outro worktree, clone novo — nenhum deles tem essa
    // classe, e não deveriam precisar).
    if (app.Environment.IsDevelopment())
    {
        var meuCenarioSeedAsync = Type.GetType("ControleFinanceiro.Api.Data.MeuCenarioSeeder")
            ?.GetMethod("SeedAsync");
        if (meuCenarioSeedAsync != null)
            await (Task)meuCenarioSeedAsync.Invoke(null, new object[] { context })!;
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Primeiro middleware de todos — precisa rodar antes de qualquer coisa que
// leia Request.Scheme/IsHttps (cookie Secure, HTTPS redirect, etc).
app.UseForwardedHeaders();

app.UseMiddleware<CorrelationIdMiddleware>();

// Headers de segurança antes de tudo — valem inclusive nas respostas de erro.
app.UseMiddleware<SecurityHeadersMiddleware>();

app.UseSerilogRequestLogging();

app.UseMiddleware<GlobalExceptionHandlerMiddleware>();
app.UseMiddleware<CsrfValidationMiddleware>();

app.UseHttpsRedirection();

app.UseCors("AllowFrontend");

// Rate limiter desligado em teste (a suíte HTTP faz vários logins na mesma instância e bateria no
// 429). Não muda dev/prod. As políticas seguem registradas (AddRateLimiter); só o middleware sai.
if (!isTesting)
    app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

// Guarda multi-aba (multi-conta): barra escrita quando a aba está numa conta diferente da ativa
// (header X-Active-Account ≠ dono do jwt). Depois do auth (precisa de User populado); no-op sem header.
app.UseMiddleware<ActiveAccountGuardMiddleware>();

// Hangfire (dashboard + agendamento) exige Postgres real — pulado em teste.
if (!isTesting)
{
    // Hangfire Dashboard — protegido: exige usuário autenticado
    app.UseHangfireDashboard("/hangfire", new DashboardOptions
    {
        Authorization = new[] { new HangfireDashboardAuthFilter() }
    });

    // Agenda os jobs recorrentes DEPOIS que o app sobe (ApplicationStarted), fora do
    // caminho crítico do boot. A primeira escrita no storage do Hangfire cria o schema
    // `hangfire` num DB novo — operação que pode ser lenta/travar (lock advisory) e
    // não deve impedir o /health de responder. Sai do boot, agenda em background.
    app.Lifetime.ApplicationStarted.Register(() =>
    {
        var recManager = app.Services.GetRequiredService<IRecurringJobManager>();
        var utc = new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc };

        recManager.AddOrUpdate<FaturaFechamentoJob>("fatura-fechamento", job => job.ExecuteAsync(), "0 2 * * *", utc);
        recManager.AddOrUpdate<FaturaAtrasoJob>("fatura-atraso", job => job.ExecuteAsync(), "30 2 * * *", utc);
        recManager.AddOrUpdate<ExpandirRecorrentesJob>("expandir-recorrentes", job => job.ExecuteAsync(), "0 3 * * *", utc);
        recManager.AddOrUpdate<ExecutarRecorrentesJob>("executar-recorrentes", job => job.ExecuteAsync(), "30 3 * * *", utc);
        recManager.AddOrUpdate<RecalcularLimitesJob>("recalcular-limites", job => job.ExecuteAsync(), "0 * * * *", utc);
        // Purga LGPD (Módulo C): 4h UTC, purga contas com carência de exclusão vencida.
        recManager.AddOrUpdate<PurgaExclusaoExpiradaJob>("purga-exclusao-lgpd", job => job.ExecuteAsync(), "0 4 * * *", utc);
        // Retenção Marco Civil (Art. 15): 4h30 UTC, purga registros de acesso com guarda de 6 meses vencida.
        recManager.AddOrUpdate<PurgaRegistroAcessoExpiradoJob>("purga-registro-acesso-marco-civil", job => job.ExecuteAsync(), "30 4 * * *", utc);
    });
}

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

// Torna a classe Program (gerada pelos top-level statements) acessível pro projeto de teste,
// que usa WebApplicationFactory<Program> nos testes HTTP de integração.
public partial class Program { }