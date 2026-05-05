using ControleFinanceiro.Api.Data;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Infrastructure.Identity;
using ControleFinanceiro.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

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
builder.Services.AddSwaggerGen();

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
    // Cria tabela Faturas (idempotente)
    await ctx.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""Faturas"" (
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
        )");

    await ctx.Database.ExecuteSqlRawAsync(@"
        CREATE INDEX IF NOT EXISTS ""IX_Faturas_CartaoCreditoId""
        ON ""Faturas"" (""CartaoCreditoId"")");

    // Adiciona colunas na tabela Transacoes (ignora se já existirem)
    foreach (var sql in new[]
    {
        @"ALTER TABLE ""Transacoes"" ADD COLUMN ""FaturaId""           TEXT",
        @"ALTER TABLE ""Transacoes"" ADD COLUMN ""Parcelas""           INTEGER",
        @"ALTER TABLE ""Transacoes"" ADD COLUMN ""NumeroParcela""      INTEGER",
        @"ALTER TABLE ""Transacoes"" ADD COLUMN ""TransacaoOrigemId""  TEXT",
    })
    {
        try { await ctx.Database.ExecuteSqlRawAsync(sql); }
        catch { /* coluna já existe — ignorar */ }
    }

    await ctx.Database.ExecuteSqlRawAsync(@"
        CREATE INDEX IF NOT EXISTS ""IX_Transacoes_FaturaId""
        ON ""Transacoes"" (""FaturaId"")");

    // Garante que o registro de migração existe no histórico
    await ctx.Database.ExecuteSqlRawAsync(@"
        INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
        SELECT '20260505120000_AddFaturaSystem', '8.0.0'
        WHERE NOT EXISTS (
            SELECT 1 FROM ""__EFMigrationsHistory""
            WHERE ""MigrationId"" = '20260505120000_AddFaturaSystem'
        )");
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

app.MapControllers();

app.Run();