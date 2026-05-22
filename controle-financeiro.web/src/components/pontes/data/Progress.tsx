/**
 * Progress — barra horizontal de progresso. Cor via var(--pontes-*).
 * `color` (override por-instância) e `height` ficam inline. `p`/`font` escopado.
 */

import { type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Progress.module.css"

export type PontesProgressProps = {
  p?: Palette
  font?: string
  label?: string
  /** 0..100 */
  value: number
  /** Cor da barra (default var(--pontes-primary)). */
  color?: string
  /** Mostra "X%" no fim do label. */
  showValue?: boolean
  height?: number
}

export function PontesProgress({
  p, font, label, value, color, showValue = true, height = 8,
}: PontesProgressProps) {
  const v = Math.max(0, Math.min(100, value))

  return (
    <div className={styles.wrap} style={scopedThemeVars(p, font) as CSSProperties}>
      {(label || showValue) && (
        <div className={styles.head}>
          {label && <span className={styles.label}>{label}</span>}
          {showValue && <span className={styles.value}>{Math.round(v)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(v)}
        aria-valuemin={0}
        aria-valuemax={100}
        className={styles.track}
        style={{ height, borderRadius: height / 2 }}
      >
        <div
          className={styles.bar}
          style={{ width: `${v}%`, borderRadius: height / 2, background: color || undefined }}
        />
      </div>
    </div>
  )
}
