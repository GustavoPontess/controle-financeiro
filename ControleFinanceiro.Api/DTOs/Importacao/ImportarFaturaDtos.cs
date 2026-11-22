namespace ControleFinanceiro.Api.DTOs.Importacao;

/// <summary>
/// Uma fatura que apareceu nos arquivos: quando vence, quantos lançamentos e quanto de compra (à vista + parcelas) e
/// como ela fica depois de importar. <c>Situacao</c>: "paga-pela-conta" (o pagamento do extrato da conta é dela),
/// "paga" (fatura antiga: o banco já cobrou, conta como paga fora do app), "a-pagar" (ainda não venceu).
/// </summary>
public record FaturaLidaDto(DateOnly Vencimento, int Lancamentos, decimal Compras, string Situacao, decimal PagoPelaConta);

/// <summary>
/// A leitura dos arquivos da fatura do cartão (nada é salvo). Compras à vista, compras parceladas (cada uma vira UM
/// parcelamento, com as parcelas que faltam nas faturas seguintes), o que já estava no app e o que fica de fora:
/// o "Pagamento recebido" (é o pagamento que saiu da conta, já registrado lá) e os créditos/estornos do cartão.
/// </summary>
public record PreviewFaturaDto(
    int Compras, decimal ValorCompras, int Parcelamentos, int JaNoApp,
    int Pagamentos, int Creditos, decimal ValorCreditos, int SemCategoria,
    List<FaturaLidaDto> Faturas, List<ArquivoLidoDto> Arquivos);

/// <summary>O que entrou: compras à vista, parcelamentos novos, pagamentos da conta ligados às faturas e quantas
/// faturas antigas ficaram como pagas. <c>Repetido</c>: a mesma importação (Idempotency-Key) já tinha entrado.</summary>
public record ResultadoFaturaDto(
    int Compras, int Parcelamentos, int JaNoApp, int PagamentosLigados, int FaturasPagas, int SemCategoria, bool Repetido = false);
