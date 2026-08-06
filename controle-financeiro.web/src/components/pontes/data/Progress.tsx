/**
 * Progress — barra horizontal de progresso. Cor via var(--pontes-*).
 * `color` (override por-instância) e `height` ficam inline. `p`/`font` escopado.
 */

import { type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Progress.module.css"

export type PontesProgressSegment = {
  /** 0..100 — proporção desse segmento na barra. */
  value: number
  color: string
  /** Descrição do segmento (tooltip via title). */
  label?: string
}

export type PontesProgressProps = {
  p?: Palette
  font?: string
  label?: string
  /** 0..100. Ignorado se `segments` for informado. */
  value?: number
  /** Cor da barra (default var(--pontes-primary)). Ignorado se `segments` for informado. */
  color?: string
  /** Mostra "X%" no fim do label. Ignorado se `segments` for informado (soma pode não ser 100%). */
  showValue?: boolean
  height?: number
  /** Barra empilhada com N cores (ex.: confirmado/pendente/recusado) — cada item é uma fatia. */
  segments?: PontesProgressSegment[]
}

export function PontesProgress({
  p, font, label, value, color, showValue = true, height = 8, segments,
}: PontesProgressProps) {
  const v = Math.max(0, Math.min(100, value ?? 0))

  return (
    <div className={styles.wrap} style={scopedThemeVars(p, font) as CSSProperties}>
      {(label || (showValue && !segments)) && (
        <div className={styles.head}>
          {label && <span className={styles.label}>{label}</span>}
          {showValue && !segments && <span className={styles.value}>{Math.round(v)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(segments ? segments.reduce((sum, s) => sum + s.value, 0) : v)}
        aria-valuemin={0}
        aria-valuemax={100}
        className={styles.track}
        style={{ height, borderRadius: height / 2 }}
      >
        {segments ? (
          <div className={styles.segments}>
            {segments.filter((s) => s.value > 0).map((s, i) => (
              <div
                key={i}
                title={s.label}
                className={styles.segment}
                style={{ width: `${Math.max(0, Math.min(100, s.value))}%`, background: s.color }}
              />
            ))}
          </div>
        ) : (
          <div
            className={styles.bar}
            style={{ width: `${v}%`, borderRadius: height / 2, background: color || undefined }}
          />
        )}
      </div>
    </div>
  )
}
