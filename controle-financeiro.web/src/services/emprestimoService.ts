import { api } from "../api/axiosConfig"
import type {
  Emprestimo, CriarEmprestimo, EmprestimoConviteResultado, EmprestimoConvitePendente,
} from "../types/Emprestimo"
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

/** Propõe vínculo por e-mail. Resposta sempre igual, exista ou não a conta (anti-enumeração) —
 * o link volta pra copiar/compartilhar por fora (sem envio de e-mail automático). */
export const vincularEmprestimo = async (
  id: string, email: string,
): Promise<EmprestimoConviteResultado> => {
  const res = await api.post(`/emprestimos/${id}/vincular`, { email })
  return res.data
}

export const listConvitesPendentesEmprestimo = async (): Promise<EmprestimoConvitePendente[]> => {
  const res = await api.get("/emprestimos/convites-pendentes")
  return res.data
}

/** Pré-visualização do convite pelo token — landing pública, já autenticado. */
export const obterConvitePorToken = async (token: string): Promise<EmprestimoConvitePendente> => {
  const res = await api.get(`/emprestimos/convites/${token}`)
  return res.data
}

export const aceitarVinculoEmprestimo = async (token: string): Promise<void> => {
  await api.post(`/emprestimos/convites/${token}/aceitar`)
}

export const recusarVinculoEmprestimo = async (token: string): Promise<void> => {
  await api.post(`/emprestimos/convites/${token}/recusar`)
}

/** Aceite pela lista "convites pendentes" in-app — sem token (o token só existe no link
 * do convite, nunca fica recuperável depois). Autenticação + e-mail batendo bastam. */
export const aceitarVinculoEmprestimoPorId = async (id: string): Promise<void> => {
  await api.post(`/emprestimos/${id}/aceitar-vinculo`)
}

export const recusarVinculoEmprestimoPorId = async (id: string): Promise<void> => {
  await api.post(`/emprestimos/${id}/recusar-vinculo`)
}
