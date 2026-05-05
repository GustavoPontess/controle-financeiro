import { api } from "../api/axiosConfig"
import type { Fatura, FaturaDetalhe, PagarFaturaPayload } from "../types/Fatura"

export const getFaturasByCartao = async (cartaoCreditoId: string): Promise<Fatura[]> => {
  const res = await api.get(`/cartoes/${cartaoCreditoId}/faturas`)
  return res.data
}

export const getFaturaDetalhe = async (cartaoCreditoId: string, faturaId: string): Promise<FaturaDetalhe> => {
  const res = await api.get(`/cartoes/${cartaoCreditoId}/faturas/${faturaId}`)
  return res.data
}

export const pagarFatura = async (
  cartaoCreditoId: string,
  faturaId: string,
  payload: PagarFaturaPayload
): Promise<void> => {
  await api.post(`/cartoes/${cartaoCreditoId}/faturas/${faturaId}/pagar`, payload)
}
