export const TipoParcelamento = {
  CompraParcelada: 0,
  PIXCredito: 1,
  Recorrente: 2,
} as const

export const StatusParcela = {
  Pendente: 0,
  Paga: 1,
  Cancelada: 2,
} as const

export type TipoParcelamento = typeof TipoParcelamento[keyof typeof TipoParcelamento]
export type StatusParcela = typeof StatusParcela[keyof typeof StatusParcela]

export interface Parcelamento {
  id: string
  descricao: string
  tipo: TipoParcelamento
  dataCompra: string
  cartaoCreditoId: string
  cartaoCreditoNome: string
  categoriaId?: string
  quantidadeParcelas: number
  /** Pagas no total — inclui as pagas antes de registrar. */
  parcelasPagas: number
  /** Compra em andamento: pagas antes de o parcelamento entrar no app (fora da lista de parcelas). */
  parcelasPagasAntes: number
  valorPagoAntes: number
  valorOriginal: number
  valorComJuros?: number
  taxaJuroMensal?: number
  valorPago: number
  valorRestante: number
  proximaParcela?: ProximaParcela
  ativo: boolean
  canceladoEm?: string
  motivoCancelamento?: string
  criadoEm: string
}

export interface ProximaParcela {
  id: string
  numero: number
  dataVencimento: string
  valor: number
  valorComJuros?: number
  faturaId: string
  /** Fechamento da fatura da parcela — o mês dela é o rótulo da fatura em Cartões. */
  faturaMesReferencia: string
  /** Vencimento real da fatura da parcela. */
  faturaDataVencimento: string
}

export interface ParcelaDto {
  id: string
  numero: number
  quantidadeTotal: number
  dataVencimento: string
  valor: number
  valorComJuros?: number
  taxaJuro?: number
  iof?: number
  status: StatusParcela
  faturaId: string
  /** Fechamento da fatura da parcela — o mês dela é o rótulo da fatura em Cartões. */
  faturaMesReferencia: string
  /** Vencimento real da fatura da parcela. */
  faturaDataVencimento: string
  pagoEm?: string
  canceladoEm?: string
  motivoCancelamento?: string
}

export interface ParcelamentoDetalhe extends Parcelamento {
  parcelas: ParcelaDto[]
}

export interface LimiteSnapshot {
  cartaoId: string
  limiteTotal: number
  limiteBloqueado: number
  limiteDisponivel: number
  exposicaoFuturaPrevisao: number
}

export interface CriarParcelamentoPayload {
  descricao: string
  valor: number
  tipo: TipoParcelamento
  cartaoCreditoId: string
  dataCompra: string
  parcelas: number
  /** Compra em andamento: quantas já foram pagas (0 = compra nova). */
  parcelasJaPagas?: number
  /** Fatura (mês em que fecha) da parcela 1 — mesmo na compra em andamento. */
  primeiraParcelaMes: string
  categoriaId?: string
  taxaJuroMensal?: number
  idempotencyKey: string
}

export interface CancelarParcelamentoPayload {
  motivo: string
  idempotencyKey: string
}

export interface CancelamentoResultado {
  parcelamentoId: string
  canceladas: number
  jaPagas: number
  requerEstorno: boolean
  novoLimite: LimiteSnapshot
}
