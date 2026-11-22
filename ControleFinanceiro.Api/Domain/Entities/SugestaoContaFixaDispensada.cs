using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.Domain.Entities;

/// <summary>
/// "Não é conta fixa" (fatura-a-detalhar.md, passo 5): a pessoa dispensou a sugestão de virar conta fixa a cobrança que
/// se repete no cartão. Uma por cartão e lugar; a sugestão daquele lugar não volta. Some com o cartão e com a pessoa
/// (cascade) e sai na exportação LGPD.
/// </summary>
public class SugestaoContaFixaDispensada
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }
    public Guid CartaoCreditoId { get; set; }

    /// <summary>O lugar (ver <see cref="Services.Estabelecimento.Chave"/>).</summary>
    [Required]
    [MaxLength(Services.Estabelecimento.ChaveMaxLength)]
    public string Chave { get; set; } = string.Empty;

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
