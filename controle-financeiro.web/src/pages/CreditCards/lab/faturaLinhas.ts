// Bancada de layout de Cartões: lançamentos de uma fatura numa lista única ordenada por DATA (mais
// recente primeiro) — compras, parcelas e pagamentos misturados, como no app do banco.
// A parcela entra no dia do mês da compra dentro do ciclo (compra em 15/07 → 15/10 na fatura de
// novembro), não na data da compra original (que jogaria todas as parcelas pro fim) nem no topo.
import type { FaturaDetalhe } from "../../../types/Fatura"
import type { FaturaView } from "../ciclosFatura"

export type LinhaFatura =
  | { tipo: "compra"; id: string; dia: string; descricao: string; categoria?: string; valor: number; prevista?: boolean }
  | { tipo: "parcela"; id: string; dia: string; descricao: string; categoria?: string; valor: number; numero: number; total: number; parcelamentoId: string; dataCompra: string }
  | { tipo: "pagamento"; id: string; dia: string; descricao: string; valor: number }

const diaIso = (s: string) => s.slice(0, 10)
const diasNoMes = (ano: number, mes0: number) => new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate()

/** Dia, dentro do ciclo [inicio, fechamento), com o mesmo dia do mês da compra. */
export function diaNoCiclo(dataCompra: string, inicio: string, fechamento: string): string {
  const diaCompra = Number(dataCompra.slice(8, 10))
  const ini = new Date(`${diaIso(inicio)}T00:00:00Z`)
  for (let k = 0; k < 2; k++) {
    const ano = ini.getUTCFullYear() + Math.floor((ini.getUTCMonth() + k) / 12)
    const mes0 = (ini.getUTCMonth() + k) % 12
    const candidato = new Date(Date.UTC(ano, mes0, Math.min(diaCompra, diasNoMes(ano, mes0))))
    const iso = candidato.toISOString().slice(0, 10)
    if (iso >= diaIso(inicio) && iso < diaIso(fechamento)) return iso
  }
  return diaIso(inicio)
}

/** Linhas da fatura, ou null enquanto o detalhe da fatura real ainda não chegou. */
export function linhasDaFatura(f: FaturaView, detalhe?: FaturaDetalhe): LinhaFatura[] | null {
  if (f.vazia) return []
  if (f.prevista) {
    return (f.projLancamentos ?? []).map((l) => ({
      tipo: "compra" as const, id: l.id, dia: diaIso(l.data), descricao: l.descricao, valor: l.valor, prevista: true,
    }))
  }
  if (!detalhe) return null
  const linhas: LinhaFatura[] = [
    ...detalhe.transacoes.map((t) => ({
      tipo: "compra" as const, id: t.id, dia: diaIso(t.data), descricao: t.descricao, categoria: t.categoriaDescricao, valor: t.valor,
    })),
    ...(detalhe.parcelas ?? []).map((p) => ({
      tipo: "parcela" as const, id: p.id, dia: diaNoCiclo(p.data, f.dataInicio, f.dataFechamento), descricao: p.descricao,
      categoria: p.categoriaDescricao, valor: p.valor, numero: p.numero, total: p.quantidadeTotal,
      parcelamentoId: p.parcelamentoId, dataCompra: diaIso(p.data),
    })),
    ...(detalhe.pagamentos ?? []).map((p) => ({
      tipo: "pagamento" as const, id: p.id, dia: diaIso(p.data), descricao: `Pagamento · ${p.meioPagamentoDescricao}`, valor: p.valor,
    })),
  ]
  return linhas.sort((a, b) => (a.dia === b.dia ? 0 : a.dia < b.dia ? 1 : -1))
}

/** "09/10" a partir de "2026-10-09". */
export const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** "qui, 9 de out." a partir de "2026-10-09" (cabeçalho do agrupamento por dia). */
export const diaPorExtenso = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })

/** "nov/26" a partir da data de fechamento. */
export const mesCurto = (dataFechamento: string) => {
  const m = new Date(dataFechamento).toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "")
  return `${m}/${dataFechamento.slice(2, 4)}`
}
