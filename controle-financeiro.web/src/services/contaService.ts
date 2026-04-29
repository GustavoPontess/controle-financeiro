import { api } from "../api/axiosConfig"
import type { Conta } from "../types/Conta"

export const getContas = async (): Promise<Conta[]> => {
  const res = await api.get("/contas")
  return res.data
}

export const createConta = async (conta: Omit<Conta, "id" | "tipoDescricao">) => {
  const res = await api.post("/contas", conta)
  return res.data
}

export const updateConta = async (id: string, conta: Omit<Conta, "id" | "tipoDescricao">) => {
  await api.put(`/contas/${id}`, conta)
}

export const deleteConta = async (id: string) => {
  await api.delete(`/contas/${id}`)
}
