using ControleFinanceiro.Api.DTOs.DinheiroDoMes;

namespace ControleFinanceiro.Api.DTOs.Orcamento;

/// <summary>
/// O orçamento do mês (tela Orçamento do v2, que juntou Renda e Limites; pedido do Gustavo em 2026-10-21, a partir
/// da planilha dele): a renda esperada distribuída entre as despesas planejadas (os limites) e o que as metas pedem.
/// O que sobra sem destino é o "a ser alocado"; zerado, toda a renda tem destino.
/// </summary>
public record OrcamentoDoMesDto(
    int Ano,
    int Mes,
    decimal RendaEsperada,
    decimal RendaRecebida,
    decimal DespesasPlanejadas,
    decimal DespesasGastas,
    decimal PraGuardar,
    decimal GuardadoNoMes,
    List<MetaDoOrcamentoDto> Metas,
    decimal AAlocar,
    RespostaDto Resposta);

/// <summary>Uma meta em andamento: quanto pede por mês pra chegar no prazo e quanto foi guardado nela no mês.</summary>
public record MetaDoOrcamentoDto(Guid Id, string Nome, string Icone, decimal PorMes, decimal GuardadoNoMes, decimal Falta);
