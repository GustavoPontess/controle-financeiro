using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

public class CartaoCredito
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? UltimosDigitos { get; set; }
    public BandeiraCartao Bandeira { get; set; } = BandeiraCartao.Outros;
    public bool TemCredito { get; set; }
    public bool TemDebito { get; set; }
    public bool EhPrePago { get; set; }

    /// <summary>
    /// DEPRECATED — substituído por LimiteTotal.
    /// Mantido até ETAPA 5 (migration de dados copia para LimiteTotal e dropa esta coluna).
    /// </summary>
    [Obsolete("Use LimiteTotal. Removido na ETAPA 5.")]
    public decimal? Limite { get; set; }

    /// <summary>
    /// Limite total de crédito do cartão. NOT NULL para cartões com TemCredito=true
    /// (validação de Service, não de domínio — schema permite null pra retrocompat
    /// com cartões debit-only legados).
    /// LimiteBloqueado e LimiteDisponivel são CALCULADOS (ver LimiteCalculatorService),
    /// não persistidos.
    /// </summary>
    public decimal? LimiteTotal { get; set; }

    public int? DiaFechamento { get; set; }
    public int? DiaVencimento { get; set; }
    public Guid? ContaId { get; set; }
    public Conta? Conta { get; set; }
    public Guid? BancoId { get; set; }
    public Banco? Banco { get; set; }
    public bool Ativo { get; set; } = true;
    public Guid CriadoPor { get; set; }
    public ICollection<Transacao> Transacoes { get; set; } = new List<Transacao>();
    public ICollection<Fatura> Faturas { get; set; } = new List<Fatura>();

    /// <summary>Parcelamentos ativos/históricos vinculados a este cartão.</summary>
    public ICollection<Parcelamento> Parcelamentos { get; set; } = new List<Parcelamento>();
}
