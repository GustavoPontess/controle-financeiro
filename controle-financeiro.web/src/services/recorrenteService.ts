import { api } from "../api/axiosConfig"
import type { Recorrente, CriarRecorrente } from "../types/Recorrente"

export const getRecorrentes = async (): Promise<Recorrente[]> => {
  const res = await api.get("/recorrentes", { params: { pageSize: 1000 } })
  return res.data.items
}

export const createRecorrente = async (dto: CriarRecorrente): Promise<Recorrente> => {
  const res = await api.post("/recorrentes", dto)
  return res.data
}

export const updateRecorrente = async (id: string, dto: CriarRecorrente): Promise<void> => {
  await api.put(`/recorrentes/${id}`, dto)
}

export const toggleRecorrente = async (id: string): Promise<void> => {
  await api.patch(`/recorrentes/${id}/toggle`)
}

export const deleteRecorrente = async (id: string): Promise<void> => {
  await api.delete(`/recorrentes/${id}`)
}
