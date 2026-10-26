import { api } from "../api/cliente"
import type { Banco } from "../types/Banco"

export const getBancos = async (): Promise<Banco[]> => {
  const res = await api.get("/bancos")
  return res.data
}

export const createBanco = async (banco: Omit<Banco, "id" | "tipoDescricao">) => {
  const res = await api.post("/bancos", banco)
  return res.data
}

export const updateBanco = async (id: string, banco: Omit<Banco, "id" | "tipoDescricao">) => {
  await api.put(`/bancos/${id}`, banco)
}

export const deleteBanco = async (id: string) => {
  await api.delete(`/bancos/${id}`)
}
