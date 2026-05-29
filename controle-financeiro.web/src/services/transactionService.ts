import { api } from "../api/axiosConfig"
import type { Transaction } from "../types/Transaction"
import type { PagedResult } from "../types/Paged"

export type ListTransactionsFilter = {
  /** ISO date — `Data >= from`. */
  from?: string
  /** ISO date — `Data < to` (semi-aberto). */
  to?: string
  categoriaId?: string
}

export type TransacaoStats = {
  entradas: number
  saidas: number
  saldoPeriodo: number
  qtdTransacoes: number
}

/**
 * KPIs agregados — entradas, saídas, saldo do período, qtd.
 * Calculado server-side, exato pra qualquer volume.
 */
export const getTransactionStats = async (
  filter: ListTransactionsFilter = {},
): Promise<TransacaoStats> => {
  const params: Record<string, unknown> = {}
  if (filter.from) params.from = filter.from
  if (filter.to) params.to = filter.to
  if (filter.categoriaId) params.categoriaId = filter.categoriaId
  const res = await api.get("/transacoes/stats", { params })
  return res.data
}

/**
 * Lista paginada com filtros opcionais aplicados no banco. Use sempre que
 * possível — backend faz Clamp(pageSize, 1, 100), então não adianta pedir
 * mais que 100 por chamada.
 */
export const listTransactionsPage = async (
  page: number,
  pageSize: number,
  filter: ListTransactionsFilter = {},
): Promise<PagedResult<Transaction>> => {
  const params: Record<string, unknown> = { page, pageSize }
  if (filter.from) params.from = filter.from
  if (filter.to) params.to = filter.to
  if (filter.categoriaId) params.categoriaId = filter.categoriaId
  const res = await api.get("/transacoes", { params })
  return res.data
}

/**
 * @deprecated Backend clampa em 100 — esta função silenciosamente trunca quem
 * tiver mais de 100 transações. Use `listTransactionsPage` em telas novas.
 * Mantida só pra callers que agregam tudo (Dashboard, etc).
 */
export const getTransactions = async (): Promise<Transaction[]> => {
  const res = await api.get("/transacoes", { params: { page: 1, pageSize: 100 } })
  return res.data.items
}

export const createTransaction = async (transaction: Omit<Transaction, "id">) => {
  const res = await api.post("/transacoes", transaction)
  return res.data
}

export const updateTransaction = async (id: string, transaction: Omit<Transaction, "id">): Promise<void> => {
  await api.put(`/transacoes/${id}`, transaction)
}

export const deleteTransaction = async (id: string): Promise<void> => {
  await api.delete(`/transacoes/${id}`)
}
