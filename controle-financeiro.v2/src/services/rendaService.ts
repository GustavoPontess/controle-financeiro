import { api } from "../api/cliente"
import type { RendaFamilia, RendaMes, VisibilidadeRenda } from "../types/Renda"

/** O mês da pessoa: previsto (fixas + variável esperada), recebido, o que falta e as entradas. */
export const getRendaMes = async (ano: number, mes: number): Promise<RendaMes> => {
  const res = await api.get("/renda/mes", { params: { ano, mes } })
  return res.data
}

/** Define a variável esperada do mês; null apaga (volta a valer a do último mês que tem). Devolve o mês recalculado. */
export const definirVariavelEsperada = async (ano: number, mes: number, variavelEsperada: number | null): Promise<RendaMes> => {
  const res = await api.put("/renda/mes", { ano, mes, variavelEsperada })
  return res.data
}

/** A própria pessoa escolhe o que a família vê da renda dela. `para` só vale com "valor pra alguns". */
export const definirVisibilidadeRenda = async (familiaId: string, membroId: string, visibilidade: VisibilidadeRenda, para: string[] = []): Promise<void> => {
  await api.put(`/familias/${familiaId}/membros/${membroId}/renda-visibilidade`, { visibilidade, para })
}

/** Renda da casa no mês, calculada no servidor pra quem pede. */
export const getRendaFamilia = async (familiaId: string, ano: number, mes: number): Promise<RendaFamilia> => {
  const res = await api.get(`/familias/${familiaId}/renda`, { params: { ano, mes } })
  return res.data
}
