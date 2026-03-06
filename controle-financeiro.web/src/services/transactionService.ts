import { api } from "../api/axiosConfig"
import type { Transaction } from "../types/Transaction"

export const getTransactions = async (): Promise<Transaction[]> => {
  const res = await api.get("/transacoes")
  return res.data
}

export const createTransaction = async (transaction: Omit<Transaction, "id">) => {
  const res = await api.post("/transacoes", transaction)
  return res.data
}