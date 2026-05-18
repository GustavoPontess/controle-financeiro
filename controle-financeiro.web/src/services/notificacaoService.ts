import { api } from "../api/axiosConfig"
import type { Notificacao, ContagemNotificacao } from "../types/Notificacao"

export const getNotificacoes = async (): Promise<Notificacao[]> => {
  const res = await api.get("/notificacoes")
  return res.data
}

export const getContagemNaoLidas = async (): Promise<ContagemNotificacao> => {
  const res = await api.get("/notificacoes/contagem")
  return res.data
}

export const marcarNotificacaoLida = async (id: string): Promise<void> => {
  await api.put(`/notificacoes/${id}/lida`)
}

export const marcarTodasLidas = async (): Promise<void> => {
  await api.put("/notificacoes/lidas")
}
