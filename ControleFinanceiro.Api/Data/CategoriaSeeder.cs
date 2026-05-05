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

        var defaults = new List<Categoria>
        {
            // Despesas
            new() { Id = Guid.NewGuid(), Descricao = "Alimentação & Restaurantes", Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Moradia & Aluguel",           Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Transporte",                  Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Saúde & Farmácia",            Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Educação",                    Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Lazer & Entretenimento",      Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Vestuário",                   Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Comunicação & Internet",      Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Supermercado",                Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Serviços & Assinaturas",      Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Investimentos",               Finalidade = Finalidade.Despesa },
            new() { Id = Guid.NewGuid(), Descricao = "Outros",                      Finalidade = Finalidade.Despesa },

            // Receitas
            new() { Id = Guid.NewGuid(), Descricao = "Salário",                     Finalidade = Finalidade.Receita },
            new() { Id = Guid.NewGuid(), Descricao = "Freelance & Consultoria",     Finalidade = Finalidade.Receita },
            new() { Id = Guid.NewGuid(), Descricao = "Rendimentos & Dividendos",    Finalidade = Finalidade.Receita },
            new() { Id = Guid.NewGuid(), Descricao = "Aluguel Recebido",            Finalidade = Finalidade.Receita },
            new() { Id = Guid.NewGuid(), Descricao = "Reembolso",                   Finalidade = Finalidade.Receita },
            new() { Id = Guid.NewGuid(), Descricao = "Outros (Receita)",            Finalidade = Finalidade.Receita },
        };

        context.Categorias.AddRange(defaults);
        await context.SaveChangesAsync();
    }
}
