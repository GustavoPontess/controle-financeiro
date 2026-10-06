/**
 * Tipos e helpers dos filtros avançados da PontesTabela (sem componente, pro fast refresh).
 * O componente (botão + drawer) fica em TabelaFiltros.tsx.
 */
import { formatMoney } from "@/utils/money"

// `coluna` (opcional): key da coluna que o filtro depende. Se essa coluna estiver
// oculta, o filtro some junto — filtros aparecem conforme as colunas visíveis.
// Sem `coluna`, o filtro aparece sempre (ex.: Conta, que não tem coluna própria).
export type PontesFiltroAvancado =
  | { tipo: "select"; id: string; label: string; value: string; neutro?: string; coluna?: string; opcoes: { value: string; label: string }[]; onChange: (v: string) => void }
  | { tipo: "faixaValor"; id: string; label: string; coluna?: string; min?: number; max?: number; onChange: (min?: number, max?: number) => void }
  | { tipo: "faixaData"; id: string; label: string; coluna?: string; de?: string; ate?: string; onChange: (de?: string, ate?: string) => void }

export type PontesTabelaTag = { label: string; onRemover: () => void }

// dinheiro: string mascarada (dígitos→centavos) ↔ número
export const numeroParaMascara = (n?: number) =>
  n == null ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const mascaraParaNumero = (s: string) => {
  const d = s.replace(/\D/g, "")
  return d ? Number(d) / 100 : undefined
}
export const mascararDinheiro = (raw: string) => numeroParaMascara(mascaraParaNumero(raw))
const fmtData = (s?: string) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "")

export function filtroAvancadoAtivo(f: PontesFiltroAvancado): boolean {
  if (f.tipo === "select") return f.value !== (f.neutro ?? "")
  if (f.tipo === "faixaValor") return f.min != null || f.max != null
  return !!f.de || !!f.ate
}

export function tagsDeFiltrosAvancados(filtros: PontesFiltroAvancado[]): PontesTabelaTag[] {
  return filtros.filter(filtroAvancadoAtivo).map((f) => {
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
