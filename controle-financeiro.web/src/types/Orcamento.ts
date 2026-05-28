export interface Orcamento {
  id: string
  categoriaId: string | null
  categoriaNome: string | null
  mes: number
  ano: number
  valorLimite: number
  percentualAlerta: number
  valorGasto: number
  valorRestante: number
  percentualConsumido: number
  emAlerta: boolean
  ultrapassado: boolean
}

export interface CriarOrcamentoDto {
  categoriaId: string | null
  mes: number
  ano: number
  valorLimite: number
  percentualAlerta: number
}
