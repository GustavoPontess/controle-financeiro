import { api } from "../api/axiosConfig"
import type {
  Familia, FamiliaDetalhe, ConviteFamilia, MembroFamilia,
  DespesaCompartilhada, BalancoFamilia,
  Dependente, GastoDependente, TipoDependente,
  ModoRateio, RateioItem, RateioTransacao,
  AcertoContas,
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
  familiaId: string, email: string, papel: string,
): Promise<ConviteFamilia> => {
  const res = await api.post(`/familias/${familiaId}/convites`, { email, papel })
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

export const getDespesasFamilia = async (
  familiaId: string, mes: number, ano: number, responsavelId?: string,
): Promise<DespesaCompartilhada[]> => {
  const res = await api.get(`/familias/${familiaId}/despesas`, {
    params: { mes, ano, responsavelId },
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

export const definirRendaMembro = async (
  familiaId: string, membroId: string, rendaMensal: number | null,
): Promise<void> => {
  await api.put(`/familias/${familiaId}/membros/${membroId}/renda`, { rendaMensal })
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
}

export const registrarAcerto = async (
  familiaId: string, input: RegistrarAcertoInput,
): Promise<AcertoContas> => {
  const res = await api.post(`/familias/${familiaId}/acertos`, input, {
    headers: { "Idempotency-Key": input.idempotencyKey },
  })
  return res.data
}

export const getAcertos = async (
  familiaId: string, mes?: number, ano?: number,
): Promise<AcertoContas[]> => {
  const res = await api.get(`/familias/${familiaId}/acertos`, { params: { mes, ano } })
  return res.data
}

export const cancelarAcerto = async (
  familiaId: string, acertoId: string,
): Promise<void> => {
  await api.delete(`/familias/${familiaId}/acertos/${acertoId}`)
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
