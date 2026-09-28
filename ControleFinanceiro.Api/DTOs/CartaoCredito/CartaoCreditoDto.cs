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
    /// <summary>Limite − usado. Negativo quando o usado passou do limite (estouro). Null sem crédito.</summary>
    public decimal? LimiteDisponivel { get; set; }

    /// <summary>
    /// Quanto do limite está em uso: o que as faturas cobram (parcelas futuras incluídas) menos o que já
    /// foi pago — regra única de <c>RegrasFinanceiras</c>, o mesmo número do LimiteCalculator. Substitui o
    /// antigo <c>GastosNoCicloAtual</c> (só compras à vista do ciclo, sem parcelas). Null sem crédito.
    /// </summary>
    public decimal? LimiteUsado { get; set; }
    public int? DiaFechamento { get; set; }
    public int? DiaVencimento { get; set; }
    public Guid? ContaId { get; set; }
    public string? ContaNome { get; set; }
    public Guid? BancoId { get; set; }
    public string? BancoNome { get; set; }
    public string? BancoLogoUrl { get; set; }
    public string? BancoCor { get; set; }
    public bool Ativo { get; set; }
}
