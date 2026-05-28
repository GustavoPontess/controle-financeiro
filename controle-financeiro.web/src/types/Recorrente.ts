export interface Recorrente {
  id: string
  descricao: string
  valor: number
  tipo: number
  tipoDescricao: string
  categoriaId?: string
  categoriaNome?: string
  contaId?: string
  contaNome?: string
  cartaoCreditoId?: string
  cartaoCreditoNome?: string
  frequencia: number
  frequenciaDescricao: string
  dia: number
  dataInicio: string
  dataFim?: string
  ativo: boolean
  dataProximaGeracao?: string
  canceladoEm?: string
  motivoCancelamento?: string
}

export interface EditarProximaDto {
  valor?: number
  descricao?: string
  categoriaId?: string
}

export interface CancelarRecorrenteDto {
  motivo: string
}

export interface CriarRecorrente {
  descricao: string
  valor: number
  tipo: number
  categoriaId?: string
  contaId?: string
  cartaoCreditoId?: string
  frequencia: number
  dia: number
  dataInicio: string
  dataFim?: string
}
