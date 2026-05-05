export interface Recorrente {
  id: string
  descricao: string
  valor: number
  tipo: number
  tipoDescricao: string
  categoriaId?: string
  categoriaNome?: string
  contaId: string
  contaNome: string
  frequencia: number
  frequenciaDescricao: string
  dia: number
  dataInicio: string
  dataFim?: string
  ativo: boolean
  dataProximaGeracao?: string
}

export interface CriarRecorrente {
  descricao: string
  valor: number
  tipo: number
  categoriaId?: string
  contaId: string
  frequencia: number
  dia: number
  dataInicio: string
  dataFim?: string
}
