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
  /** Média por mês das despesas de todas as frequências (= anual ÷ 12), calculada no servidor. */
  custoMensalDespesas: number
  /** Por ano: semanal × 52 + mensal × 12 + anual (servidor). */
  custoAnualDespesas: number
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

// A API exige o header Idempotency-Key (400 sem ele). Quem chama gera a chave ao ABRIR o formulário
// e reusa no retry: a mesma chave devolve a conta fixa já criada em vez de criar outra (e as cobranças
// em dobro); com outros dados → 409.
export const createRecorrente = async (dto: CriarRecorrente, idempotencyKey: string): Promise<Recorrente> => {
  const res = await api.post(BASE, dto, { headers: { "Idempotency-Key": idempotencyKey } })
  return res.data
}

export const updateRecorrente = async (id: string, dto: CriarRecorrente): Promise<void> => {
  await api.put(`${BASE}/${id}`, dto)
}

// Manda o estado PEDIDO (pausar = false, retomar = true): repetir o pedido não desfaz no servidor.
export const toggleRecorrente = async (id: string, ativo: boolean): Promise<void> => {
  await api.patch(`${BASE}/${id}/toggle`, null, { params: { ativo } })
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
