namespace ControleFinanceiro.Api.DTOs.Transacao;

/// <summary>
/// O topo da visão Gastos de Transações: o total do que a lista mostra (com os mesmos filtros) e quanto disso foi em
/// conta e quanto no cartão (compra parcelada pelo total, na data da compra). Somado no banco.
/// </summary>
public record ResumoGastosDto(decimal Total, decimal EmConta, decimal NoCartao);
