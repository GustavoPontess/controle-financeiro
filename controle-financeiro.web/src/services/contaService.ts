import { api } from "../api/axiosConfig"
import type { Conta } from "../types/Conta"

type ContaBase = Omit<Conta, "id" | "tipoDescricao" | "tipoCartaoDescricao" | "bancoNome" | "saldoAtual">

export type CriarContaPayload = ContaBase & { saldoInicial?: number }

export const getContas = async (): Promise<Conta[]> => {
  const res = await api.get("/contas")
  return res.data
}

export const createConta = async (conta: CriarContaPayload) => {
  const res = await api.post("/contas", conta)
  return res.data
}

export const updateConta = async (id: string, conta: ContaBase) => {
  await api.put(`/contas/${id}`, conta)
}

export const deleteConta = async (id: string) => {
  await api.delete(`/contas/${id}`)
}
