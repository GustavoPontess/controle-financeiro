using ControleFinanceiro.Api.Domain.Entities;
using ControleFinanceiro.Api.Domain.Enums;
using ControleFinanceiro.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ControleFinanceiro.Api.Data;

public static class CategoriaSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        if (await context.Categorias.AnyAsync(c => c.UsuarioId == null))
            return;

        // Taxonomia padrão (estilo Open Finance PT-BR). Subcategorias no SubcategoriaSeeder.
        var defaults = new List<Categoria>
        {
            new() { Id = Guid.NewGuid(), Descricao = "Alimentação",            Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Compras",                Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Saúde e bem-estar",      Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Serviços digitais",      Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Transporte",             Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Moradia",                Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Lazer e entretenimento", Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Renda",                  Finalidade = Finalidade.Receita },
            // Cashback, reembolso, estorno: dinheiro que VOLTA, não renda (não entra no "Renda do mês").
            new() { Id = Guid.NewGuid(), Descricao = "Dinheiro que volta",     Finalidade = Finalidade.Receita },
            new() { Id = Guid.NewGuid(), Descricao = "Educação",               Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Impostos e taxas",       Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Seguros",                Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Apostas e jogos",        Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Doações",                Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Outros",                 Finalidade = Finalidade.Ambas },
            // Investimento: aporte e resgate mexem no saldo, não são gasto nem renda (seção Investimentos do Orçamento).
            // Uma categoria por tipo de aplicação; as fontes (o que a pessoa planeja por mês) são as subcategorias.
            new() { Id = Guid.NewGuid(), Descricao = "Renda fixa",             Finalidade = Finalidade.Investimento },
            new() { Id = Guid.NewGuid(), Descricao = "Renda variável",         Finalidade = Finalidade.Investimento },
            new() { Id = Guid.NewGuid(), Descricao = "Previdência",            Finalidade = Finalidade.Investimento },
            new() { Id = Guid.NewGuid(), Descricao = "Criptomoedas",           Finalidade = Finalidade.Investimento },
            new() { Id = Guid.NewGuid(), Descricao = "Investimentos no exterior", Finalidade = Finalidade.Investimento },
            new() { Id = Guid.NewGuid(), Descricao = "Outros investimentos",   Finalidade = Finalidade.Investimento },
        };

        context.Categorias.AddRange(defaults);
        await context.SaveChangesAsync();
    }
}
