import { dataLocalISO } from "@/utils/dateTime"
import { parseMoney } from "@/utils/money"

// ── tipos de form ─────────────────────────────────────────────────────────────

export type CriarForm = {
  descricao: string
  valor: string
  tipo: string
  categoriaId: string
  contaId: string
  frequencia: string
  dia: string
  dataInicio: string
  dataFim: string
}

export type CriarErrors = Partial<Record<keyof CriarForm, string>>

export const emptyCriarForm = (): CriarForm => ({
  descricao: "",
  valor: "",
  tipo: "1",
  categoriaId: "",
  contaId: "",
  frequencia: "2",
  dia: "1",
  dataInicio: dataLocalISO(),
  dataFim: "",
})

// Faixa da data de início — a mesma do servidor (AgendaRecorrente.ValidarPeriodo): até 12 meses atrás
// (lança como pago o que já passou) e até 5 anos à frente.
export function faixaInicio(): { min: string; max: string } {
  const min = new Date()
  min.setMonth(min.getMonth() - 12)
  const max = new Date()
  max.setFullYear(max.getFullYear() + 5)
  return { min: dataLocalISO(min), max: dataLocalISO(max) }
}

export function validateCriar(f: CriarForm): CriarErrors {
  const errs: CriarErrors = {}
  if (!f.descricao.trim()) errs.descricao = "Descrição obrigatória."
  const v = parseMoney(f.valor)
  if (!f.valor || v <= 0) errs.valor = "Informe um valor positivo."
  if (!f.contaId) errs.contaId = "Selecione uma conta."
  const faixa = faixaInicio()
  if (!f.dataInicio) errs.dataInicio = "Data de início obrigatória."
  else if (f.dataInicio < faixa.min || f.dataInicio > faixa.max)
    errs.dataInicio = "Início entre 12 meses atrás e 5 anos à frente."
  if (f.dataFim && f.dataInicio && f.dataFim < f.dataInicio)
    errs.dataFim = "O fim não pode ser antes do início."
  const dia = parseInt(f.dia)
  if (isNaN(dia) || dia < 1 || dia > 31) errs.dia = "Dia de 1 a 31."
  return errs
}
