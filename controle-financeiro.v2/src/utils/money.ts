import { isBalanceHidden } from "../estado/ocultar"

export const MONEY_MASK = "R$ ••••"
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

/** BRL; mascarado quando o olho está fechado. */
export function formatMoney(valor: number): string {
  return isBalanceHidden() ? MONEY_MASK : BRL.format(valor)
}

/** "1.234,56" → 1234.56 */
export function parseMoney(texto: string): number {
  return Number(texto.replace(/\./g, "").replace(",", ".")) || 0
}

/** Dígitos lidos como centavos ("394420" → "3.944,20"). */
export function maskMoney(raw: string, anterior = ""): string {
  const d = raw.replace(/\D/g, "")
  if (!d) return ""
  const valor = Number(d) / 100
  if (valor === 0 && d.length < anterior.replace(/\D/g, "").length) return ""
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function moneyParaCampo(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
