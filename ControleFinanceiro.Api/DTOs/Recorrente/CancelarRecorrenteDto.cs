namespace ControleFinanceiro.Api.DTOs.Recorrente;

public class CancelarRecorrenteDto
{
    public string Motivo { get; set; } = string.Empty;
    public string? IdempotencyKey { get; set; }
}
