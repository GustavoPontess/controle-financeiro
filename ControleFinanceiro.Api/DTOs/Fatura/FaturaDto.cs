namespace ControleFinanceiro.Api.DTOs.Fatura;

public class FaturaDto
{
    public Guid Id { get; set; }
    public Guid CartaoCreditoId { get; set; }
    public string CartaoCreditoNome { get; set; } = string.Empty;
    public DateTime DataInicio { get; set; }
    public DateTime DataFechamento { get; set; }
    public DateTime DataVencimento { get; set; }

    // ── 3 flags ortogonais (ARQUITETURA_PARCELAMENTO.md § "Fatura (Mudanças)") ──
    /// <summary>0=Aberta, 1=Fechada</summary>
    public int EstadoCiclo { get; set; }
    /// <summary>0=NaoPago, 1=Parcial, 2=Pago</summary>
    public int EstadoPagamento { get; set; }
    public bool EstaAtrasada { get; set; }
    public DateTime? DataPagamentoTotal { get; set; }

    public decimal ValorTotal { get; set; }
    public decimal ValorPago { get; set; }
    public decimal ValorRestante { get; set; }
    public bool Vencida { get; set; }
}

public class FaturaDetalheDto : FaturaDto
{
    public List<FaturaTransacaoDto> Transacoes { get; set; } = new();

    /// <summary>Pagamentos registrados nesta fatura (transações com FaturaPagaId).</summary>
    public List<FaturaPagamentoDto> Pagamentos { get; set; } = new();
}

public class FaturaPagamentoDto
{
    public Guid Id { get; set; }
    public decimal Valor { get; set; }
    public DateTime Data { get; set; }
    public int MeioPagamento { get; set; }
    public string MeioPagamentoDescricao { get; set; } = string.Empty;
}

public class FaturaTransacaoDto
{
    public Guid Id { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public DateTime Data { get; set; }
    public DateTime CriadoEm { get; set; }
    public Guid? CategoriaId { get; set; }
    public string? CategoriaDescricao { get; set; }
}

public class PagarFaturaDto
{
    public Guid ContaId { get; set; }
    public decimal Valor { get; set; }
    public DateTime DataPagamento { get; set; }
    public int MeioPagamento { get; set; } = 4; // Pix por padrão
}
