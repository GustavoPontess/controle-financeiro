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

    /// <summary>Só preenchido se FormaPagamento == Parcelado — pra lista decidir se mostra o
    /// chevron de expandir sem precisar buscar as parcelas.</summary>
    public int? QuantidadeParcelas { get; set; }
}
