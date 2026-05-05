namespace ControleFinanceiro.Api.DTOs.CartaoCredito;

public class CartaoCreditoDto
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? UltimosDigitos { get; set; }
    public int Bandeira { get; set; }
    public string BandeiraDescricao { get; set; } = string.Empty;
    public bool TemCredito { get; set; }
    public bool TemDebito { get; set; }
    public bool EhPrePago { get; set; }
    public decimal? Limite { get; set; }
    public decimal? LimiteDisponivel { get; set; }
    public decimal GastosNoCicloAtual { get; set; }
    public int? DiaFechamento { get; set; }
    public int? DiaVencimento { get; set; }
    public Guid? ContaId { get; set; }
    public string? ContaNome { get; set; }
    public Guid? BancoId { get; set; }
    public string? BancoNome { get; set; }
    public bool Ativo { get; set; }
}
