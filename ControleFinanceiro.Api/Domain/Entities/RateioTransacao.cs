using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>Issue #25 — cota personalizada de um membro numa despesa compartilhada.
/// Só existe para transações em modo de rateio Personalizado.</summary>
public class RateioTransacao
{
    public Guid Id { get; set; }

    public Guid TransacaoId { get; set; }
    public Transacao? Transacao { get; set; }

    public Guid UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }

    /// <summary>Percentual da despesa atribuído ao membro (0–100). A soma dos
    /// itens de uma transação é 100.</summary>
    [Range(0, 100)]
    public decimal Percentual { get; set; }
}
