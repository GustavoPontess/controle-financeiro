using System.Text.Json;
using System.Text.Json.Serialization;
using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;

namespace ControleFinanceiro.Api.Data;

public static class BancoSeeder
{
    private const string BrasilApiUrl = "https://brasilapi.com.br/api/banks/v1";

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public static async Task SeedAsync(AppDbContext context, HttpClient httpClient)
    {
        if (context.Bancos.Any())
        {
            Console.WriteLine("✓ Bancos já cadastrados. Pulando seed.");
            return;
        }

        Console.WriteLine("📥 Buscando bancos na API do Banco Central...");

        try
        {
            var response = await httpClient.GetAsync(BrasilApiUrl);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            var bancosApi = JsonSerializer.Deserialize<List<BancoApiDto>>(json, JsonOptions) ?? [];

            var bancos = bancosApi
                .Where(b => b.Code.HasValue && !string.IsNullOrWhiteSpace(b.FullName))
                .Select(b => new Banco
                {
                    Id = Guid.NewGuid(),
                    Nome = Truncate(b.FullName!, 100),
                    NomeFantasia = Truncate(b.Name ?? b.FullName!, 200),
                    RazaoSocial = Truncate(b.FullName!, 200),
                    CodigoBanco = b.Code!.Value.ToString("D3"),
                    Tipo = ClassificarTipo(b.FullName!),
                    Ativo = true,
                })
                .ToList();

            context.Bancos.AddRange(bancos);
            await context.SaveChangesAsync();

            Console.WriteLine($"✓ {bancos.Count} bancos adicionados com sucesso!");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"⚠ Falha ao buscar bancos da API: {ex.Message}");
            Console.WriteLine("  Continuando sem seed de bancos.");
        }
    }

    private static TipoBanco ClassificarTipo(string razaoSocial)
    {
        var nome = razaoSocial.ToUpperInvariant();

        if (nome.Contains("COOPERATIVA") || nome.Contains("COOP ") || nome.Contains("SICREDI") || nome.Contains("SICOOB") || nome.Contains("CRESOL") || nome.Contains("UNICRED"))
            return TipoBanco.Cooperativa;

        if (nome.Contains("CORRETORA") || nome.Contains("CCTVM") || nome.Contains("CTVM") || nome.Contains("DTVM"))
            return TipoBanco.Corretora;

        if (nome.Contains("PAGAMENTOS") || nome.Contains("IP ") || nome.Contains("INSTITUIÇÃO DE PAGAMENTO"))
            return TipoBanco.Fintech;

        if (nome.Contains("BANCO"))
            return TipoBanco.BancoTradicional;

        return TipoBanco.Outro;
    }

    private static string Truncate(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength];

    private sealed class BancoApiDto
    {
        public string? Ispb { get; set; }
        public string? Name { get; set; }
        public int? Code { get; set; }

        [JsonPropertyName("fullName")]
        public string? FullName { get; set; }
    }
}
