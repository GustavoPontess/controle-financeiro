using System.ComponentModel.DataAnnotations;

namespace ControleFinanceiro.Api.DTOs.Recorrente;

public class EditarProximaOcorrenciaDto
{
    public decimal? Valor { get; set; }

    [MaxLength(255)] // como a descrição da transação que a cobrança vira (com 400, gerar a cobrança estourava)
    public string? Descricao { get; set; }
    public Guid? CategoriaId { get; set; }
}
