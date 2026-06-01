/**
 * PontesSensitiveValue / PontesHideBalanceToggle — privacy toggle (ocultar saldo).
 *
 * Estado global em ./useHideBalance (store + localStorage, sem provider).
 * Padrão inspirado em Despezzas/Monarch (olho de ocultar saldo).
 *
 * Uso:
 *   <PontesSensitiveValue mask="R$ ••••">{formatMoney(saldo)}</PontesSensitiveValue>
 *   <PontesHideBalanceToggle />   // botão olho em qualquer lugar
 */

import { type ReactNode } from "react"
import { Eye, EyeOff } from "lucide-react"
import { useHideBalance } from "./useHideBalance"
import styles from "./SensitiveValue.module.css"

export interface PontesSensitiveValueProps {
  children: ReactNode
  /** Texto exibido quando oculto. Default "••••••". */
  mask?: string
  className?: string
}

/** Mostra o valor ou a máscara, conforme o estado global de ocultar. */
export function PontesSensitiveValue({ children, mask = "••••••", className }: PontesSensitiveValueProps) {
  const [hide] = useHideBalance()
  return <span className={className}>{hide ? mask : children}</span>
}

export interface PontesHideBalanceToggleProps {
  size?: number
  className?: string
}

/** Botão olho que alterna o estado global de ocultar valores. */
export function PontesHideBalanceToggle({ size = 16, className }: PontesHideBalanceToggleProps) {
  const [hide, toggle] = useHideBalance()
  return (
    <button
      type="button"
      onClick={toggle}
      className={[styles.toggle, "pontes-clickable", className].filter(Boolean).join(" ")}
      aria-label={hide ? "Mostrar valores" : "Ocultar valores"}
      aria-pressed={hide}
      title={hide ? "Mostrar valores" : "Ocultar valores"}
    >
      {hide ? <EyeOff size={size} strokeWidth={2.5} /> : <Eye size={size} strokeWidth={2.5} />}
    </button>
  )
}
