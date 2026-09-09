using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Orcamento;

/// <summary>Request para criar ou atualizar um orçamento mensal.</summary>
public class CriarOrcamentoDto
{
    /// <summary>Categoria monitorada. Null = orçamento geral (todas as categorias).</summary>
    public Guid? CategoriaId { get; set; }

    /// <summary>Mês de referência (1–12).</summary>
    [Range(1, 12)]
    public int Mes { get; set; }

    /// <summary>Ano de referência.</summary>
    [Range(2000, 2100)]
    public int Ano { get; set; }

    /// <summary>Limite máximo de gasto. Deve ser positivo.</summary>
    [Range(0.01, double.MaxValue)]
    public decimal ValorLimite { get; set; }

    /// <summary>Percentual do limite que dispara o alerta (padrão: 80).</summary>
    [Range(0, 100)]
    public decimal PercentualAlerta { get; set; } = 80;
}

/// <summary>Orçamento com situação atual de consumo.</summary>
public class OrcamentoDto
{
    public Guid Id { get; set; }
    public Guid? CategoriaId { get; set; }
    public string? CategoriaNome { get; set; }
    public int Mes { get; set; }
    public int Ano { get; set; }
    public decimal ValorLimite { get; set; }
    public decimal PercentualAlerta { get; set; }

    /// <summary>Quanto já foi gasto na categoria/período.</summary>
    public decimal ValorGasto { get; set; }

    /// <summary>Quanto ainda resta do limite.</summary>
    public decimal ValorRestante => ValorLimite - ValorGasto;

    /// <summary>Percentual do limite já consumido (0–100+).</summary>
    public decimal PercentualConsumido => ValorLimite > 0
        ? Math.Round(ValorGasto / ValorLimite * 100, 1)
        : 0;

    /// <summary>true quando consumo ≥ PercentualAlerta.</summary>
    public bool EmAlerta => PercentualConsumido >= PercentualAlerta;

    /// <summary>true quando consumo ≥ 100% (limite ultrapassado).</summary>
    public bool Ultrapassado => ValorGasto > ValorLimite;
}
