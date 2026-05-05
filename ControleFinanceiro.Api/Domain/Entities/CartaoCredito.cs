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
    public decimal? Limite { get; set; }
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
}
