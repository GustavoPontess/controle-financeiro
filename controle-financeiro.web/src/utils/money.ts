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
