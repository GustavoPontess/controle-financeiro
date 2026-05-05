namespace ControleFinanceiro.Api.DTOs.Fatura;

public class FaturaDto
{
    public Guid Id { get; set; }
    public Guid CartaoCreditoId { get; set; }
    public string CartaoCreditoNome { get; set; } = string.Empty;
    public DateTime DataInicio { get; set; }
    public DateTime DataFechamento { get; set; }
    public DateTime DataVencimento { get; set; }
    public int Status { get; set; }
    public string StatusDescricao { get; set; } = string.Empty;
    public decimal ValorTotal { get; set; }
    public decimal ValorPago { get; set; }
    public decimal ValorRestante { get; set; }
    public bool Vencida { get; set; }
}

public class FaturaDetalheDto : FaturaDto
{
    public List<FaturaTransacaoDto> Transacoes { get; set; } = new();
}

public class FaturaTransacaoDto
{
    public Guid Id { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public DateTime Data { get; set; }
    public Guid? CategoriaId { get; set; }
    public string? CategoriaDescricao { get; set; }
    public int? Parcelas { get; set; }
    public int? NumeroParcela { get; set; }
}

public class PagarFaturaDto
{
    public Guid ContaId { get; set; }
    public decimal Valor { get; set; }
    public DateTime DataPagamento { get; set; }
    public int MeioPagamento { get; set; } = 4; // Pix por padrão
}
