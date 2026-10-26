import { api } from "../api/cliente"
import type { RendaFamilia, RendaMes, VisibilidadeRenda } from "../types/Renda"

/** O mês da pessoa: previsto (o esperado das Receitas do Orçamento), recebido, o que falta e as entradas. O esperado
 *  se muda nas Receitas do Orçamento (`definirReceita`), não mais aqui. */
export const getRendaMes = async (ano: number, mes: number): Promise<RendaMes> => {
  const res = await api.get("/renda/mes", { params: { ano, mes } })
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
