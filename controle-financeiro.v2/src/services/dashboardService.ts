import { api } from "../api/cliente"
import type { DashboardData } from "../types/Dashboard"

export const getDashboard = async (ano?: number, mes?: number): Promise<DashboardData> => {
  const params = new URLSearchParams()
  if (ano) params.append("ano", String(ano))
  if (mes) params.append("mes", String(mes))
  const res = await api.get(`/dashboard?${params.toString()}`)
  return res.data
}
