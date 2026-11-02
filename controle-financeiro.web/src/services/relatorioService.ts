import { api } from "../api/cliente"
import type { AnoDoCheckUp, CheckUp, RelatorioData, Sinal } from "../types/Relatorio"

export const getRelatorio = async (ano?: number): Promise<RelatorioData> => {
  const params = ano ? `?ano=${ano}` : ""
  const res = await api.get(`/relatorios${params}`)
  return res.data
}

/** O check-up do mês (Relatórios do v2): o servidor faz a conta e a frase. */
export const getCheckUp = async (ano: number, mes: number): Promise<CheckUp> => {
  const res = await api.get("/relatorios/check-up", { params: { ano, mes } })
  return res.data
}

/** O "Ano completo": o ano somado (totais contra o planejado, os meses da linha do tempo e as categorias). */
export const getAno = async (ano: number): Promise<AnoDoCheckUp> => {
  const res = await api.get("/relatorios/ano", { params: { ano } })
  return res.data
}

/** "O que vale olhar": os avisos das outras telas, juntos e na ordem do que precisa de ação primeiro. */
export const getSinais = async (ano: number, mes: number): Promise<Sinal[]> => {
  const res = await api.get("/relatorios/sinais", { params: { ano, mes } })
  return res.data
}

/** Endereço do CSV dos lançamentos do mês (o navegador baixa com a sessão). */
export const urlCsvDoMes = (ano: number, mes: number): string => {
  const doisDigitos = (n: number) => String(n).padStart(2, "0")
  const fim = new Date(ano, mes, 0).getDate()
  return `/api/v1/relatorios/export/csv?dataInicio=${ano}-${doisDigitos(mes)}-01&dataFim=${ano}-${doisDigitos(mes)}-${doisDigitos(fim)}`
}
