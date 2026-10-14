import { api } from "../api/cliente"
import type { ReconciliacaoMarco, CriarMarcoReconciliacao } from "../types/Reconciliacao"

/** Marcos de uma conta (mais recente primeiro). */
export const listMarcos = async (contaId: string): Promise<ReconciliacaoMarco[]> => {
  const res = await api.get(`/reconciliacao/contas/${contaId}/marcos`)
  return res.data
}

/** Saldo que o app calcula pra a conta até uma data+hora (ISO) — pra conferir antes de gravar. */
export const getSaldoCalculado = async (contaId: string, dataHora: string): Promise<number> => {
  const res = await api.get(`/reconciliacao/contas/${contaId}/saldo-calculado`, { params: { dataHora } })
  return res.data.saldoCalculado
}

/** Cria um marco. `idempotencyKey` = UUID por tentativa (header). */
export const criarMarco = async (dto: CriarMarcoReconciliacao, idempotencyKey: string): Promise<ReconciliacaoMarco> => {
  const res = await api.post(`/reconciliacao/marcos`, dto, { headers: { "Idempotency-Key": idempotencyKey } })
  return res.data
}

/**
 * Fecha a diferença de um marco JÁ GRAVADO: o backend recalcula o saldo até a data do marco e, se
 * ainda não bate, lança o ajuste (no máximo um por marco); se passou a bater, só atualiza o marco.
 */
export const fecharDiferenca = async (id: string, idempotencyKey: string): Promise<ReconciliacaoMarco> => {
  const res = await api.post(`/reconciliacao/marcos/${id}/fechar`, null, { headers: { "Idempotency-Key": idempotencyKey } })
  return res.data
}

/** Remove um marco (e cancela o lançamento de ajuste que ele criou, se houver). */
export const removerMarco = async (id: string): Promise<void> => {
  await api.delete(`/reconciliacao/marcos/${id}`)
}
