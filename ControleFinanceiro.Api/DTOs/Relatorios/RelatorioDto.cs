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

// ── Relatório customizado por período ────────────────────────────────────────

/// <summary>
/// Resultado do relatório customizado com filtros de período, categoria, tipo e conta.
/// </summary>
public class RelatorioPeriodoDto
{
    /// <summary>Data inicial do período analisado.</summary>
    public DateTime DataInicio { get; set; }

    /// <summary>Data final do período analisado.</summary>
    public DateTime DataFim { get; set; }

    /// <summary>Soma de todas as receitas no período (após filtros).</summary>
    public decimal TotalReceitas { get; set; }

    /// <summary>Soma de todas as despesas no período (após filtros).</summary>
    public decimal TotalDespesas { get; set; }

    /// <summary>Saldo líquido = Receitas − Despesas.</summary>
    public decimal Saldo => TotalReceitas - TotalDespesas;

    /// <summary>Quantidade de transações incluídas no relatório.</summary>
    public int TotalTransacoes { get; set; }

    /// <summary>Gastos agrupados por categoria, ordenados do maior para o menor.</summary>
    public List<GastoPorCategoriaDto> GastosPorCategoria { get; set; } = new();

    /// <summary>Gastos agrupados por meio de pagamento.</summary>
    public List<GastoPorMeioPagamentoDto> GastosPorMeioPagamento { get; set; } = new();

    /// <summary>Evolução diária de receitas e despesas dentro do período.</summary>
    public List<EvolucaoDiariaDto> EvolucaoDiaria { get; set; } = new();

    /// <summary>Lista das transações que compõem o relatório (para CSV/detalhe).</summary>
    public List<TransacaoRelatorioDto> Transacoes { get; set; } = new();
}

public class GastoPorMeioPagamentoDto
{
    public string MeioPagamento { get; set; } = "Não informado";
    public decimal Valor { get; set; }
    public decimal Percentual { get; set; }
}

public class EvolucaoDiariaDto
{
    public DateOnly Data { get; set; }
    public decimal Receitas { get; set; }
    public decimal Despesas { get; set; }
}

/// <summary>Linha de transação para uso em relatórios e export CSV.</summary>
public class TransacaoRelatorioDto
{
    public Guid Id { get; set; }
    public DateTime Data { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public string? Categoria { get; set; }
    public string? Conta { get; set; }
    public string? MeioPagamento { get; set; }
}
