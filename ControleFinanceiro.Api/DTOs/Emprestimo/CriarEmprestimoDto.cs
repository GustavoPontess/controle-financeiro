using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Emprestimo;

public class CriarEmprestimoDto
{
    public string Descricao { get; set; } = string.Empty;
    public string Pessoa { get; set; } = string.Empty;
    public decimal ValorTotal { get; set; }
    public TipoEmprestimo Tipo { get; set; }
    public DateTime DataInicio { get; set; }
    public DateTime? DataVencimento { get; set; }
    public string? Observacao { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;
}
