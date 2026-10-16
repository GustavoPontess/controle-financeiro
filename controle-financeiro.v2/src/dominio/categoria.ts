// Regras de categoria usadas por mais de uma tela (lista, formulário, excluir). Números = enum Finalidade do back.
import type { Category, UsoCategoria } from "../types/Category"

export const FINALIDADE = { despesa: 1, receita: 2, ambas: 3 } as const

export const FINALIDADES = [
  { valor: FINALIDADE.despesa, rotulo: "Despesa" },
  { valor: FINALIDADE.receita, rotulo: "Receita" },
  { valor: FINALIDADE.ambas, rotulo: "As duas" },
]

/** Limites do back (docs/REGRAS_CAMPOS.md): nome de categoria 100, de subcategoria 120. */
export const MAX_NOME_CATEGORIA = 100
export const MAX_NOME_SUBCATEGORIA = 120

/** A categoria aparece na aba (despesa/receita)? "As duas" aparece nas duas. */
export const serveParaTipo = (c: Category, finalidade: number) => c.finalidade === FINALIDADE.ambas || c.finalidade === finalidade

/**
 * Pra onde dá pra mover o que está numa categoria que vai sair: as outras que aceitam o mesmo tipo. Uma "as duas"
 * pode ter só despesa: aí todas entram e o servidor confere (recusa o destino que não serve, com mensagem).
 */
export const destinosPossiveis = (origem: Category, todas: Category[]) =>
  todas.filter((c) => c.id !== origem.id && (origem.finalidade === FINALIDADE.ambas || serveParaTipo(c, origem.finalidade)))

/** "12 lançamentos · 2 contas fixas" — só o que tem. */
export function descreverUso(u: UsoCategoria): string {
  const p = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`)
  return [
    u.lancamentos ? p(u.lancamentos, "lançamento", "lançamentos") : null,
    u.contasFixas ? p(u.contasFixas, "conta fixa", "contas fixas") : null,
    u.parcelamentos ? p(u.parcelamentos, "parcelamento", "parcelamentos") : null,
    u.limites ? p(u.limites, "limite", "limites") : null,
    u.metas ? p(u.metas, "meta", "metas") : null,
    u.subcategorias ? p(u.subcategorias, "subcategoria", "subcategorias") : null,
    u.lancamentosExcluidos ? p(u.lancamentosExcluidos, "lançamento excluído", "lançamentos excluídos") : null,
  ].filter(Boolean).join(" · ")
}

/** "vai" ou "vão", pelo total do que se move (1 lançamento vai; 2 lançamentos vão). */
export const verboMover = (u: Partial<UsoCategoria>) =>
  (u.lancamentos ?? 0) + (u.contasFixas ?? 0) + (u.parcelamentos ?? 0) + (u.limites ?? 0) + (u.metas ?? 0)
    + (u.subcategorias ?? 0) + (u.lancamentosExcluidos ?? 0) === 1 ? "vai" : "vão"

/** Precisa escolher destino pra excluir? Quem decide é o servidor (conta até o que já foi excluído). */
export const emUso = (u: UsoCategoria) =>
  u.precisaDestino ?? u.lancamentos + u.contasFixas + u.parcelamentos + u.limites + u.metas + u.subcategorias > 0
