/**
 * Stepper — wizard de passos horizontal. Cor via var(--pontes-*).
 * `p`/`font` override escopado opcional (#122).
 */

import { type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Stepper.module.css"

export type PontesStep = {
  label: string
  /** "done" se já completou, "current" se em andamento, undefined se futuro. */
  status?: "done" | "current"
}

export type PontesStepperProps = {
  p?: Palette
  font?: string
  steps: PontesStep[]
  /** Largura mínima de cada step (default 90). */
  minStepWidth?: number
}

export function PontesStepper({ p, font, steps, minStepWidth = 90 }: PontesStepperProps) {
  return (
    <div className={styles.wrap} style={scopedThemeVars(p, font) as CSSProperties}>
      {steps.map((s, i, arr) => (
        <div key={s.label} className={styles.step} style={{ flex: i < arr.length - 1 ? 1 : 0 }}>
          <div className={styles.stepInner} style={{ minWidth: minStepWidth }}>
            <div className={styles.circle} data-status={s.status}>
              {s.status === "done" ? "✓" : i + 1}
            </div>
            <div className={styles.label} data-active={s.status ? "true" : undefined}>{s.label}</div>
          </div>
          {i < arr.length - 1 && (
            <div className={styles.line} data-done={s.status === "done" ? "true" : undefined} />
          )}
        </div>
      ))}
    </div>
  )
}
