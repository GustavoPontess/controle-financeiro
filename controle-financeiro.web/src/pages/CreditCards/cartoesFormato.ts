// Formatações e regras de exibição da tela de Cartões, compartilhadas entre a tela real, os modais e
// as bancadas de layout (/credit-cards/lab-*). O logo da bandeira mora em BandeiraMark.tsx.
import type { Fatura } from "../../types/Fatura"

// Máscara de moeda pro input de limite: dígitos → número (centavos) e volta.
export const parseMoney = (masked: string): number | undefined => {
  const digits = masked.replace(/\D/g, "")
  return digits ? Number(digits) / 100 : undefined
}
export const fmtMoneyInput = (n?: number): string =>
  n != null ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""
// Datas de ciclo vêm como UTC (meia-noite) — formata em UTC pra não cair pro dia anterior.
export const formatDate = (s: string) => new Date(s).toLocaleDateString("pt-BR", { timeZone: "UTC" })

// Só 6 bandeiras — poucas o bastante pra virar chips visuais (3 por linha) em vez
// de select. 1 toque, sem digitar número nenhum (nem completo, nem mascarado).
export const BANDEIRA_OPTIONS = [
  { value: 1, label: "Visa" }, { value: 2, label: "Mastercard" }, { value: 3, label: "Elo" },
  { value: 4, label: "Hipercard" }, { value: 5, label: "American Express" }, { value: 6, label: "Outros" },
]

export const MEIOS_PAGAMENTO = [
  { value: "4", label: "Pix" }, { value: "2", label: "Débito" }, { value: "1", label: "Dinheiro" },
  { value: "5", label: "TED / DOC" }, { value: "6", label: "Boleto" },
]

// Gradiente da bandeira (cor real da marca do cartão — valor de dado, não tema).
const BANDEIRA_GRAD: Record<number, string> = {
  1: "linear-gradient(135deg, #1e40af, #3b82f6)",
  2: "linear-gradient(135deg, #7c2d12, #dc2626)",
  3: "linear-gradient(135deg, #0f766e, #14b8a6)",
  4: "linear-gradient(135deg, #9f1239, #e11d48)",
  5: "linear-gradient(135deg, #14532d, #16a34a)",
  6: "linear-gradient(135deg, #374151, #6b7280)",
}
const grad = (b: number) => BANDEIRA_GRAD[b] ?? BANDEIRA_GRAD[6]

// Escurece um hex (mistura com preto) — pra gerar gradient bonito a partir
// da cor da marca do banco (Nubank #820AD1 → #4a0577 + #820AD1).
export function darken(hex: string, amount = 0.45): string {
  const h = hex.replace("#", "")
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16)
  const k = 1 - amount
  const rr = Math.round(r * k), gg = Math.round(g * k), bb = Math.round(b * k)
  return `#${rr.toString(16).padStart(2, "0")}${gg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`
}
export function cardGradient(bancoCor: string | undefined, bandeira: number): string {
  if (bancoCor && /^#?[0-9a-f]{3,8}$/i.test(bancoCor)) {
    const hex = bancoCor.startsWith("#") ? bancoCor : `#${bancoCor}`
    return `linear-gradient(135deg, ${darken(hex, 0.45)}, ${hex})`
  }
  return grad(bandeira)
}

// Próxima ocorrência (dia do mês) a partir de hoje. Se o dia já passou no mês
// atual, pula pro próximo mês. Retorna dias inteiros até essa data.
export function diasAteProxDia(dia: number | undefined, now: number): number | null {
  if (!dia) return null
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const y = today.getFullYear(), m = today.getMonth()
  const ultimoDoMes = new Date(y, m + 1, 0).getDate()
  let alvo = new Date(y, m, Math.min(dia, ultimoDoMes))
  if (alvo < today) {
    const proxUltimo = new Date(y, m + 2, 0).getDate()
    alvo = new Date(y, m + 1, Math.min(dia, proxUltimo))
  }
  return Math.round((alvo.getTime() - today.getTime()) / 86_400_000)
}

export const STATUS: Record<number, { label: string; tone: "soft" | "warning" | "success" | "neutral" }> = {
  1: { label: "Aberta", tone: "soft" },
  2: { label: "Fechada", tone: "warning" },
  3: { label: "Paga", tone: "success" },
  4: { label: "Futura", tone: "neutral" },
}
// "Paga" só quando a fatura FECHOU e não há saldo restante. Enquanto aberta,
// permanece "Aberta" mesmo com pagamento parcial/antecipado — novas compras
// ainda podem entrar no ciclo. Fechada com saldo restante → "Fechada" (a pagar).
// "Futura": ciclo ainda nem começou (dataInicio > hoje). Bancos reais (Nubank,
// Itaú, Bradesco) NÃO permitem pagar fatura futura inteira — só antecipar
// parcelas individuais (não implementado). Bloqueio do botão Pagar.
export const statusKey = (f: Fatura, now: number) => {
  if (f.estadoCiclo === 1) return f.valorRestante <= 0 ? 3 : 2
  return new Date(f.dataInicio).getTime() > now ? 4 : 1
}

// Clampa input de dia em [1..31] enquanto digita — `<input max=31>` deixa
// digitar 99; melhor capar no onChange pra não confundir o usuário.
export const clampDia = (raw: string): number | undefined => {
  if (!raw) return undefined
  const n = Number(raw)
  if (!Number.isFinite(n)) return undefined
  return Math.max(1, Math.min(31, Math.trunc(n)))
}
