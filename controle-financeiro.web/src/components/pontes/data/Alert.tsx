/**
 * Alert — banner inline (info/success/warning/error).
 *
 * IMPORTANTE: cores FIXAS (semânticas), NÃO mudam com paleta. Só `font` muda.
 */

import { type CSSProperties } from "react"
import { scopedThemeVars } from "../theme"
import styles from "./Alert.module.css"

export type PontesAlertTone = "info" | "success" | "warning" | "error"

export type PontesAlertProps = {
  font?: string
  tone?: PontesAlertTone
  title?: string
  children: React.ReactNode
  icon?: React.ReactNode
  onClose?: () => void
  /** @deprecated mantido pra retrocompat — Alert ignora paleta. */
  p?: unknown
}

const DEFAULT_ICON: Record<PontesAlertTone, string> = {
  info: "ℹ", success: "✓", warning: "⚠", error: "✕",
}

export function PontesAlert({
  font, tone = "info", title, children, icon, onClose,
}: PontesAlertProps) {
  return (
    <div className={styles.alert} data-tone={tone} style={scopedThemeVars(undefined, font) as CSSProperties}>
      <span className={styles.icon}>{icon ?? DEFAULT_ICON[tone]}</span>
      <div className={styles.body}>
        {title && <strong>{title}: </strong>}{children}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} className={styles.close} aria-label="Fechar">×</button>
      )}
    </div>
  )
}
