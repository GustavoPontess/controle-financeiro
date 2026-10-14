export interface Fatura {
  id: string
  cartaoCreditoId: string
  cartaoCreditoNome: string
  dataInicio: string
  dataFechamento: string
  dataVencimento: string
  // Legacy (retrocompat até ETAPA 5b)
  status: number        // 1=Aberta, 2=Fechada, 3=Paga
  statusDescricao: string
  // 3 flags ortogonais (ARQUITETURA_PARCELAMENTO.md)
  estadoCiclo: number   // 0=Aberta, 1=Fechada
  estadoPagamento: number // 0=NaoPago, 1=Parcial, 2=Pago
  estaAtrasada: boolean
  dataPagamentoTotal?: string
  valorTotal: number
  valorPago: number
  valorRestante: number
  vencida: boolean
}

export interface FaturaTransacao {
  id: string
  descricao: string
  valor: number
  data: string
  criadoEm: string
  categoriaId?: string
  categoriaDescricao?: string
  parcelas?: number
  numeroParcela?: number
}

export interface FaturaPagamento {
  id: string
  valor: number
  data: string
  criadoEm: string
  meioPagamento: number
  meioPagamentoDescricao: string
}

// Parcela de parcelamento que caiu na fatura (entra no total; a cancelada não vem).
export interface FaturaParcela {
  id: string
  parcelamentoId: string
  descricao: string       // do parcelamento
  numero: number          // o "2" de 2/3
  quantidadeTotal: number // o "3" de 2/3
  valor: number           // o mesmo que entra no total (com juros quando houver)
  data: string            // data da compra do parcelamento
  criadoEm: string        // ordena a linha do tempo, igual às compras
  categoriaId?: string
  categoriaDescricao?: string
  status: number          // 0=Pendente, 1=Paga — informativo, a tela não marca linha como paga
}

export interface FaturaDetalhe extends Fatura {
  transacoes: FaturaTransacao[]
  parcelas: FaturaParcela[]
  pagamentos: FaturaPagamento[]
}

export interface PagarFaturaPayload {
  contaId: string
  valor: number
  dataPagamento: string
  meioPagamento: number
}

/** Como a fatura ficou depois de estornar um pagamento. */
export interface EstornoPagamentoResultado {
  pagamentoId: string
  faturaId: string
  valorEstornado: number
  valorPagoFatura: number
  restanteFatura: number
}
