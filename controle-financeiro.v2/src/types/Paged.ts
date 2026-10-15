/**
 * Envelope padrão de listagens paginadas do backend (`DTOs/Common/PagedResult<T>`).
 * Todo endpoint de lista grande devolve isso: 5 endpoints no momento
 * (transacoes, recorrentes, transferencias, emprestimos, parcelamentos).
 */
export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
