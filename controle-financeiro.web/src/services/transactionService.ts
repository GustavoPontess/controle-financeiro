import { api } from "../api/axiosConfig"
import type { Transaction } from "../types/Transaction"

export const getTransactions = async (): Promise<Transaction[]> => {
  const res = await api.get("/transacoes", { params: { pageSize: 1000 } })
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
