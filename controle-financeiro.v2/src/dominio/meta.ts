// Rótulos e contas de Metas no v2 (um lugar só pra lista, formulário e guardar/tirar).
import type { SituacaoMeta } from "../types/Meta"

export const MAX_NOME_META = 120

/** Etiqueta da situação; "sem-prazo" não ganha etiqueta (a linha já mostra a porcentagem). */
export const SITUACAO_META: Record<SituacaoMeta, { rotulo: string; tom?: "positivo" | "negativo" | "alerta" } | null> = {
  "concluida": { rotulo: "Chegou lá", tom: "positivo" },
  "no-ritmo": { rotulo: "No ritmo", tom: "positivo" },
  "atras": { rotulo: "Atrás do ritmo", tom: "alerta" },
  "prazo-passou": { rotulo: "Prazo passou", tom: "negativo" },
  "sem-prazo": null,
}

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

/** "dez/2027" a partir de "2027-12-01..." */
export function mesAnoCurto(iso: string): string {
  const [a, m] = iso.slice(0, 7).split("-").map(Number)
  return `${MESES_CURTOS[m - 1]}/${a}`
}

/** "YYYY-MM-01" do mês escolhido. */
export const prazoIso = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}-01`
