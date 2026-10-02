export interface Transaction {
  id: string
  descricao: string
  valor: number
  tipo: number
  categoriaId: string | null
  subcategoriaId?: string | null
  contaId?: string
  contaNome?: string
  cartaoCreditoId?: string
  cartaoCreditoNome?: string
  usadoComoCredito?: boolean
  meioPagamento?: number
  meioPagamentoDescricao?: string
  faturaId?: string
  parcelas?: number
  numeroParcela?: number
  // Origem do lançamento — usados pra rotular a natureza na lista
  // (recorrente / parcelado / pagamento de fatura) quando não há hora.
  recorrenteOrigemId?: string | null
  parcelamentoId?: string | null
  parcelaTransacaoId?: string | null
  ehPagamentoFatura?: boolean
  // Perna de transferência entre contas próprias — neutra no extrato.
  ehTransferencia?: boolean
  // 0 = Previsao, 1 = Executado, 2 = Cancelado (resposta).
  statusTransacao?: number
  // Envio na criação: true = já recebido/pago (Executado); false = previsão.
  efetivado?: boolean
  /** Dia do lançamento, "YYYY-MM-DD" (date puro, sem fuso). */
  data: string
  /** Hora do lançamento, "HH:MM:SS" — ou null/ausente quando não tem hora. */
  hora?: string | null
}