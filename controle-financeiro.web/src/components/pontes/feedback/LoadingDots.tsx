/**
 * LoadingDots — 3 pontinhos pulsando. Cor via var(--pontes-primary).
 * `color`/`size`/`gap` por-instância (inline). `p` override escopado opcional (#122).
 */

import { type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./LoadingDots.module.css"

export type PontesLoadingDotsProps = {
  p?: Palette
  color?: string
  size?: number
  gap?: number
}

export function PontesLoadingDots({ p, color, size = 10, gap = 6 }: PontesLoadingDotsProps) {
  return (
    <span className={styles.wrap} style={{ gap, ...scopedThemeVars(p) } as CSSProperties}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={styles.dot}
          style={{ width: size, height: size, background: color || undefined, animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </span>
  )
}
