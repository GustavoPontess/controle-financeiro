namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Define um limite de gasto mensal por categoria para um usuário.
/// Usado para alertas de orçamento no dashboard.
/// </summary>
public class Orcamento
{
    public Guid Id { get; set; }

    /// <summary>Usuário dono do orçamento.</summary>
    public Guid UsuarioId { get; set; }

    /// <summary>Categoria monitorada (null = orçamento geral sem categoria específica).</summary>
    public Guid? CategoriaId { get; set; }

    /// <summary>Mês de referência (1–12).</summary>
    public int Mes { get; set; }

    /// <summary>Ano de referência.</summary>
    public int Ano { get; set; }

    /// <summary>Limite máximo de gasto para o período.</summary>
    public decimal ValorLimite { get; set; }

    /// <summary>Percentual de alerta (0–100). Padrão: 80 (alerta ao atingir 80% do limite).</summary>
    public decimal PercentualAlerta { get; set; } = 80;

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public Categoria? Categoria { get; set; }
}
