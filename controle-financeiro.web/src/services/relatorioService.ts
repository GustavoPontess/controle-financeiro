import { api } from "../api/axiosConfig"
import type { RelatorioData } from "../types/Relatorio"

export const getRelatorio = async (ano?: number): Promise<RelatorioData> => {
  const params = ano ? `?ano=${ano}` : ""
  const res = await api.get(`/relatorios${params}`)
  return res.data
}
