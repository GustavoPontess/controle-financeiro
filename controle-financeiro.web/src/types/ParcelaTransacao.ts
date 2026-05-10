import { StatusParcela } from './Parcelamento'

export interface FaturaAtualizada {
  id: string
  estadoPagamento: number // 0=NaoPago, 1=Parcial, 2=Pago
  valorPago: number
  valorTotal: number
  valorRestante: number
}

export interface PagarParcelaPayload {
  contaPagamentoId: string
  dataPagamento?: string
  idempotencyKey: string
}

export interface PagarParcelaResultado {
  parcelaId: string
  status: StatusParcela
  pagoEm: string
  faturaAtualizada: FaturaAtualizada
  novoLimite: {
    cartaoId: string
    limiteTotal: number
    limiteBloqueado: number
    limiteDisponivel: number
    exposicaoFuturaPrevisao: number
  }
}

export interface CancelarParcelaPayload {
  motivo: string
  idempotencyKey: string
}

export interface CancelarParcelaResultado {
  parcelaId: string
  status: StatusParcela
  canceladoEm: string
  motivo: string
  novoLimite: {
    cartaoId: string
    limiteTotal: number
    limiteBloqueado: number
    limiteDisponivel: number
    exposicaoFuturaPrevisao: number
  }
}
