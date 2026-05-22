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
    private static readonly Dictionary<string, string[]> Defaults = new()
    {
        ["Alimentação & Restaurantes"] = new[] { "Restaurante", "Lanche & Fast-food", "Delivery", "Café & Padaria", "Bar" },
        ["Moradia & Aluguel"]          = new[] { "Aluguel", "Condomínio", "Luz", "Água", "Gás", "IPTU", "Manutenção" },
        ["Transporte"]                 = new[] { "Combustível", "App (Uber/99)", "Ônibus & Metrô", "Estacionamento", "Pedágio", "Manutenção do veículo" },
        ["Saúde & Farmácia"]           = new[] { "Farmácia", "Consulta", "Exame", "Plano de saúde", "Dentista" },
        ["Educação"]                   = new[] { "Mensalidade", "Curso", "Livros", "Material" },
        ["Lazer & Entretenimento"]     = new[] { "Streaming", "Cinema & Teatro", "Viagem", "Jogos", "Eventos" },
        ["Vestuário"]                  = new[] { "Roupas", "Calçados", "Acessórios" },
        ["Comunicação & Internet"]     = new[] { "Celular", "Internet", "TV" },
        ["Supermercado"]               = new[] { "Hortifruti", "Açougue", "Limpeza", "Higiene", "Bebidas", "Padaria" },
        ["Serviços & Assinaturas"]     = new[] { "Academia", "Software", "Streaming", "Outros serviços" },
        ["Investimentos"]              = new[] { "Renda fixa", "Ações & Fundos", "Cripto", "Previdência" },

        ["Salário"]                    = new[] { "Salário fixo", "13º", "Férias", "Bônus" },
        ["Freelance & Consultoria"]    = new[] { "Projeto", "Hora avulsa" },
        ["Rendimentos & Dividendos"]   = new[] { "Dividendos", "Juros", "Aluguel recebido" },
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
