import { api } from "../api/axiosConfig"
import type { Transferencia, CriarTransferencia } from "../types/Transferencia"
import type { PagedResult } from "../types/Paged"

/** Lista paginada — backend clampa pageSize em 1..100. */
export const listTransferenciasPage = async (
  page: number,
  pageSize: number,
): Promise<PagedResult<Transferencia>> => {
  const res = await api.get("/transferencias", { params: { page, pageSize } })
  return res.data
}

/** @deprecated Use listTransferenciasPage. Clampa em 100. */
export const getTransferencias = async (): Promise<Transferencia[]> => {
  const res = await api.get("/transferencias", { params: { page: 1, pageSize: 100 } })
  return res.data.items
}

export const createTransferencia = async (dto: CriarTransferencia): Promise<Transferencia> => {
  const res = await api.post("/transferencias", dto)
  return res.data
}

export const deleteTransferencia = async (id: string): Promise<void> => {
  await api.delete(`/transferencias/${id}`)
}
