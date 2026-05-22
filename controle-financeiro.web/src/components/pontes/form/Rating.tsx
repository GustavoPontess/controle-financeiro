/**
 * Rating — estrelas (1..5 default). Cor via var(--pontes-accent) (CSS).
 * `p`/`font` override escopado opcional (#122).
 */

import { type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Rating.module.css"

export type PontesRatingProps = {
  p?: Palette
  font?: string
  value: number
  onChange?: (v: number) => void
  max?: number
  readOnly?: boolean
  showLabel?: boolean
}

export function PontesRating({
  p, font, value, onChange, max = 5, readOnly, showLabel = true,
}: PontesRatingProps) {
  const stars = Array.from({ length: max }, (_, i) => i + 1)
  return (
    <div className={styles.wrap} style={scopedThemeVars(p, font) as CSSProperties}>
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={styles.star}
          data-filled={n <= value ? "true" : undefined}
          aria-label={`${n} estrelas`}
        >
          <svg width={28} height={28} viewBox="0 0 24 24" strokeWidth="2">
            <path d="M12 2 L15 9 L22 9 L17 14 L19 22 L12 18 L5 22 L7 14 L2 9 L9 9 Z" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
      {showLabel && <span className={styles.label}>{value.toFixed(1)} de {max}</span>}
    </div>
  )
}
