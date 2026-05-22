/**
 * Progress — barra horizontal de progresso.
 * Mostra label + valor opcional.
 */

import type { Palette } from "../theme"

export type PontesProgressProps = {
  p: Palette
  font?: string
  label?: string
  /** 0..100 */
  value: number
  /** Cor da barra (default p.primary). */
  color?: string
  /** Mostra "X%" no fim do label. */
  showValue?: boolean
  height?: number
}

export function PontesProgress({
  p, font, label, value, color, showValue = true, height = 8,
}: PontesProgressProps) {
  const v = Math.max(0, Math.min(100, value))
  const c = color ?? p.primary

  return (
    <div style={{ fontFamily: font }}>
      {(label || showValue) && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          {label && <span style={{ fontSize: 13, color: p.text, fontWeight: 600 }}>{label}</span>}
          {showValue && <span style={{ fontSize: 13, color: p.textMuted, fontWeight: 600 }}>{Math.round(v)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(v)}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{ height, background: p.bg, borderRadius: height / 2 }}
      >
        <div style={{ width: `${v}%`, height: "100%", background: c, borderRadius: height / 2, transition: "width 250ms ease" }} />
      </div>
    </div>
  )
}
