using ControleFinanceiro.Api.Data;
using ControleFinanceiro.Api.Infrastructure;
using ControleFinanceiro.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlite("Data Source=controlefinanceiro.db");
});

builder.Services.AddScoped<TransacaoService>();
builder.Services.AddScoped<PessoaService>();
builder.Services.AddScoped<CategoriaService>();
builder.Services.AddScoped<RelatorioService>();
builder.Services.AddScoped<ContaService>();
builder.Services.AddScoped<BancoService>();

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
    await BancoSeeder.SeedAsync(context, httpClientFactory.CreateClient());
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors("AllowFrontend");

app.UseAuthorization();

app.MapControllers();

app.Run();