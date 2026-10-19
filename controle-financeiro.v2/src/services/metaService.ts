import { api } from "../api/cliente"
import type { ContaLivre, CriarMetaDto, Meta } from "../types/Meta"

// Metas no modelo de reserva: guardar/tirar marcam parte do saldo de uma conta (o dinheiro não sai dela).
// Guardar e tirar exigem Idempotency-Key: a tela gera uma ao abrir e reusa nas tentativas.
const BASE = "metas"

/** Metas ativas; `soPessoais` tira as de família (essas moram no espaço da família). */
export const getMetas = (soPessoais = true): Promise<Meta[]> =>
  api.get<Meta[]>(BASE, { params: { pessoais: soPessoais } }).then((r) => r.data)

export const getMeta = (id: string): Promise<Meta> => api.get<Meta>(`${BASE}/${id}`).then((r) => r.data)

export const criarMeta = (dto: CriarMetaDto): Promise<Meta> =>
  api.post<Meta>(BASE, dto, { skipErrorToast: true }).then((r) => r.data)

export const atualizarMeta = (id: string, dto: CriarMetaDto): Promise<Meta> =>
  api.put<Meta>(`${BASE}/${id}`, dto, { skipErrorToast: true }).then((r) => r.data)

export const excluirMeta = (id: string): Promise<void> =>
  api.delete(`${BASE}/${id}`, { skipErrorToast: true }).then(() => undefined)

/** Contas abertas com saldo, reservado em metas e livre (pra escolher de onde guardar). */
export const getContasLivres = (): Promise<ContaLivre[]> =>
  api.get<ContaLivre[]>(`${BASE}/contas`).then((r) => r.data)

export const guardarNaMeta = (id: string, contaId: string, valor: number, chave: string): Promise<Meta> =>
  api.post<Meta>(`${BASE}/${id}/guardar`, { contaId, valor }, { headers: { "Idempotency-Key": chave }, skipErrorToast: true }).then((r) => r.data)

export const tirarDaMeta = (id: string, contaId: string, valor: number, chave: string): Promise<Meta> =>
  api.post<Meta>(`${BASE}/${id}/tirar`, { contaId, valor }, { headers: { "Idempotency-Key": chave }, skipErrorToast: true }).then((r) => r.data)
