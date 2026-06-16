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

    // Domínio por código COMPE — pra montar a URL do logo (favicon de alta
    // resolução, fonte estável e sem chave). Só os principais; o resto fica
    // sem logo e o frontend cai no ícone por tipo.
    private static readonly Dictionary<string, string> LogoDomains = new()
    {
        ["001"] = "bb.com.br",
        ["104"] = "caixa.gov.br",
        ["237"] = "bradesco.com.br",
        ["341"] = "itau.com.br",
        ["033"] = "santander.com.br",
        ["260"] = "nubank.com.br",
        ["077"] = "bancointer.com.br",
        ["336"] = "c6bank.com.br",
        ["212"] = "original.com.br",
        ["290"] = "pagbank.com.br",
        ["323"] = "mercadopago.com.br",
        ["380"] = "picpay.com",
        ["208"] = "btgpactual.com",
        ["422"] = "safra.com.br",
        ["756"] = "sicoob.com.br",
        ["748"] = "sicredi.com.br",
        ["070"] = "brb.com.br",
        ["041"] = "banrisul.com.br",
        ["655"] = "votorantim.com.br",
        ["745"] = "citibank.com.br",
    };

    /// <summary>URL de logo para um código COMPE, ou null se não mapeado.</summary>
    public static string? LogoForCodigo(string? codigo) =>
        codigo != null && LogoDomains.TryGetValue(codigo, out var dom)
            ? $"https://www.google.com/s2/favicons?domain={dom}&sz=128"
            : null;

    // Cor principal da marca por código COMPE — usada como fundo do pill do logo.
    private static readonly Dictionary<string, string> CorMarca = new()
    {
        ["001"] = "#003B7A", // Banco do Brasil
        ["104"] = "#005CA9", // Caixa
        ["237"] = "#CC092F", // Bradesco
        ["341"] = "#EC7000", // Itaú
        ["033"] = "#EC0000", // Santander
        ["260"] = "#820AD1", // Nubank
        ["077"] = "#FF7A00", // Inter
        ["336"] = "#242424", // C6
        ["212"] = "#00A868", // Original
        ["290"] = "#00B14F", // PagBank
        ["323"] = "#009EE3", // Mercado Pago
        ["380"] = "#11C76F", // PicPay
        ["208"] = "#002D62", // BTG
        ["422"] = "#1B2A4A", // Safra
        ["756"] = "#003641", // Sicoob
        ["748"] = "#3FA535", // Sicredi
        ["070"] = "#0072BB", // BRB
        ["041"] = "#004A8F", // Banrisul
        ["655"] = "#00B2A9", // BV
        ["745"] = "#003B70", // Citi
    };

    /// <summary>Cor da marca (hex) para um código COMPE, ou null se não mapeado.</summary>
    public static string? CorForCodigo(string? codigo) =>
        codigo != null && CorMarca.TryGetValue(codigo, out var cor) ? cor : null;

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
            // Timeout duro (15s) cobrindo headers + corpo: a BrasilAPI no caminho
            // do boot não pode pendurar o startup se a rede estalar (visto em CI).
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(15));
            var response = await httpClient.GetAsync(BrasilApiUrl, cts.Token);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync(cts.Token);
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
                    LogoUrl = LogoForCodigo(b.Code!.Value.ToString("D3")),
                    Cor = CorForCodigo(b.Code!.Value.ToString("D3")),
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
