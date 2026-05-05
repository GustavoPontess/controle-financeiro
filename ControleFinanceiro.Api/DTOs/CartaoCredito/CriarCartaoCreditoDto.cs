using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.CartaoCredito;

public class CriarCartaoCreditoDto
{
    public string Nome { get; set; } = string.Empty;
    public string? UltimosDigitos { get; set; }
    public BandeiraCartao Bandeira { get; set; } = BandeiraCartao.Outros;
    public bool TemCredito { get; set; }
    public bool TemDebito { get; set; }
    public bool EhPrePago { get; set; }
    public decimal? Limite { get; set; }
    public int? DiaFechamento { get; set; }
    public int? DiaVencimento { get; set; }
    public Guid? ContaId { get; set; }
    public Guid? BancoId { get; set; }
}
