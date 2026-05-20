/**
 * Rating — estrelas (1..5 default).
 */

import type { Palette } from "./theme"

export type PontesRatingProps = {
  p: Palette
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
    <div style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          style={{ background: "transparent", border: "none", cursor: readOnly ? "default" : "pointer", padding: 4 }}
          aria-label={`${n} estrelas`}
        >
          <svg width={28} height={28} viewBox="0 0 24 24"
            fill={n <= value ? p.accent : "none"} stroke={p.accent} strokeWidth="2">
            <path d="M12 2 L15 9 L22 9 L17 14 L19 22 L12 18 L5 22 L7 14 L2 9 L9 9 Z" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
      {showLabel && (
        <span style={{ marginLeft: 10, fontSize: 14, color: p.text, fontWeight: 600, fontFamily: font }}>
          {value.toFixed(1)} de {max}
        </span>
      )}
    </div>
  )
}
