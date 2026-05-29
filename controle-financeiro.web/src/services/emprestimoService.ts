import { api } from "../api/axiosConfig"
import type { Emprestimo, CriarEmprestimo } from "../types/Emprestimo"
import type { PagedResult } from "../types/Paged"

/** Lista paginada — backend clampa pageSize em 1..100. */
export const listEmprestimosPage = async (
  page: number,
  pageSize: number,
): Promise<PagedResult<Emprestimo>> => {
  const res = await api.get("/emprestimos", { params: { page, pageSize } })
  return res.data
}

export type EmprestimoStats = {
  totalAReceber: number
  totalAPagar: number
  ativos: number
  qtdTotal: number
}

/** KPIs agregados — a receber, a pagar, ativos, total. */
export const getEmprestimoStats = async (): Promise<EmprestimoStats> => {
  const res = await api.get("/emprestimos/stats")
  return res.data
}

/** @deprecated Use listEmprestimosPage. Clampa em 100. */
export const getEmprestimos = async (): Promise<Emprestimo[]> => {
  const res = await api.get("/emprestimos", { params: { page: 1, pageSize: 100 } })
  return res.data.items
}

export const createEmprestimo = async (dto: CriarEmprestimo): Promise<Emprestimo> => {
  const res = await api.post("/emprestimos", dto)
  return res.data
}

export const registrarPagamento = async (id: string, valor: number): Promise<void> => {
  await api.patch(`/emprestimos/${id}/pagamento`, { valor })
}

export const quitarEmprestimo = async (id: string): Promise<void> => {
  await api.patch(`/emprestimos/${id}/quitar`)
}

export const deleteEmprestimo = async (id: string): Promise<void> => {
  await api.delete(`/emprestimos/${id}`)
}
