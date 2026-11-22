import { api } from "../api/cliente"
import type { CartaoCredito, CriarCartaoCredito, SugestaoContaFixa } from "../types/CartaoCredito"

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

/** Cobranças que se repetem no cartão e ainda não são conta fixa (o app só sugere). */
export const getSugestoesContaFixa = async (id: string): Promise<SugestaoContaFixa[]> =>
  (await api.get(`/cartoes/${id}/sugestoes-conta-fixa`)).data

/** "Não é conta fixa": a sugestão desse lugar não volta nesse cartão. */
export const dispensarSugestaoContaFixa = async (id: string, chave: string): Promise<void> => {
  await api.post(`/cartoes/${id}/sugestoes-conta-fixa/dispensar`, { chave })
}
