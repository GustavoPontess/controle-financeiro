import { api } from "../api/axiosConfig"
import type { Familia, FamiliaDetalhe, ConviteFamilia, MembroFamilia } from "../types/Familia"

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
