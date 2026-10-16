export interface Category {
  id: string
  descricao: string
  finalidade: number // 1 = Despesa, 2 = Receita, 3 = Ambas
  isPadrao: boolean
}
/** O que usa a categoria (GET /categorias/{id}/uso). Lançamentos e contas fixas: só os vivos. */
export interface UsoCategoria {
  lancamentos: number
  contasFixas: number
  parcelamentos: number
  limites: number
  metas: number
  subcategorias: number
  /** Lançamentos excluídos que ainda apontam pra ela (seguem no histórico). */
  lancamentosExcluidos?: number
  /** O servidor só exclui com destino (alguma coisa aponta pra ela, inclusive excluída). */
  precisaDestino?: boolean
}

/** O que usa a subcategoria (GET /subcategorias/{id}/uso). */
export interface UsoSubcategoria {
  lancamentos: number
  contasFixas: number
}
