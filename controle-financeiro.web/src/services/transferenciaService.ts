import { api } from "../api/axiosConfig"
import type { Transferencia, CriarTransferencia } from "../types/Transferencia"

export const getTransferencias = async (): Promise<Transferencia[]> => {
  const res = await api.get("/transferencias", { params: { pageSize: 1000 } })
  return res.data.items
}

export const createTransferencia = async (dto: CriarTransferencia): Promise<Transferencia> => {
  const res = await api.post("/transferencias", dto)
  return res.data
}

export const deleteTransferencia = async (id: string): Promise<void> => {
  await api.delete(`/transferencias/${id}`)
}
