/**
 * Toast — notificação flutuante (só visual). Cores FIXAS, imune à paleta.
 */

import { type CSSProperties } from "react"
import { scopedThemeVars } from "../theme"
import styles from "./Toast.module.css"

export type PontesToastTone = "info" | "success" | "warning" | "error"

export type PontesToastProps = {
  font?: string
  tone?: PontesToastTone
  title: string
  description?: string
  time?: string
  icon?: React.ReactNode
  onClose?: () => void
  /** @deprecated mantido pra retrocompat — Toast ignora paleta. */
  p?: unknown
}

const DEFAULT_ICON: Record<PontesToastTone, string> = {
  info: "ℹ", success: "✓", warning: "⚠", error: "✕",
}

export function PontesToast({
  font, tone = "info", title, description, time, icon, onClose,
}: PontesToastProps) {
  return (
    <div className={styles.toast} data-tone={tone} style={scopedThemeVars(undefined, font) as CSSProperties}>
      <div className={styles.icon}>{icon ?? DEFAULT_ICON[tone]}</div>
      <div className={styles.body}>
        <div className={styles.title}>{title}</div>
        {description && <div className={styles.desc}>{description}</div>}
      </div>
      {time && <div className={styles.time}>{time}</div>}
      {onClose && (
        <button type="button" onClick={onClose} className={styles.close} aria-label="Fechar">×</button>
      )}
    </div>
  )
}
