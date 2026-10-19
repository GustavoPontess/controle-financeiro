import { api } from "../api/cliente"
import type { CriarMetaDto, Meta, MovimentoMeta, ViabilidadeMeta } from "../types/Meta"

// Metas no modelo de caixinha: guardar e resgatar são transferências de verdade entre uma conta da pessoa e a
// caixinha da meta. Os dois exigem Idempotency-Key: a tela gera uma ao abrir e reusa nas tentativas.
const BASE = "metas"

/** Metas ativas; `soPessoais` tira as de família (essas moram no espaço da família). */
export const getMetas = (soPessoais = true): Promise<Meta[]> =>
  api.get<Meta[]>(BASE, { params: { pessoais: soPessoais } }).then((r) => r.data)

export const getMeta = (id: string): Promise<Meta> => api.get<Meta>(`${BASE}/${id}`).then((r) => r.data)

export const criarMeta = (dto: CriarMetaDto): Promise<Meta> =>
  api.post<Meta>(BASE, dto, { skipErrorToast: true }).then((r) => r.data)

export const atualizarMeta = (id: string, dto: CriarMetaDto): Promise<Meta> =>
  api.put<Meta>(`${BASE}/${id}`, dto, { skipErrorToast: true }).then((r) => r.data)

/** Só sai com a caixinha zerada (o servidor recusa com 409 e diz quanto tem). */
export const excluirMeta = (id: string): Promise<void> =>
  api.delete(`${BASE}/${id}`, { skipErrorToast: true }).then(() => undefined)

/** "Essa meta cabe?" na hora de criar ou editar (`metaId` = editando aquela). `dataLimite`: "YYYY-MM-01" ou null. */
export const getViabilidadeMeta = (valorAlvo: number, dataLimite: string | null, metaId?: string): Promise<ViabilidadeMeta> =>
  api.get<ViabilidadeMeta>(`${BASE}/viabilidade`, { params: { valorAlvo, ...(dataLimite ? { dataLimite } : {}), ...(metaId ? { metaId } : {}) } })
    .then((r) => r.data)

/** Guardou e resgatou, mais recente em cima. */
export const getHistoricoMeta = (id: string): Promise<MovimentoMeta[]> =>
  api.get<MovimentoMeta[]>(`${BASE}/${id}/historico`).then((r) => r.data)

/** `data`: "YYYY-MM-DD" (o dia de hoje do aparelho). */
export const guardarNaMeta = (id: string, contaId: string, valor: number, data: string, chave: string): Promise<Meta> =>
  api.post<Meta>(`${BASE}/${id}/guardar`, { contaId, valor, data }, { headers: { "Idempotency-Key": chave }, skipErrorToast: true }).then((r) => r.data)

/** "Concluir e usar o dinheiro": o guardado todo vai pra `contaId` e a meta fica em Concluídas. */
export const concluirMeta = (id: string, contaId: string, data: string, chave: string): Promise<Meta> =>
  api.post<Meta>(`${BASE}/${id}/concluir`, { contaId, data }, { headers: { "Idempotency-Key": chave }, skipErrorToast: true }).then((r) => r.data)

export const resgatarDaMeta = (id: string, contaId: string, valor: number, data: string, chave: string): Promise<Meta> =>
  api.post<Meta>(`${BASE}/${id}/resgatar`, { contaId, valor, data }, { headers: { "Idempotency-Key": chave }, skipErrorToast: true }).then((r) => r.data)
