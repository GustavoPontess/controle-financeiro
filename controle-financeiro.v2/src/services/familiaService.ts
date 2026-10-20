import { api } from "../api/cliente"
import type {
  Familia, FamiliaDetalhe, ConviteFamilia, MembroFamilia, PapelFamilia,
  DespesaCompartilhada, BalancoFamilia,
  Dependente, GastoDependente, TipoDependente,
  ModoRateio, RateioItem, RateioTransacao,
  AcertoContas, ContaFixaDaCasa,
} from "../types/Familia"

export interface DependenteInput {
  nome: string
  apelido?: string | null
  dataNascimento?: string | null
  tipo: TipoDependente
}

export const getFamilias = async (): Promise<Familia[]> => {
  const res = await api.get("/familias")
  return res.data
}

export const getFamilia = async (id: string): Promise<FamiliaDetalhe> => {
  const res = await api.get(`/familias/${id}`)
  return res.data
}

export const criarFamilia = async (nome: string): Promise<Familia> => {
  const res = await api.post("/familias", { nome })
  return res.data
}

export const dissolverFamilia = async (id: string): Promise<void> => {
  await api.delete(`/familias/${id}`)
}

export const editarPapel = async (
  familiaId: string, membroId: string, papel: string,
): Promise<MembroFamilia> => {
  const res = await api.put(`/familias/${familiaId}/membros/${membroId}/papel`, { papel })
  return res.data
}

export const removerMembro = async (familiaId: string, membroId: string): Promise<void> => {
  await api.delete(`/familias/${familiaId}/membros/${membroId}`)
}

export const convidarMembro = async (
  familiaId: string, email: string, papel: string, papelPermissao: PapelFamilia = 2,
): Promise<ConviteFamilia> => {
  const res = await api.post(`/familias/${familiaId}/convites`, { email, papel, papelPermissao })
  return res.data
}

/** Admin promove/rebaixa a permissão de um membro (o criador não muda). */
export const editarPermissao = async (
  familiaId: string, membroId: string, papelPermissao: PapelFamilia,
): Promise<MembroFamilia> => {
  const res = await api.put(`/familias/${familiaId}/membros/${membroId}/permissao`, { papelPermissao })
  return res.data
}

export const revogarConvite = async (familiaId: string, conviteId: string): Promise<void> => {
  await api.delete(`/familias/${familiaId}/convites/${conviteId}`)
}

export const getConvitesPendentes = async (): Promise<ConviteFamilia[]> => {
  const res = await api.get("/convites/pendentes")
  return res.data
}

export const aceitarConvite = async (token: string): Promise<void> => {
  await api.post(`/convites/${token}/aceitar`)
}

export const recusarConvite = async (token: string): Promise<void> => {
  await api.post(`/convites/${token}/recusar`)
}

// ── Despesa compartilhada (#23) ──

export const compartilharTransacao = async (
  transacaoId: string, familiaId: string,
): Promise<void> => {
  await api.put(`/transacoes/${transacaoId}/compartilhamento`, { familiaId })
}

export const descompartilharTransacao = async (transacaoId: string): Promise<void> => {
  await api.delete(`/transacoes/${transacaoId}/compartilhamento`)
}

/** Despesas divididas do mês. Filtros no servidor: quem pagou, categoria, situação (esperando | dividida | recusada). */
export const getDespesasFamilia = async (
  familiaId: string, mes: number, ano: number,
  filtros: { responsavelId?: string; pagadorId?: string; categoriaId?: string; situacao?: "esperando" | "dividida" | "recusada" } = {},
): Promise<DespesaCompartilhada[]> => {
  const res = await api.get(`/familias/${familiaId}/despesas`, {
    params: { mes, ano, ...filtros },
  })
  return res.data
}

/** Feature 2.1 — atribui/limpa o membro responsável por uma despesa compartilhada. */
export const atribuirResponsavel = async (
  familiaId: string, transacaoId: string, responsavelUsuarioId: string | null,
): Promise<void> => {
  await api.put(`/familias/${familiaId}/despesas/${transacaoId}/responsavel`, { responsavelUsuarioId })
}

export const getBalancoFamilia = async (
  familiaId: string, mes: number, ano: number,
): Promise<BalancoFamilia> => {
  const res = await api.get(`/familias/${familiaId}/balanco`, { params: { mes, ano } })
  return res.data
}

// ── Dependentes (#24) ──

export const getDependentes = async (familiaId: string): Promise<Dependente[]> => {
  const res = await api.get(`/familias/${familiaId}/dependentes`)
  return res.data
}

export const criarDependente = async (
  familiaId: string, input: DependenteInput,
): Promise<Dependente> => {
  const res = await api.post(`/familias/${familiaId}/dependentes`, input)
  return res.data
}

export const atualizarDependente = async (
  familiaId: string, depId: string, input: DependenteInput,
): Promise<Dependente> => {
  const res = await api.put(`/familias/${familiaId}/dependentes/${depId}`, input)
  return res.data
}

export const inativarDependente = async (
  familiaId: string, depId: string,
): Promise<void> => {
  await api.delete(`/familias/${familiaId}/dependentes/${depId}`)
}

export const getGastoDependente = async (
  familiaId: string, depId: string, mes: number, ano: number,
): Promise<GastoDependente> => {
  const res = await api.get(
    `/familias/${familiaId}/dependentes/${depId}/gastos`, { params: { mes, ano } })
  return res.data
}

export const atribuirDependente = async (
  transacaoId: string, dependenteId: string | null,
): Promise<void> => {
  await api.put(`/transacoes/${transacaoId}/dependente`, { dependenteId })
}

// ── Modos de rateio (#25) ──

export const definirModoRateio = async (
  familiaId: string, modo: ModoRateio,
): Promise<void> => {
  await api.put(`/familias/${familiaId}/modo-rateio`, { modo })
}

export const getRateioTransacao = async (
  transacaoId: string,
): Promise<RateioTransacao> => {
  const res = await api.get(`/transacoes/${transacaoId}/rateio`)
  return res.data
}

export const definirRateioTransacao = async (
  transacaoId: string, modo: ModoRateio, itens: RateioItem[] | null,
): Promise<void> => {
  await api.put(`/transacoes/${transacaoId}/rateio`, { modo, itens })
}

export const removerRateioTransacao = async (transacaoId: string): Promise<void> => {
  await api.delete(`/transacoes/${transacaoId}/rateio`)
}

// ── Acerto de contas (#26) ──

export interface RegistrarAcertoInput {
  deUsuarioId: string
  paraUsuarioId: string
  valor: number
  mes?: number | null
  ano?: number | null
  observacao?: string | null
  // Idempotência: UUID estável por tentativa de quitação. Reusar no retry pra
  // não duplicar o acerto no servidor (o backend exige e deduplica por ele).
  idempotencyKey: string
  /** De qual conta saiu (passei) ou em qual entrou (recebi); null = não lança em conta. */
  contaId?: string | null
  /** Dia em que o dinheiro passou ("YYYY-MM-DD"). */
  data?: string | null
}

export const registrarAcerto = async (
  familiaId: string, input: RegistrarAcertoInput,
): Promise<AcertoContas> => {
  const res = await api.post(`/familias/${familiaId}/acertos`, input, {
    headers: { "Idempotency-Key": input.idempotencyKey },
  })
  return res.data
}

/** `deUsuarioId`: o filtro "quem pagou" (no acerto, quem passou o dinheiro). */
export const getAcertos = async (
  familiaId: string, mes?: number, ano?: number, deUsuarioId?: string,
): Promise<AcertoContas[]> => {
  const res = await api.get(`/familias/${familiaId}/acertos`, { params: { mes, ano, deUsuarioId } })
  return res.data
}

export const cancelarAcerto = async (
  familiaId: string, acertoId: string,
): Promise<void> => {
  await api.delete(`/familias/${familiaId}/acertos/${acertoId}`)
}

/** Contas fixas da casa no mês: quem paga, o dia, a cobrança do mês e a sua parte. */
export const getContasFixasFamilia = async (familiaId: string, mes: number, ano: number): Promise<ContaFixaDaCasa[]> => {
  const res = await api.get(`/familias/${familiaId}/contas-fixas`, { params: { mes, ano } })
  return res.data
}

/** Quem recebeu confirma (só aí entra no equilíbrio); com conta, nasce a entrada. */
export const confirmarAcerto = async (
  familiaId: string, acertoId: string, contaId: string | null, data?: string | null,
): Promise<AcertoContas> => {
  const res = await api.post(`/familias/${familiaId}/acertos/${acertoId}/confirmar`, { contaId, data: data ?? null })
  return res.data
}

/** Lança o SEU lado depois (a saída de quem passou ou a entrada de quem recebeu). */
export const lancarAcerto = async (
  familiaId: string, acertoId: string, contaId: string, data?: string | null,
): Promise<AcertoContas> => {
  const res = await api.post(`/familias/${familiaId}/acertos/${acertoId}/lancar`, { contaId, data: data ?? null })
  return res.data
}

// ── Aprovação de despesa (2.4) ──

/** Define/limpa o limite de aprovação da família (só admin). null = desliga. */
export const definirLimiteAprovacao = async (
  familiaId: string, limiteAprovacao: number | null,
): Promise<void> => {
  await api.put(`/familias/${familiaId}/limite-aprovacao`, { limiteAprovacao })
}

export const aprovarDespesa = async (
  familiaId: string, transacaoId: string,
): Promise<void> => {
  await api.post(`/familias/${familiaId}/despesas/${transacaoId}/aprovar`)
}

export const rejeitarDespesa = async (
  familiaId: string, transacaoId: string,
): Promise<void> => {
  await api.post(`/familias/${familiaId}/despesas/${transacaoId}/rejeitar`)
}
