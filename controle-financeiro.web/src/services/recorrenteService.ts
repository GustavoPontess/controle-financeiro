import { api } from "../api/axiosConfig"
import type { Recorrente, CriarRecorrente, EditarProximaDto, CancelarRecorrenteDto, FiltroStatusRecorrente } from "../types/Recorrente"
import type { PagedResult } from "../types/Paged"

const BASE = "recorrentes"

/**
 * Lista paginada — backend clampa pageSize em 1..100. `status` e `busca` são filtrados NO SERVIDOR
 * (o total já vem filtrado); omitidos = todas, sem busca.
 */
export const listRecorrentesPage = async (
  page: number,
  pageSize: number,
  filtro: { status?: FiltroStatusRecorrente; busca?: string } = {},
): Promise<PagedResult<Recorrente>> => {
  const params: Record<string, unknown> = { page, pageSize }
  if (filtro.status) params.status = filtro.status
  const busca = filtro.busca?.trim()
  if (busca) params.busca = busca
  const res = await api.get(BASE, { params })
  return res.data
}

export type RecorrenteStats = {
  ativas: number
  custoMensalDespesas: number
  proximas30Dias: number
  qtdTotal: number
}

/** KPIs agregados — ativas, custo mensal, próximas 30 dias, total. */
export const getRecorrenteStats = async (): Promise<RecorrenteStats> => {
  const res = await api.get(`${BASE}/stats`)
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
