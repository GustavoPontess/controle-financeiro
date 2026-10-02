/**
 * Formatação de dinheiro (BRL) com suporte ao olho global de "ocultar saldo".
 *
 * `formatMoney` é a fonte ÚNICA de formatação monetária do app (antes cada página
 * tinha a sua cópia). Quando o olho global está ativo (useHideBalance), mascara
 * o valor — assim ocultar saldo vale em QUALQUER tela automaticamente.
 *
 * Reatividade: a leitura do estado é por chamada. Componentes que precisam
 * mascarar AO VIVO quando o usuário clica o olho (ex.: telas que têm o botão)
 * devem assinar o store chamando `useHideBalance()` no corpo (força re-render).
 * Telas sem o botão mascaram corretamente ao montar/navegar.
 */

import { isBalanceHidden } from "@/components/pontes"

/** Máscara exibida no lugar de um valor monetário oculto. */
export const MONEY_MASK = "R$ ••••"

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

/** Formata um número como BRL, mascarando quando o olho global está ativo. */
export function formatMoney(value: number): string {
  return isBalanceHidden() ? MONEY_MASK : BRL.format(value)
}

/** Texto de campo pt-BR ("1.234,56") → número. Vazio/ inválido vira 0. */
export function parseMoney(texto: string): number {
  return Number(texto.replace(/\./g, "").replace(",", ".")) || 0
}

/** Máscara de digitação pt-BR: só dígitos, lidos como centavos ("394420" → "3.944,20"). */
export function maskMoney(raw: string): string {
  const d = raw.replace(/\D/g, "")
  return d ? (Number(d) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""
}

/** Número → texto de campo pt-BR sem símbolo (2500 → "2.500,00"), pra pré-preencher um input. */
export function moneyParaCampo(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
