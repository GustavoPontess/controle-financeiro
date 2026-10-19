using ControleFinanceiro.Api.DTOs.DinheiroDoMes;

namespace ControleFinanceiro.Api.DTOs.Emprestimo;

/// <summary>
/// Uma parcela (ou o empréstimo à vista) que vence nos próximos 30 dias, ou que já venceu e ainda falta.
/// <c>Quem</c>: a pessoa ou o banco do outro lado. <c>Parcela</c>/<c>DeParcelas</c>: "4 de 12" (null à vista).
/// </summary>
public record VencimentoEmprestimoDto(Guid EmprestimoId, string Quem, string Descricao, DateTime Data, decimal Valor,
    bool Venceu, int? Parcela, int? DeParcelas);

/// <summary>
/// O topo de Empréstimos: a frase (<c>Resposta</c>, null quando nada vence), o que a pessoa devolve e o que volta pra ela
/// nos próximos 30 dias (inclui o que já venceu), e o saldo nas contas hoje.
/// </summary>
public record ProximosEmprestimosDto(RespostaDto? Resposta, List<VencimentoEmprestimoDto> Devolver,
    List<VencimentoEmprestimoDto> Voltar, decimal SaldoNasContas);
