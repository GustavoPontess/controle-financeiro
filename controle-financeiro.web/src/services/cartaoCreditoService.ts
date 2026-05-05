import { api } from "../api/axiosConfig"
import type { CartaoCredito, CriarCartaoCredito } from "../types/CartaoCredito"

export const getCartoes = async (): Promise<CartaoCredito[]> => {
  const res = await api.get("/cartoes")
  return res.data
}

export const createCartao = async (dto: CriarCartaoCredito): Promise<CartaoCredito> => {
  const res = await api.post("/cartoes", dto)
  return res.data
}

export const updateCartao = async (id: string, dto: CriarCartaoCredito): Promise<void> => {
  await api.put(`/cartoes/${id}`, dto)
}

export const deleteCartao = async (id: string): Promise<void> => {
  await api.delete(`/cartoes/${id}`)
}
