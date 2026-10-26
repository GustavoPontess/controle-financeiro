// Regras de exibição da conta fixa (recorrente) usadas por mais de uma tela: como descrever a repetição
// e como rotular a situação (calculada no servidor: ativa / pausada / cancelada / encerrada).
import type { Recorrente, SituacaoRecorrente } from "../types/Recorrente"

/** Enum FrequenciaRecorrencia do back. */
export const FREQUENCIA = { semanal: 1, mensal: 2, anual: 3 } as const

/** "todo mês, dia 5" · "toda semana" · "todo ano em 15/06" */
export function descreverRepeticao(r: Pick<Recorrente, "frequencia" | "dia" | "dataInicio">): string {
  if (r.frequencia === FREQUENCIA.semanal) return "toda semana"
  if (r.frequencia === FREQUENCIA.anual) return `todo ano em ${r.dataInicio.slice(8, 10)}/${r.dataInicio.slice(5, 7)}`
  return `todo mês, dia ${r.dia}`
}

const DIAS_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"]

/**
 * A regra por extenso, pra prévia do formulário: "Todo dia 10, a partir de 10/11/2026" · "Toda segunda-feira,
 * a partir de …" · "Todo ano em 15/06, a partir de … até …". Datas "YYYY-MM-DD" lidas do texto (sem fuso).
 */
export function descreverRegra(frequencia: number, inicio: string, fim?: string): string {
  const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
  let quando: string
  if (frequencia === FREQUENCIA.semanal) {
    const [a, m, d] = inicio.split("-").map(Number)
    const dia = DIAS_SEMANA[new Date(a, m - 1, d).getDay()]
    quando = `${dia === "sábado" || dia === "domingo" ? "Todo" : "Toda"} ${dia}`
  } else if (frequencia === FREQUENCIA.anual) quando = `Todo ano em ${inicio.slice(8, 10)}/${inicio.slice(5, 7)}`
  else quando = `Todo dia ${Number(inicio.slice(8, 10))}`
  return `${quando}, a partir de ${br(inicio)}${fim ? ` até ${br(fim)}` : ""}`
}

/** O servidor aceita começar até 12 meses atrás e até 5 anos à frente (AgendaRecorrente). */
export function limitesDoInicio(hoje: string): { min: string; max: string } {
  const [a, m, d] = hoje.split("-").map(Number)
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`
  return { min: iso(new Date(a - 1, m - 1, d)), max: iso(new Date(a + 5, m - 1, d)) }
}

export const SITUACAO: Record<SituacaoRecorrente, { rotulo: string; tom?: "positivo" | "negativo" | "alerta" }> = {
  ativa: { rotulo: "Ativa", tom: "positivo" },
  pausada: { rotulo: "Pausada", tom: "alerta" },
  cancelada: { rotulo: "Cancelada", tom: "negativo" },
  encerrada: { rotulo: "Encerrada" },
}
