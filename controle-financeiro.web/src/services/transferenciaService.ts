import { api } from "../api/cliente"
import type { Transferencia, CriarTransferencia } from "../types/Transferencia"

// Transferência entre contas próprias. Criada pelo modal "Nova transação"
// (natureza = transferência); aparece no extrato (Transações) como 2 pernas
// neutras. Não há tela dedicada — o extrato + o filtro "Tipo de lançamento" cobrem.

/** Idempotency-Key (uma por abertura da tela): repetir o pedido não move o dinheiro duas vezes. */
export const createTransferencia = async (dto: CriarTransferencia, idempotencyKey?: string): Promise<Transferencia> => {
  const res = await api.post("/transferencias", dto, idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined)
  return res.data
}

/** Edita a transferência inteira: o mesmo corpo de criar (regra do formulário); as duas pernas mudam juntas. */
export const editarTransferencia = async (id: string, dto: CriarTransferencia): Promise<Transferencia> => {
  const res = await api.put(`/transferencias/${id}`, dto)
  return res.data
}

/** A transferência de que esta transação é uma perna (pra abrir a edição pela tela da transação). */
export const getTransferenciaDaTransacao = async (transacaoId: string): Promise<Transferencia> => {
  const res = await api.get(`/transferencias/da-transacao/${transacaoId}`)
  return res.data
}

export const deleteTransferencia = async (id: string): Promise<void> => {
  await api.delete(`/transferencias/${id}`)
}
