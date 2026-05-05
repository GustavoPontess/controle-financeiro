namespace ControleFinanceiro.Api.DTOs.Relatorios;

public class RelatorioMensalDto
{
    public List<EvolucaoMensalDto> EvolucaoMensal { get; set; } = new();
    public List<GastoPorCategoriaDto> GastosPorCategoria { get; set; } = new();
    public List<ComparacaoMesDto> ComparacaoUltimosMeses { get; set; } = new();
}

public class EvolucaoMensalDto
{
    public int Ano { get; set; }
    public int Mes { get; set; }
    public string MesLabel { get; set; } = string.Empty;
    public decimal Receitas { get; set; }
    public decimal Despesas { get; set; }
    public decimal Saldo { get; set; }
}

public class GastoPorCategoriaDto
{
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public decimal Percentual { get; set; }
}

public class ComparacaoMesDto
{
    public string MesLabel { get; set; } = string.Empty;
    public decimal Receitas { get; set; }
    public decimal Despesas { get; set; }
}
