namespace ControleFinanceiro.Api.DTOs.Dashboard;

public class DashboardDto
{
    public decimal SaldoTotal { get; set; }
    /// <summary>Saldo no fim do mês anterior — pra hero calcular variação.</summary>
    public decimal SaldoMesAnterior { get; set; }
    public decimal ReceitasMes { get; set; }
    public decimal DespesasMes { get; set; }
    public decimal SaldoMes { get; set; }

    // 6 KPIs do mês (#81). Receitas = Recebido + AReceber; Despesas = Pago + APagar.
    // Recebido/Pago = StatusTransacao.Executado | AReceber/APagar = StatusTransacao.Previsao.
    public decimal Recebido { get; set; }
    public decimal AReceber { get; set; }
    public decimal Pago { get; set; }
    public decimal APagar { get; set; }

    // ── KPIs de FLUXO DE CAIXA do mês — alinhados com /transacoes/stats ──
    // Excluem UsadoComoCredito (compras de crédito não saem do caixa até a
    // fatura ser paga). Usado pelos cards "Entrou / Saiu / Sobrou" do
    // Dashboard (#181) pra falar a mesma língua que /transactions.
    public decimal EntradasCaixa { get; set; }
    public decimal SaidasCaixa { get; set; }
    public decimal SaldoCaixaMes { get; set; }

    public List<EvolucaoMesDto> EvolucaoSaldo { get; set; } = new();
    public List<CategoriaGastoDto> TopCategorias { get; set; } = new();
    public List<TransacaoRecenteDto> TransacoesRecentes { get; set; } = new();
    public List<SaldoContaDto> SaldoContas { get; set; } = new();
    /// <summary>Top 3 cartões ativos por % do limite usado (desc).</summary>
    public List<CartaoResumoDto> CartoesResumo { get; set; } = new();
}

/// <summary>
/// Resumo de cartão pra widget do dashboard. Limite usado + próximo fechamento.
/// </summary>
public class CartaoResumoDto
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? BancoNome { get; set; }
    public string? BancoLogoUrl { get; set; }
    public string? BancoCor { get; set; }
    public decimal LimiteTotal { get; set; }
    public decimal LimiteUsado { get; set; }
    public decimal LimiteDisponivel { get; set; }
    /// <summary>0..100. Calculado server-side.</summary>
    public decimal PercentualUsado { get; set; }
    /// <summary>Próximo fechamento (atual se ainda no futuro, senão próximo mês).</summary>
    public DateTime? ProximoFechamento { get; set; }
    /// <summary>Dias até próximo fechamento. Negativo se passou.</summary>
    public int? DiasAteFechamento { get; set; }
}

/// <summary>Ponto da série de evolução do saldo (gráfico de área do dashboard).</summary>
public class EvolucaoMesDto
{
    public string Label { get; set; } = string.Empty;
    public int Ano { get; set; }
    public int Mes { get; set; }
    /// <summary>Saldo de caixa acumulado até o fim desse mês.</summary>
    public decimal Saldo { get; set; }
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
    public bool IsCarteira { get; set; }
    public string? BancoNome { get; set; }
    public string? LogoUrl { get; set; }
    public string? Cor { get; set; }
}
