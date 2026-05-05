namespace ControleFinanceiro.Api.DTOs.Dashboard;

public class DashboardDto
{
    public decimal SaldoTotal { get; set; }
    public decimal ReceitasMes { get; set; }
    public decimal DespesasMes { get; set; }
    public decimal SaldoMes { get; set; }
    public List<CategoriaGastoDto> TopCategorias { get; set; } = new();
    public List<TransacaoRecenteDto> TransacoesRecentes { get; set; } = new();
    public List<SaldoContaDto> SaldoContas { get; set; } = new();
}

public class CategoriaGastoDto
{
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public decimal Percentual { get; set; }
}

public class TransacaoRecenteDto
{
    public Guid Id { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public int Tipo { get; set; }
    public Guid? CategoriaId { get; set; }
    public string? Categoria { get; set; }
    public Guid? ContaId { get; set; }
    public Guid? CartaoCreditoId { get; set; }
    public string? Conta { get; set; }
    public int? MeioPagamento { get; set; }
    public string? MeioPagamentoDescricao { get; set; }
    public DateTime Data { get; set; }
}

public class SaldoContaDto
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public decimal Saldo { get; set; }
    public int Tipo { get; set; }
    public string TipoDescricao { get; set; } = string.Empty;
}
