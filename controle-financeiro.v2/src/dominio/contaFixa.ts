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

export const SITUACAO: Record<SituacaoRecorrente, { rotulo: string; tom?: "positivo" | "negativo" | "alerta" }> = {
  ativa: { rotulo: "Ativa", tom: "positivo" },
  pausada: { rotulo: "Pausada", tom: "alerta" },
  cancelada: { rotulo: "Cancelada", tom: "negativo" },
  encerrada: { rotulo: "Encerrada" },
}
