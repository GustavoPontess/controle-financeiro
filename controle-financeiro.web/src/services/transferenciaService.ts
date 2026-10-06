import { api } from "../api/axiosConfig"
import type { Transferencia, CriarTransferencia } from "../types/Transferencia"

// Transferência entre contas próprias. Criada pelo modal "Nova transação"
// (natureza = transferência); aparece no extrato (Transações) como 2 pernas
// neutras. Não há tela dedicada — o extrato + o filtro "Tipo de lançamento" cobrem.

export const createTransferencia = async (dto: CriarTransferencia): Promise<Transferencia> => {
  const res = await api.post("/transferencias", dto)
  return res.data
}

export const deleteTransferencia = async (id: string): Promise<void> => {
  await api.delete(`/transferencias/${id}`)
}
