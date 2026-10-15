import { api } from "../api/cliente"
import type {
  Emprestimo, CriarEmprestimo, EmprestimoConviteResultado, EmprestimoConvitePendente,
  SolicitarPagamentoEmprestimo, AprovarPagamentoEmprestimo, EmprestimoPagamentoSolicitacao,
  EmprestimoParcela, EmprestimoConsolidacaoCandidato, ProporConsolidacao, EmprestimoConsolidacaoProposta,
} from "../types/Emprestimo"
import type { PagedResult } from "../types/Paged"

/** Lista paginada — backend clampa pageSize em 1..100. `incluirArquivados` (default false) mostra
 * também os que o próprio usuário arquivou — arquivar é por-usuário, não afeta a lista da
 * contraparte. */
export type ListEmprestimosFiltros = {
  situacao?: "ativo" | "quitado"
  forma?: "avista" | "parcelado"
  valorMin?: number
  valorMax?: number
  vencDe?: string
  vencAte?: string
}

export const listEmprestimosPage = async (
  page: number,
  pageSize: number,
  incluirArquivados = false,
  busca?: string,
  direcao?: "receber" | "pagar",
  filtros?: ListEmprestimosFiltros,
): Promise<PagedResult<Emprestimo>> => {
  const res = await api.get("/emprestimos", {
    params: {
      page, pageSize, incluirArquivados,
      busca: busca?.trim() || undefined,
      direcao: direcao || undefined,
      situacao: filtros?.situacao || undefined,
      forma: filtros?.forma || undefined,
      valorMin: filtros?.valorMin,
      valorMax: filtros?.valorMax,
      vencDe: filtros?.vencDe,
      vencAte: filtros?.vencAte,
    },
  })
  return res.data
}

export type EmprestimoStats = {
  totalAReceber: number
  totalAPagar: number
  ativos: number
  qtdTotal: number
  totalAReceberVencido: number
  totalAPagarVencido: number
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

/** Detalhe de um empréstimo por id (aplica multa de atraso no servidor). Usado pela tela de detalhe. */
export const getEmprestimo = async (id: string): Promise<Emprestimo> => {
  const res = await api.get(`/emprestimos/${id}`)
  return res.data
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

// ── Unificar/consolidar (docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md) ──

/** Contrapartes com 2+ empréstimos ativos onde eu sou credor — candidatas a consolidação. */
export const listCandidatosConsolidacao = async (): Promise<EmprestimoConsolidacaoCandidato[]> => {
  const res = await api.get("/emprestimos/candidatos-consolidacao")
  return res.data
}

/** Propõe juntar 2+ empréstimos ativos da mesma contraparte vinculada num plano novo. Nada muda
 * nos originais até o devedor aceitar. */
export const proporConsolidacao = async (dto: ProporConsolidacao): Promise<EmprestimoConsolidacaoProposta> => {
  const res = await api.post("/emprestimos/consolidar", dto)
  return res.data
}

/** Consolidações onde sou credor (propus) ou devedor (preciso responder) — mais recente primeiro. */
export const listConsolidacoes = async (): Promise<EmprestimoConsolidacaoProposta[]> => {
  const res = await api.get("/emprestimos/consolidacoes")
  return res.data
}

/** Devedor aceita — cria o empréstimo consolidado e fecha os originais. Retorna o empréstimo novo. */
export const aceitarConsolidacao = async (id: string): Promise<Emprestimo> => {
  const res = await api.post(`/emprestimos/consolidacoes/${id}/aceitar`)
  return res.data
}

export const recusarConsolidacao = async (id: string, motivo?: string): Promise<void> => {
  await api.post(`/emprestimos/consolidacoes/${id}/recusar`, { motivo: motivo || undefined })
}

/** Credor desiste antes do devedor responder. */
export const cancelarConsolidacao = async (id: string): Promise<void> => {
  await api.post(`/emprestimos/consolidacoes/${id}/cancelar`)
}
