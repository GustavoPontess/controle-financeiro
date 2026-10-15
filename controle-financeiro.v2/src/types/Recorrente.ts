export interface Recorrente {
  id: string
  descricao: string
  valor: number
  tipo: number
  tipoDescricao: string
  categoriaId?: string
  categoriaNome?: string
  subcategoriaId?: string | null
  subcategoriaNome?: string | null
  contaId?: string
  contaNome?: string
  cartaoCreditoId?: string
  cartaoCreditoNome?: string
  /** Como paga/recebe (enum MeioPagamento). No cartão é sempre Crédito; contas fixas antigas podem vir sem. */
  meioPagamento?: number | null
  meioPagamentoDescricao?: string | null
  frequencia: number
  frequenciaDescricao: string
  dia: number
  dataInicio: string
  dataFim?: string
  ativo: boolean
  /** Cursor interno da geração (até onde já há previsões) — NÃO é a próxima cobrança. */
  dataProximaGeracao?: string
  /** Próxima cobrança de verdade ("YYYY-MM-DD"): a previsão pendente mais próxima. Null se pausada/cancelada. */
  proximaCobranca?: string | null
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
  /** Opcional; tem que ser da categoria (o servidor recusa outra). */
  subcategoriaId?: string
  contaId?: string
  cartaoCreditoId?: string
  /** Numa conta: qualquer meio menos Crédito. No cartão o servidor grava Crédito sozinho. */
  meioPagamento?: number
  frequencia: number
  dia: number
  dataInicio: string
  dataFim?: string
}
