using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Recorrente;

public class CriarRecorrenteDto
{
    [Required]
    [MaxLength(255)] // como a descrição da transação que a cobrança vira (com 400, gerar a cobrança estourava)
    public string Descricao { get; set; } = string.Empty;

    [Range(0.01, double.MaxValue)]
    public decimal Valor { get; set; }

    [Required]
    public int Tipo { get; set; }

    public Guid? CategoriaId { get; set; }

    /// <summary>Opcional; tem que ser da <see cref="CategoriaId"/> (e visível pro usuário).</summary>
    public Guid? SubcategoriaId { get; set; }

    public Guid? ContaId { get; set; }

    public Guid? CartaoCreditoId { get; set; }

    /// <summary>Como paga/recebe (enum MeioPagamento). Opcional; no cartão vira Crédito; numa conta, Crédito é recusado.</summary>
    public int? MeioPagamento { get; set; }

    [Required]
    public int Frequencia { get; set; }

    [Range(1, 31)]
    public int Dia { get; set; }

    [Required]
    public DateTime DataInicio { get; set; }

    public DateTime? DataFim { get; set; }

    /// <summary>Conta fixa da casa: cada cobrança nasce dividida com essa família (só conta a pagar). Null = só sua.</summary>
    public Guid? FamiliaId { get; set; }
}
