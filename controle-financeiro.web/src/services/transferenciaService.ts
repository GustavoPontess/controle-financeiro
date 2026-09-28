import { api } from "../api/axiosConfig"
import type { Transferencia, CriarTransferencia } from "../types/Transferencia"
import type { PagedResult } from "../types/Paged"

/**
 * Lista paginada — backend clampa pageSize em 1..100. `busca` (descrição ou conta) é filtrada NO
 * SERVIDOR, então o total já vem filtrado; vazia = sem filtro.
 */
export const listTransferenciasPage = async (
  page: number,
  pageSize: number,
  busca?: string,
): Promise<PagedResult<Transferencia>> => {
  const params: Record<string, unknown> = { page, pageSize }
  const termo = busca?.trim()
  if (termo) params.busca = termo
  const res = await api.get("/transferencias", { params })
  return res.data
}

export type TransferenciaStats = { totalMovimentado: number; qtdTotal: number }

/** KPIs agregados — total movimentado, qtd. */
export const getTransferenciaStats = async (
  filter: { from?: string; to?: string } = {},
): Promise<TransferenciaStats> => {
  const params: Record<string, unknown> = {}
  if (filter.from) params.from = filter.from
  if (filter.to) params.to = filter.to
  const res = await api.get("/transferencias/stats", { params })
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
