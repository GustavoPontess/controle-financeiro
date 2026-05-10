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
  categoriaId?: string
  categoriaDescricao?: string
  parcelas?: number
  numeroParcela?: number
}

export interface FaturaDetalhe extends Fatura {
  transacoes: FaturaTransacao[]
}

export interface PagarFaturaPayload {
  contaId: string
  valor: number
  dataPagamento: string
  meioPagamento: number
}
