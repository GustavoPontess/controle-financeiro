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

    // Quanto já foi pago (para pagamento parcial → EstadoPagamento permanece Parcial até quitar)
    public decimal ValorPago { get; set; }

    /// <summary>
    /// Token de concorrência otimista. No Postgres é a coluna de sistema <c>xmin</c> (muda a cada
    /// UPDATE da linha) — não existe coluna nova. Sem isto, dois pagamentos simultâneos liam o mesmo
    /// ValorPago e o segundo sobrescrevia o primeiro (lost update → pagamento acima do restante).
    /// Com o token, o UPDATE perdedor afeta 0 linhas → DbUpdateConcurrencyException → 409.
    /// </summary>
    public uint Versao { get; set; }

    public Guid CriadoPor { get; set; }

    public ICollection<Transacao> Transacoes { get; set; } = new List<Transacao>();

    // ── 3 flags ortogonais (ARQUITETURA_PARCELAMENTO.md § "Fatura (Mudanças)") ──

    /// <summary>Dimensão "ciclo": Aberta aceita transações; Fechada aguarda pagamento.</summary>
    public EstadoCicloFatura EstadoCiclo { get; set; } = EstadoCicloFatura.Aberta;

    /// <summary>Dimensão "pagamento": NaoPago, Parcial, Pago.</summary>
    public EstadoPagamentoFatura EstadoPagamento { get; set; } = EstadoPagamentoFatura.NaoPago;

    /// <summary>
    /// Dimensão "atraso": true se DataVencimento passou e ainda resta pagar
    /// (<c>RegrasFinanceiras.ValorRestanteFatura</c> &gt; 0) — não basta EstadoPagamento != Pago.
    /// </summary>
    public bool EstaAtrasada { get; set; }

    /// <summary>Quando o ciclo virou Fechada (snapshot pra auditoria).</summary>
    public DateTime? DataFechamentoEfetiva { get; set; }

    /// <summary>Quando virou Pago.</summary>
    public DateTime? DataPagamentoTotal { get; set; }

    /// <summary>Juros de mora acumulados (atualizado pelo FaturaAtrasoJob).</summary>
    public decimal JurosDeMora { get; set; }

    /// <summary>Multa por atraso (lançada uma única vez pelo job).</summary>
    public decimal Multa { get; set; }

    // ── Navegações pra novas entidades ──

    /// <summary>Parcelas que vencem nesta fatura.</summary>
    public ICollection<ParcelaTransacao> ParcelasTransacao { get; set; } = new List<ParcelaTransacao>();
}
