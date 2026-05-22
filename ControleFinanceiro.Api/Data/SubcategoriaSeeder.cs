using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Data;

/// <summary>
/// Issue #83 — subcategorias padrão (UsuarioId null) sob as categorias padrão.
/// Roda depois do CategoriaSeeder. Idempotente: só semeia se ainda não houver
/// nenhuma subcategoria padrão.
/// </summary>
public static class SubcategoriaSeeder
{
    // Mapa: Descricao da categoria padrão -> nomes das subcategorias padrão.
    // Taxonomia estilo Open Finance PT-BR.
    private static readonly Dictionary<string, string[]> Defaults = new()
    {
        ["Alimentação"] = new[]
        {
            "Alimentos e bebidas", "Delivery de alimentos",
            "Restaurantes, bares e lanchonetes", "Supermercado",
        },
        ["Compras"] = new[]
        {
            "Artigos esportivos", "Artigos infantis", "Cashback", "Compras",
            "Compras online", "Eletrônicos", "Livraria", "Papelaria",
            "Pet Shops e veterinários", "Vestiário",
        },
        ["Saúde e bem-estar"] = new[]
        {
            "Academia e centros de lazer", "Bem-estar", "Dentista", "Farmácia",
            "Hospitais, clínicas e laboratórios", "Ótica", "Prática de esportes",
            "Saúde", "Saúde e bem-estar",
        },
        ["Serviços digitais"] = new[]
        {
            "Jogos e videogames", "Serviços digitais",
            "Streaming de música", "Streaming de vídeo",
        },
        ["Transporte"] = new[]
        {
            "Aluguel de bicicletas", "Aluguel de veículos", "Estacionamentos",
            "Manutenção de veículos", "Multas de trânsito",
            "Pedágios e pagamentos no veículo", "Postos de gasolina",
            "Serviços automotivos", "Taxas e impostos sobre veículos",
            "Táxi e transporte privado urbano", "Transporte", "Transporte público",
        },
        ["Moradia"] = new[]
        {
            "Água", "Aluguel", "Celular", "Eletricidade", "Gás",
            "Impostos sobre moradia", "Internet", "Moradia",
            "Serviços de utilidade pública", "Telecomunicação", "TV",
            "Utensílios para casa",
        },
        ["Lazer e entretenimento"] = new[]
        {
            "Aeroportos e cias. aéreas", "Bilhetes", "Cinema, Teatro e Concertos",
            "Estádios e arenas", "Hospedagem", "Lazer", "Museus e pontos turísticos",
            "Passagem de ônibus", "Programas de milhagem", "Viagens",
        },
        ["Finanças"] = new[]
        {
            "Ajuste de margem", "Atraso no pagamento e custos de cheque especial",
            "Empréstimo estudantil", "Empréstimos", "Empréstimos e financiamento",
            "Financiamento", "Financiamento de veículos", "Financiamento imobiliário",
            "Fundos multimercado", "Investimento automático", "Investimentos",
            "Juros cobrados", "Juros de rendimentos de dividendos", "Obrigações legais",
            "Pagamento de cartão de crédito", "Parcelamento de fatura", "Pensão",
            "Pensão alimentícia", "Renda fixa", "Renda variável", "Saldo bloqueado",
            "Transferência - Boleto bancário", "Transferência - Câmbio",
            "Transferência - Cheque", "Transferência - Dinheiro",
            "Transferência - Mesma instituição", "Transferência - PIX",
            "Transferência - TED", "Transferência mesma titularidade",
            "Transferência mesma titularidade - Dinheiro",
            "Transferência mesma titularidade - PIX",
            "Transferência mesma titularidade - TED",
            "Transferência para terceiros - Boleto bancário",
            "Transferência para terceiros - Débito",
            "Transferência para terceiros - DOC", "Transferência para terceiros - PIX",
            "Transferência para terceiros - TED", "Transferências",
            "Transferências para terceiros", "Transferências- DOC",
        },
        ["Renda"] = new[]
        {
            "Aposentadoria", "Atividades de empreendedorismo", "Auxílio do governo",
            "Renda", "Renda não-recorrente", "Salário",
        },
        ["Educação"] = new[]
        {
            "Creche", "Cursos online", "Educação", "Escola", "Universidade",
        },
        ["Impostos e taxas"] = new[]
        {
            "Imposto de renda", "Imposto sobre investimentos", "Impostos",
            "Impostos sobre operações financeiras", "Taxas bancárias",
            "Taxas de cartão de crédito", "Taxas de conta corrente",
            "Taxas sobre transferências e caixa eletrônico",
        },
        ["Seguros"] = new[]
        {
            "Seguro de veículos", "Seguro de vida", "Seguro residencial",
            "Seguro saúde", "Seguros",
        },
        ["Apostas e jogos"] = new[]
        {
            "Apostas", "Apostas online", "Loteria",
        },
        ["Doações"] = new[] { "Doações" },
        ["Outros"] = new[] { "Outros", "Serviços" },
    };

    public static async Task SeedAsync(AppDbContext context)
    {
        if (await context.Subcategorias.AnyAsync(s => s.UsuarioId == null))
            return;

        var categoriasPadrao = await context.Categorias
            .Where(c => c.UsuarioId == null)
            .ToListAsync();

        var porDescricao = categoriasPadrao
            .GroupBy(c => c.Descricao)
            .ToDictionary(g => g.Key, g => g.First());

        var novas = new List<Subcategoria>();
        foreach (var (descricaoCategoria, nomes) in Defaults)
        {
            if (!porDescricao.TryGetValue(descricaoCategoria, out var categoria))
                continue;

            foreach (var nome in nomes)
            {
                novas.Add(new Subcategoria
                {
                    Id = Guid.NewGuid(),
                    Nome = nome,
                    CategoriaId = categoria.Id,
                    UsuarioId = null,
                });
            }
        }

        if (novas.Count == 0) return;

        context.Subcategorias.AddRange(novas);
        await context.SaveChangesAsync();
    }
}
