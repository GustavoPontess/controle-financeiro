namespace ControleFinanceiro.Api.DTOs.Emprestimo;

public class EmprestimoDto
{
    public Guid Id { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public string Pessoa { get; set; } = string.Empty;
    public decimal ValorTotal { get; set; }
    public decimal ValorPago { get; set; }
    public decimal ValorRestante { get; set; }
    public decimal PercentualPago { get; set; }

    /// <summary>Soma das solicitações de pagamento Pendentes (ainda não avaliadas) — informativo,
    /// não conta em ValorPago/PercentualPago. Pro front mostrar "dinheiro reportado como pago,
    /// aguardando confirmação" sem alterar o saldo real de ninguém.</summary>
    public decimal ValorPendente { get; set; }

    /// <summary>Soma das solicitações Rejeitadas — só histórico visual, não afeta ValorPago.</summary>
    public decimal ValorRecusado { get; set; }
    public int Tipo { get; set; }
    public string TipoDescricao { get; set; } = string.Empty;
    public DateTime DataInicio { get; set; }
    public DateTime? DataVencimento { get; set; }
    public bool Quitado { get; set; }
    public bool Vencido { get; set; }
    public string? Observacao { get; set; }

    // Vínculo bilateral (docs/features/emprestimo-compartilhado/spec.md)
    public int StatusVinculo { get; set; }
    public string? ContraparteNome { get; set; }

    /// <summary>Relativo a quem pediu — não ao CriadoPor. Só quem é SouCredor confirma pagamento/quita.</summary>
    public bool SouCredor { get; set; }

    /// <summary>Lançamento (Transacao) vinculado — só existe se criado junto com o empréstimo.</summary>
    public Guid? TransacaoId { get; set; }

    // Forma de pagamento (docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md)
    public int FormaPagamento { get; set; }
    public decimal? TaxaJuroMensal { get; set; }
    public decimal? PercentualMultaAtraso { get; set; }

    /// <summary>Só preenchido se FormaPagamento == AVista e TaxaJuroMensal informada —
    /// ValorTotal já com o markup de juros aplicado (calculado uma vez na criação).</summary>
    public decimal? ValorComJuros { get; set; }

    /// <summary>Só preenchido se FormaPagamento == AVista, PercentualMultaAtraso informada, e
    /// venceu — snapshot da 1ª leitura após o vencimento, não recalcula depois.</summary>
    public decimal? ValorComMulta { get; set; }

    /// <summary>Só preenchido se FormaPagamento == Parcelado — pra lista decidir se mostra o
    /// chevron de expandir sem precisar buscar as parcelas.</summary>
    public int? QuantidadeParcelas { get; set; }

    /// <summary>Relativo a quem pediu (usuarioId) — true se ELE arquivou esse empréstimo, não
    /// reflete o lado da contraparte. Só é true se Quitado (arquivar só existe pra quitado).</summary>
    public bool Arquivado { get; set; }

    /// <summary>Setado se este empréstimo foi absorvido por uma consolidação aceita — aponta pro
    /// Emprestimo novo que o substituiu. Front usa isso pra explicar por que está Quitado sem
    /// pagamento de verdade ("consolidado em ...").
    /// Spec: docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md § "Unificar/consolidar".</summary>
    public Guid? ConsolidadoNoEmprestimoId { get; set; }
}
