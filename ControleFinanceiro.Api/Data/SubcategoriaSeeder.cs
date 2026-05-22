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
    // Mapa: Descricao da categoria padrão -> subcategorias padrão.
    // Enxuto: só consumo (despesa) e ganho (receita). Transferência, pagamento de
    // fatura, empréstimo e investimento NÃO entram aqui — têm features próprias
    // (Transferencia, Fatura/EhPagamentoFatura, Emprestimo). Sem genéricos que
    // repetem o nome da categoria. (Categorias "Doações" e "Outros" sem subcat.)
    private static readonly Dictionary<string, string[]> Defaults = new()
    {
        ["Alimentação"] = new[]
        {
            "Supermercado", "Restaurantes e bares", "Delivery", "Padaria e café",
        },
        ["Compras"] = new[]
        {
            "Vestuário", "Eletrônicos", "Artigos esportivos", "Artigos infantis",
            "Livraria e papelaria", "Pet shop e veterinário", "Compras online",
        },
        ["Saúde e bem-estar"] = new[]
        {
            "Farmácia", "Consultas e exames", "Plano de saúde", "Dentista",
            "Ótica", "Academia",
        },
        ["Serviços digitais"] = new[]
        {
            "Streaming de vídeo", "Streaming de música", "Jogos e apps",
            "Software e assinaturas",
        },
        ["Transporte"] = new[]
        {
            "Combustível", "Aplicativos de transporte", "Transporte público",
            "Manutenção do veículo", "Estacionamento", "Pedágio", "Multas",
        },
        ["Moradia"] = new[]
        {
            "Aluguel", "Condomínio", "Água", "Energia elétrica", "Gás",
            "Internet", "Telefone", "TV", "Utensílios e manutenção",
        },
        ["Lazer e entretenimento"] = new[]
        {
            "Cinema e teatro", "Viagens", "Hospedagem", "Eventos e shows", "Passeios",
        },
        ["Educação"] = new[]
        {
            "Escola", "Universidade", "Cursos", "Creche", "Material escolar",
        },
        ["Impostos e taxas"] = new[]
        {
            "Imposto de renda", "IPTU", "IPVA", "IOF", "Tarifas bancárias",
        },
        ["Seguros"] = new[]
        {
            "Seguro de vida", "Seguro do carro", "Seguro residencial", "Seguro saúde",
        },
        ["Apostas e jogos"] = new[] { "Apostas", "Loteria" },

        ["Renda"] = new[]
        {
            "Salário", "13º e férias", "Freelance e PJ", "Aposentadoria",
            "Auxílio do governo", "Aluguel recebido", "Dividendos e juros",
            "Cashback", "Reembolso", "Pensão recebida",
        },
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
