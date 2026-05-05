using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.Domain.Entities;

public class Fatura
{
    public Guid Id { get; set; }
    public Guid CartaoCreditoId { get; set; }
    public CartaoCredito CartaoCredito { get; set; } = null!;

    public DateTime DataInicio { get; set; }
    public DateTime DataFechamento { get; set; }
    public DateTime DataVencimento { get; set; }

    public StatusFatura Status { get; set; } = StatusFatura.Aberta;

    // Quanto já foi pago (para pagamento parcial → Status permanece Aberta até quitar total)
    public decimal ValorPago { get; set; }

    public Guid CriadoPor { get; set; }

    public ICollection<Transacao> Transacoes { get; set; } = new List<Transacao>();
}
