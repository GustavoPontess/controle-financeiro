/**
 * Slider — range slider single thumb.
 */

import { type ChangeEvent } from "react"
import type { Palette } from "./theme"

export type PontesSliderProps = {
  p: Palette
  font: string
  label?: string
  min?: number
  max?: number
  step?: number
  value: number
  onChange: (v: number) => void
  formatValue?: (v: number) => string
}

export function PontesSlider({
  p, font, label, min = 0, max = 100, step = 1, value, onChange, formatValue,
}: PontesSliderProps) {
  const percent = ((value - min) / (max - min)) * 100
  const display = formatValue ? formatValue(value) : String(value)

  return (
    <div style={{
      background: p.surface, border: `1px solid ${p.border}`,
      borderRadius: 12, padding: 20, maxWidth: 480, fontFamily: font,
    }}>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, fontSize: 13 }}>
          <span style={{ color: p.textMuted }}>{label}</span>
          <span style={{ color: p.text, fontWeight: 700 }}>{display}</span>
        </div>
      )}
      <div style={{ position: "relative", height: 24, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 6, background: p.bg, borderRadius: 999 }} />
        <div style={{
          position: "absolute", left: 0, width: `${percent}%`, height: 6,
          background: p.primary, borderRadius: 999,
        }} />
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            opacity: 0, cursor: "grab", margin: 0,
          }}
        />
        <div style={{
          position: "absolute", left: `${percent}%`, transform: "translateX(-50%)",
          width: 22, height: 22, background: "#FFFFFF",
          border: `2px solid ${p.primary}`, borderRadius: "50%",
          boxShadow: `0 4px 12px ${p.primary}44`, pointerEvents: "none",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: p.textMuted }}>
        <span>{formatValue ? formatValue(min) : min}</span>
        <span>{formatValue ? formatValue(max) : max}</span>
      </div>
    </div>
  )
}
