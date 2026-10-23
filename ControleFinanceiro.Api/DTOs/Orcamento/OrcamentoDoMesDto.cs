using ControleFinanceiro.Api.DTOs.DinheiroDoMes;

namespace ControleFinanceiro.Api.DTOs.Orcamento;

/// <summary>
/// O orçamento do mês (tela Orçamento do v2, que juntou Renda e Limites; pedido do Gustavo em 2026-10-21, a partir
/// da planilha dele): a renda esperada distribuída entre as despesas planejadas e os investimentos planejados. O que
/// sobra sem destino é o "a ser alocado"; zerado, toda a renda tem destino.
/// </summary>
public record OrcamentoDoMesDto(
    int Ano,
    int Mes,
    decimal RendaEsperada,
    decimal RendaRecebida,
    decimal DespesasPlanejadas,
    decimal DespesasGastas,
    /// <summary>O planejado das fontes de investimento (Tesouro, Ações…).</summary>
    decimal InvestimentosPlanejados,
    /// <summary>Investido no mês: aportes menos resgates nas fontes.</summary>
    decimal Investido,
    decimal AAlocar,
    RespostaDto Resposta);
