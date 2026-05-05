export interface Transaction {
  id: string
  descricao: string
  valor: number
  tipo: number
  categoriaId: string | null
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
  data: string
}