// Valor em dinheiro do v2: respeita o "olho" global (esconder saldos) e colore só quando pedido.
import { useHideBalance } from "../estado/ocultar"
import { MONEY_MASK, formatMoney } from "../utils/money"

export type TomDinheiro = "positivo" | "negativo" | "neutro"

export function Dinheiro({ valor, tom, className }: { valor: number; tom?: TomDinheiro; className?: string }) {
  const [oculto] = useHideBalance()
  return <span className={className} data-tom={tom}>{oculto ? MONEY_MASK : formatMoney(valor)}</span>
}

/** "+12%" / "−8%" entre dois valores; null quando não dá pra comparar. */
export function variacao(atual: number, anterior: number): { texto: string; sobe: boolean } | null {
  if (!anterior) return null
  const pct = ((atual - anterior) / Math.abs(anterior)) * 100
  if (!Number.isFinite(pct)) return null
  const r = Math.round(pct)
  return { texto: `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r)}%`, sobe: r >= 0 }
}

/** "09/10" a partir de "2026-10-09". */
export const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
