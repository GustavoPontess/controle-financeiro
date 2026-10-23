import { api } from "../api/cliente"
import type { LimitesDoMes } from "../types/Limite"
import type { FontesDoMes } from "../types/Orcamento"

// Limites de gasto por categoria. Vale todo mês até a pessoa mudar: pôr, mudar e tirar valem do mês em diante.
const BASE = "orcamentos"

export const getLimitesDoMes = (ano: number, mes: number): Promise<LimitesDoMes> =>
  api.get<LimitesDoMes>(BASE, { params: { ano, mes } }).then((r) => r.data)

/** Média do gasto da categoria nos 3 meses antes do mês (null = não gastou nada). */
export const getSugestaoLimite = (categoriaId: string, ano: number, mes: number): Promise<number | null> =>
  api.get<{ mediaUltimos3Meses: number | null }>(`${BASE}/sugestao`, { params: { categoriaId, ano, mes } }).then((r) => r.data.mediaUltimos3Meses)

/** Põe ou muda o limite da categoria deste mês em diante (`categoriaId` null = o de todos os gastos). */
export const definirLimite = (categoriaId: string | null, ano: number, mes: number, valor: number): Promise<LimitesDoMes> =>
  api.put<LimitesDoMes>(BASE, { categoriaId, ano, mes, valor }, { skipErrorToast: true }).then((r) => r.data)

/** Tira o limite da categoria deste mês em diante (os meses passados continuam com ele). */
export const tirarLimite = (categoriaId: string | null, ano: number, mes: number): Promise<LimitesDoMes> =>
  api.delete<LimitesDoMes>(BASE, { params: { ...(categoriaId ? { categoriaId } : {}), ano, mes }, skipErrorToast: true }).then((r) => r.data)

/** As seções de fontes do Orçamento: Receitas (quanto espera receber) e Investimentos (quanto planeja investir). Mesma
 *  regra do planejado das despesas: vale todo mês até mudar. A fonte é a subcategoria ou, sem ela, a categoria inteira. */
export type LadoFonte = "receitas" | "investimentos"

export const getFontesDoMes = (lado: LadoFonte, ano: number, mes: number): Promise<FontesDoMes> =>
  api.get<FontesDoMes>(`${BASE}/${lado}`, { params: { ano, mes } }).then((r) => r.data)

export const definirFonte = (lado: LadoFonte, categoriaId: string, subcategoriaId: string | null, ano: number, mes: number, valor: number): Promise<FontesDoMes> =>
  api.put<FontesDoMes>(`${BASE}/${lado}`, { categoriaId, subcategoriaId, ano, mes, valor }, { skipErrorToast: true }).then((r) => r.data)

export const tirarFonte = (lado: LadoFonte, categoriaId: string, subcategoriaId: string | null, ano: number, mes: number): Promise<FontesDoMes> =>
  api.delete<FontesDoMes>(`${BASE}/${lado}`, {
    params: { categoriaId, ...(subcategoriaId ? { subcategoriaId } : {}), ano, mes }, skipErrorToast: true,
  }).then((r) => r.data)
