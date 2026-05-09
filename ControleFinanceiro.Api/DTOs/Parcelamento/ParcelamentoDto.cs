using ControleFinanceiro.Api.Domain.Enums;

namespace ControleFinanceiro.Api.DTOs.Parcelamento;

/// <summary>Representação de um parcelamento na listagem.</summary>
public class ParcelamentoDto
{
    public Guid Id { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public TipoParcelamento Tipo { get; set; }
    public DateTime DataCompra { get; set; }

    public Guid CartaoCreditoId { get; set; }
    public string CartaoCreditoNome { get; set; } = string.Empty;

    public Guid? CategoriaId { get; set; }

    public int QuantidadeParcelas { get; set; }
    public int ParcelasPagas { get; set; }

    /// <summary>Valor total sem juros (principal).</summary>
    public decimal ValorOriginal { get; set; }

    /// <summary>Valor total com juros — null em CompraParcelada (sem juros).</summary>
    public decimal? ValorComJuros { get; set; }

    public decimal? TaxaJuroMensal { get; set; }

    /// <summary>Soma dos valores das parcelas Pagas.</summary>
    public decimal ValorPago { get; set; }

    /// <summary>(ValorComJuros ?? ValorOriginal) - ValorPago.</summary>
    public decimal ValorRestante { get; set; }

    /// <summary>Próxima parcela Pendente (ordenada por DataVencimento). Null se nenhuma.</summary>
    public ProximaParcelaDto? ProximaParcela { get; set; }

    public bool Ativo { get; set; }
    public DateTime? CanceladoEm { get; set; }
    public string? MotivoCancelamento { get; set; }
    public DateTime CriadoEm { get; set; }
}

/// <summary>Slice mínimo da próxima parcela — exibido em cards de dashboard.</summary>
public class ProximaParcelaDto
{
    public Guid Id { get; set; }
    public int Numero { get; set; }
    public DateTime DataVencimento { get; set; }
    public decimal Valor { get; set; }
    public decimal? ValorComJuros { get; set; }
    public Guid FaturaId { get; set; }
}

/// <summary>Detalhe de um parcelamento — inclui todas as parcelas.</summary>
public class ParcelamentoDetalheDto : ParcelamentoDto
{
    public List<ParcelaDto> Parcelas { get; set; } = new();
}

/// <summary>Parcela individual dentro do detalhe do parcelamento.</summary>
public class ParcelaDto
{
    public Guid Id { get; set; }
    public int Numero { get; set; }
    public int QuantidadeTotal { get; set; }
    public DateTime DataVencimento { get; set; }
    public decimal Valor { get; set; }
    public decimal? ValorComJuros { get; set; }
    public decimal? TaxaJuro { get; set; }
    public decimal? IOF { get; set; }
    public StatusParcela Status { get; set; }
    public Guid FaturaId { get; set; }

    /// <summary>Mês de referência da fatura (DataFechamento).</summary>
    public DateTime FaturaMesReferencia { get; set; }

    public DateTime? PagoEm { get; set; }
    public DateTime? CanceladoEm { get; set; }
    public string? MotivoCancelamento { get; set; }
}
