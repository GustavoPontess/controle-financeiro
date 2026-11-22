// Regras de categoria usadas por mais de uma tela (lista, formulário, excluir). Números = enum Finalidade do back.
import type { Category, UsoCategoria } from "../types/Category"

/** 4 = investimento (2026-10-22): aporte sai, resgate volta; mexe no saldo, não é gasto nem renda. */
export const FINALIDADE = { despesa: 1, receita: 2, ambas: 3, investimento: 4 } as const

export const FINALIDADES = [
  { valor: FINALIDADE.despesa, rotulo: "Despesa" },
  { valor: FINALIDADE.receita, rotulo: "Receita" },
  { valor: FINALIDADE.ambas, rotulo: "As duas" },
  { valor: FINALIDADE.investimento, rotulo: "Investimento" },
]

/** Limites do back (docs/REGRAS_CAMPOS.md): nome de categoria 100, de subcategoria 120. */
export const MAX_NOME_CATEGORIA = 100
export const MAX_NOME_SUBCATEGORIA = 120

/** A categoria aparece na aba (despesa/receita/investimento)? "As duas" aparece em despesa e receita. */
export const serveParaTipo = (c: Category, finalidade: number) =>
  c.finalidade === finalidade || (c.finalidade === FINALIDADE.ambas && finalidade !== FINALIDADE.investimento)

/** A aba da categoria (a de investimento tem a dela; "as duas" fica em despesa). */
export const abaDaFinalidade = (finalidade: number) =>
  finalidade === FINALIDADE.receita || finalidade === FINALIDADE.investimento ? finalidade : FINALIDADE.despesa

/** A categoria serve num lançamento desse tipo (1 despesa, 2 receita)? "As duas" e investimento (aporte sai, resgate
 *  volta) servem nos dois. */
export const aceitaTipo = (c: Category, tipo: number) =>
  c.finalidade === tipo || c.finalidade === FINALIDADE.ambas || c.finalidade === FINALIDADE.investimento

/** A categoria "Outros" (a de sobra): nunca é atalho nem sugestão de botão, e vai pro fim das listas. */
export const ehOutros = (c: Category) => c.descricao.trim().toLocaleLowerCase("pt-BR") === "outros"

/**
 * Os botões de sugestão de categoria de um lançamento (Importar extrato e Pendentes, a mesma regra): os ids na ordem de
 * preferência (o que o app sugere pro lugar, os mais usados, depois as do tipo), só os que servem no tipo, sem repetir e
 * sem "Outros" (Gustavo, 2026-11-05: é a última opção; se tudo cai lá, a categoria não diz nada). Até `limite`.
 */
export function sugestoesDeCategoria(categorias: Category[], tipo: number, preferidas: (string | null | undefined)[], limite = 4): string[] {
  const ids: string[] = []
  for (const id of [...preferidas, ...categorias.map((c) => c.id)]) {
    if (ids.length >= limite) break
    if (id && !ids.includes(id) && categorias.some((c) => c.id === id && aceitaTipo(c, tipo) && !ehOutros(c))) ids.push(id)
  }
  return ids
}

/** Os ids mais repetidos primeiro (a contagem de quantas vezes cada um aparece). */
export function maisRepetidos(ids: (string | null | undefined)[]): string[] {
  const conta = new Map<string, number>()
  for (const id of ids) if (id) conta.set(id, (conta.get(id) ?? 0) + 1)
  return [...conta.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
}

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

/** O "id" que a lista de transações entende como "sem categoria" (filtro). */
export const SEM_CATEGORIA = "00000000-0000-0000-0000-000000000000"

/** "Cartão (a detalhar)" nos relatórios: o pagamento de fatura sem as compras no app (RegrasFinanceiras.CartaoADetalhar). */
export const CARTAO_A_DETALHAR = "00000000-0000-0000-0000-00000000ca7d"

/** Pra onde leva tocar numa categoria dos relatórios: Transações filtrada (o "a detalhar" abre os pagamentos de fatura). */
export const linkDaCategoria = (chave: string, mes?: string) =>
  chave === CARTAO_A_DETALHAR
    ? `/transacoes?natureza=fatura${mes ? `&mes=${mes}` : ""}`
    : `/transacoes?categoriaId=${chave}${mes ? `&mes=${mes}` : ""}`
