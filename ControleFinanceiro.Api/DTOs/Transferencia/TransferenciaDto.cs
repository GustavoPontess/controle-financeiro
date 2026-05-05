namespace ControleFinanceiro.Api.DTOs.Transferencia;

public class CriarTransferenciaDto
{
    public Guid ContaOrigemId { get; set; }
    public Guid ContaDestinoId { get; set; }
    public decimal Valor { get; set; }
    public DateTime Data { get; set; }
    public string Descricao { get; set; } = string.Empty;
}

public class TransferenciaDto
{
    public Guid Id { get; set; }
    public Guid ContaOrigemId { get; set; }
    public string ContaOrigemNome { get; set; } = string.Empty;
    public Guid ContaDestinoId { get; set; }
    public string ContaDestinoNome { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public DateTime Data { get; set; }
    public string Descricao { get; set; } = string.Empty;
}
