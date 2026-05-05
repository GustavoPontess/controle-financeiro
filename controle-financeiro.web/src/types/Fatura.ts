export interface Fatura {
  id: string
  cartaoCreditoId: string
  cartaoCreditoNome: string
  dataInicio: string
  dataFechamento: string
  dataVencimento: string
  status: number        // 1=Aberta, 2=Fechada, 3=Paga
  statusDescricao: string
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
