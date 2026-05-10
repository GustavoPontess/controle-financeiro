export enum TipoParcelamento {
  CompraParcelada = 0,
  PIXCredito = 1,
  Recorrente = 2,
}

export enum StatusParcela {
  Pendente = 0,
  Paga = 1,
  Cancelada = 2,
}

export interface Parcelamento {
  id: string
  descricao: string
  tipo: TipoParcelamento
  dataCompra: string
  cartaoCreditoId: string
  cartaoCreditoNome: string
  categoriaId?: string
  quantidadeParcelas: number
  parcelasPagas: number
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
  faturaMesReferencia: string
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
