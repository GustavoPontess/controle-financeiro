using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

public class Emprestimo
{
    public Guid Id { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public string Pessoa { get; set; } = string.Empty;
    public decimal ValorTotal { get; set; }
    public decimal ValorPago { get; set; } = 0;
    public TipoEmprestimo Tipo { get; set; }
    public DateTime DataInicio { get; set; }
    public DateTime? DataVencimento { get; set; }
    public bool Quitado { get; set; } = false;
    public string? Observacao { get; set; }
    public Guid CriadoPor { get; set; }
}
