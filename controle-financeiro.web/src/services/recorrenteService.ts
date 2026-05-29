import { api } from "../api/axiosConfig"
import type { Recorrente, CriarRecorrente, EditarProximaDto, CancelarRecorrenteDto } from "../types/Recorrente"
import type { PagedResult } from "../types/Paged"

const BASE = "recorrentes"

/** Lista paginada — backend clampa pageSize em 1..100. */
export const listRecorrentesPage = async (
  page: number,
  pageSize: number,
): Promise<PagedResult<Recorrente>> => {
  const res = await api.get(BASE, { params: { page, pageSize } })
  return res.data
}

/** @deprecated Use listRecorrentesPage em telas com paginação. Clampa em 100. */
export const getRecorrentes = async (): Promise<Recorrente[]> => {
  const res = await api.get(BASE, { params: { page: 1, pageSize: 100 } })
  return res.data.items
}

export const createRecorrente = async (dto: CriarRecorrente): Promise<Recorrente> => {
  const res = await api.post(BASE, dto)
  return res.data
}

export const updateRecorrente = async (id: string, dto: CriarRecorrente): Promise<void> => {
  await api.put(`${BASE}/${id}`, dto)
}

export const toggleRecorrente = async (id: string): Promise<void> => {
  await api.patch(`${BASE}/${id}/toggle`)
}

export const cancelarRecorrente = async (id: string, dto: CancelarRecorrenteDto): Promise<void> => {
  await api.post(`${BASE}/${id}/cancelar`, dto)
}

export const editarProximaOcorrencia = async (id: string, dto: EditarProximaDto): Promise<void> => {
  await api.patch(`${BASE}/${id}/proxima`, dto)
}

export const deleteRecorrente = async (id: string): Promise<void> => {
  await api.delete(`${BASE}/${id}`)
}
