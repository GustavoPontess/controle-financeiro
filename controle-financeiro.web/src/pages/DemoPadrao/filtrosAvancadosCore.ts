/**
 * SANDBOX — tipos e helpers dos filtros avançados (sem componente, pro fast refresh). O componente
 * (botão + drawer) fica em FiltrosAvancados.tsx.
 */
import { formatMoney } from "@/utils/money"

export type FiltroAvancado =
  | { tipo: "select"; id: string; label: string; value: string; neutro?: string; opcoes: { value: string; label: string }[]; onChange: (v: string) => void }
  | { tipo: "faixaValor"; id: string; label: string; min?: number; max?: number; onChange: (min?: number, max?: number) => void }
  | { tipo: "faixaData"; id: string; label: string; de?: string; ate?: string; onChange: (de?: string, ate?: string) => void }

export type TagFiltro = { label: string; onRemover: () => void }

// dinheiro: string mascarada (PontesMoneyInput = dígitos→centavos) ↔ número
export const numeroParaMasked = (n?: number) =>
  n == null ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const maskedParaNumero = (s: string) => {
  const d = s.replace(/\D/g, "")
  return d ? Number(d) / 100 : undefined
}
const fmtData = (s?: string) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "")

export function filtroAtivo(f: FiltroAvancado): boolean {
  if (f.tipo === "select") return f.value !== (f.neutro ?? "")
  if (f.tipo === "faixaValor") return f.min != null || f.max != null
  return !!f.de || !!f.ate
}

export function tagsDeFiltrosAvancados(filtros: FiltroAvancado[]): TagFiltro[] {
  return filtros.filter(filtroAtivo).map((f) => {
    if (f.tipo === "select") {
      const opt = f.opcoes.find((o) => o.value === f.value)
      return { label: `${f.label}: ${opt?.label ?? f.value}`, onRemover: () => f.onChange(f.neutro ?? "") }
    }
    if (f.tipo === "faixaValor") {
      const txt = f.min != null && f.max != null ? `${formatMoney(f.min)}–${formatMoney(f.max)}`
        : f.min != null ? `≥ ${formatMoney(f.min)}` : `≤ ${formatMoney(f.max!)}`
      return { label: `${f.label}: ${txt}`, onRemover: () => f.onChange(undefined, undefined) }
    }
    const txt = f.de && f.ate ? `${fmtData(f.de)}–${fmtData(f.ate)}` : f.de ? `de ${fmtData(f.de)}` : `até ${fmtData(f.ate)}`
    return { label: `${f.label}: ${txt}`, onRemover: () => f.onChange(undefined, undefined) }
  })
}
