namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// Limite de gasto mensal de uma categoria (tela Limites). Uma linha diz: "a partir de <see cref="Mes"/>/<see cref="Ano"/>,
/// o limite desta categoria é <see cref="ValorLimite"/>" e VALE TODO MÊS até a pessoa mudar (decisão do Gustavo
/// 2026-10-19, como o Monarch). O limite de um mês = a linha mais recente da categoria até aquele mês. Mudar num mês
/// grava a partir dele e apaga o que havia depois; os meses passados guardam o que tinham.
/// <see cref="ValorLimite"/> = 0 é "sem limite deste mês em diante" (a pessoa tirou o limite).
/// </summary>
public class Orcamento
{
    public Guid Id { get; set; }

    /// <summary>Usuário dono do orçamento.</summary>
    public Guid UsuarioId { get; set; }

    /// <summary>Categoria monitorada (null = orçamento geral sem categoria específica).</summary>
    public Guid? CategoriaId { get; set; }

    /// <summary>Subcategoria (só nas Receitas: Salário, Freela… dentro de Renda; 2026-10-22). Null = a categoria
    /// inteira. Sempre DA categoria.</summary>
    public Guid? SubcategoriaId { get; set; }

    /// <summary>Mês (1–12) a partir do qual este valor vale.</summary>
    public int Mes { get; set; }

    /// <summary>Ano a partir do qual este valor vale.</summary>
    public int Ano { get; set; }

    /// <summary>Limite de gasto por mês. 0 = tirou o limite (deste mês em diante).</summary>
    public decimal ValorLimite { get; set; }

    /// <summary>Percentual de alerta (0–100). Padrão: 80 (alerta ao atingir 80% do limite).</summary>
    public decimal PercentualAlerta { get; set; } = 80;

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public Categoria? Categoria { get; set; }
    public Subcategoria? Subcategoria { get; set; }
}
