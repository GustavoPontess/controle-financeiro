// Bancada de layout de Cartões — contas e cores dos labs D/E (referências do Behance: bento, imersivo). Só derivação de dado; nada de regra de dinheiro nova (valores vêm das faturas da API).
import type { Fatura } from "../../../types/Fatura"
import { darken } from "../cartoesFormato"
import { mesCurto } from "./faturaLinhas"
import { indiceMesDeHoje } from "../ciclosFatura"

export type BarraMes = { mes: string; rotulo: string; valor: number; atual: boolean }

/**
 * Soma das faturas de TODOS os cartões por mês de fechamento — de 2 meses atrás até 8 pra frente. "Atual" =
 * o mês em que fecha a fatura aberta hoje (`diaFechamento` do cartão de referência; dia 1 → mês seguinte).
 */
export function totaisPorMes(faturasPorCartao: Record<string, Fatura[]>, diaFechamento?: number, hoje = new Date()): BarraMes[] {
  const porMes = new Map<string, number>()
  for (const fs of Object.values(faturasPorCartao))
    for (const f of fs) porMes.set(f.dataFechamento.slice(0, 7), (porMes.get(f.dataFechamento.slice(0, 7)) ?? 0) + f.valorTotal)
  const base = indiceMesDeHoje(hoje, diaFechamento)
  const barras: BarraMes[] = []
  for (let k = -2; k <= 8; k++) {
    const i = base + k
    const mes = `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`
    barras.push({ mes, rotulo: mesCurto(`${mes}-01`), valor: porMes.get(mes) ?? 0, atual: k === 0 })
  }
  return barras
}

/** Palco escuro na cor do banco (cor = dado do cartão, valor de runtime) — fundo do layout imersivo. */
export function estagioBanco(bancoCor?: string): string {
  const hex = bancoCor && /^#?[0-9a-f]{6}$/i.test(bancoCor) ? (bancoCor.startsWith("#") ? bancoCor : `#${bancoCor}`) : "#334155"
  return `radial-gradient(120% 140% at 15% 0%, ${darken(hex, 0.55)} 0%, ${darken(hex, 0.82)} 55%, ${darken(hex, 0.9)} 100%)`
}
