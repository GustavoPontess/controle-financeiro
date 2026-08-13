import { api } from "../api/axiosConfig"
import type {
  Emprestimo, CriarEmprestimo, EmprestimoConviteResultado, EmprestimoConvitePendente,
  SolicitarPagamentoEmprestimo, AprovarPagamentoEmprestimo, EmprestimoPagamentoSolicitacao,
  EmprestimoParcela,
} from "../types/Emprestimo"
import type { PagedResult } from "../types/Paged"

/** Lista paginada — backend clampa pageSize em 1..100. `incluirArquivados` (default false) mostra
 * também os que o próprio usuário arquivou — arquivar é por-usuário, não afeta a lista da
 * contraparte. */
export const listEmprestimosPage = async (
  page: number,
  pageSize: number,
  incluirArquivados = false,
): Promise<PagedResult<Emprestimo>> => {
  const res = await api.get("/emprestimos", { params: { page, pageSize, incluirArquivados } })
  return res.data
}

export type EmprestimoStats = {
  totalAReceber: number
  totalAPagar: number
  ativos: number
  qtdTotal: number
  totalAReceberVencido: number
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

export const quitarEmprestimo = async (id: string): Promise<void> => {
  await api.patch(`/emprestimos/${id}/quitar`)
}

export const deleteEmprestimo = async (id: string): Promise<void> => {
  await api.delete(`/emprestimos/${id}`)
}

/** Esconde da lista principal do lado de quem chama — só pra empréstimo Quitado, não apaga nada
 * nem afeta a visão da contraparte. */
export const arquivarEmprestimo = async (id: string): Promise<void> => {
  await api.patch(`/emprestimos/${id}/arquivar`)
}

export const desarquivarEmprestimo = async (id: string): Promise<void> => {
  await api.patch(`/emprestimos/${id}/desarquivar`)
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

/** Registra pagamento — devedor ou credor, mesmo endpoint (cria a Transacao real junto).
 * Devedor: nasce Pendente, aguarda aprovação. Credor: nasce já Aprovada. Sem escolha de parcela
 * (2026-08-12) — pra empréstimo Parcelado, o valor é aplicado em sequência nas parcelas pendentes
 * mais antigas, quantas cobrir por completo — pode voltar mais de uma solicitação. */
export const solicitarPagamentoEmprestimo = async (
  id: string, dto: SolicitarPagamentoEmprestimo,
): Promise<EmprestimoPagamentoSolicitacao[]> => {
  const res = await api.post(`/emprestimos/${id}/solicitar-pagamento`, dto)
  return res.data
}

/** Histórico de solicitações de pagamento de um empréstimo — visível pros dois participantes. */
export const listSolicitacoesPagamento = async (id: string): Promise<EmprestimoPagamentoSolicitacao[]> => {
  const res = await api.get(`/emprestimos/${id}/solicitacoes`)
  return res.data
}

/** Solicitações de pagamento pendentes onde eu sou o credor. */
export const listSolicitacoesPagamentoPendentes = async (): Promise<EmprestimoPagamentoSolicitacao[]> => {
  const res = await api.get("/emprestimos/solicitacoes-pendentes")
  return res.data
}

/** Credor aprova. contaId/categoriaId opcionais — se já registrou a entrada por fora, aprova sem informar. */
export const aprovarPagamentoEmprestimo = async (
  solicitacaoId: string, dto: AprovarPagamentoEmprestimo,
): Promise<void> => {
  await api.post(`/emprestimos/solicitacoes/${solicitacaoId}/aprovar`, dto)
}

export const rejeitarPagamentoEmprestimo = async (solicitacaoId: string, motivo?: string): Promise<void> => {
  await api.post(`/emprestimos/solicitacoes/${solicitacaoId}/rejeitar`, { motivo: motivo || undefined })
}

/** Devedor reenvia uma solicitação rejeitada — volta pra pendente. */
export const reenviarPagamentoEmprestimo = async (solicitacaoId: string): Promise<void> => {
  await api.post(`/emprestimos/solicitacoes/${solicitacaoId}/reenviar`)
}

/** Parcelas de um empréstimo Parcelado (vazio se À vista). */
export const listParcelasEmprestimo = async (id: string): Promise<EmprestimoParcela[]> => {
  const res = await api.get(`/emprestimos/${id}/parcelas`)
  return res.data
}
