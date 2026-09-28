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
  /**
   * Calculada no servidor (regra única): pausada ≠ cancelada. Pausada segue entre as ativas e pode
   * ser retomada; cancelada (definitiva) e encerrada (data fim passou) vão pra "Encerradas".
   */
  situacao: SituacaoRecorrente
}

export type SituacaoRecorrente = "ativa" | "pausada" | "cancelada" | "encerrada"

/** Filtro da listagem (?status=): "ativas" = ativa + pausada; "encerradas" = cancelada + encerrada. */
export type FiltroStatusRecorrente = "ativas" | "encerradas"

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
