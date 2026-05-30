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
  // 0 = Previsao, 1 = Executado, 2 = Cancelado (resposta).
  statusTransacao?: number
  // Envio na criação: true = já recebido/pago (Executado); false = previsão.
  efetivado?: boolean
  data: string
}