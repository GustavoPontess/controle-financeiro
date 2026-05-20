/**
 * StatCard — KPI card com label + valor + tendência.
 */

import type { Palette } from "./theme"

export type PontesStatCardProps = {
  p: Palette
  font: string
  label: string
  value: string
  trend?: string
  /** true = subida verde, false = descida vermelha. */
  trendUp?: boolean
  hint?: string
}

export function PontesStatCard({
  p, font, label, value, trend, trendUp, hint = "vs mês anterior",
}: PontesStatCardProps) {
  return (
    <div style={{
      background: p.surface, border: `1px solid ${p.border}`,
      borderRadius: 12, padding: 16, fontFamily: font,
    }}>
      <div style={{
        fontSize: 11, color: p.textMuted, fontWeight: 600,
        letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase",
      }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 800, color: p.text,
        letterSpacing: "-0.02em", marginBottom: 6,
      }}>{value}</div>
      {trend && (
        <div style={{
          fontSize: 12, fontWeight: 600,
          color: trendUp ? "#16A34A" : "#DC2626",
        }}>
          {trendUp ? "↑" : "↓"} {trend} {hint}
        </div>
      )}
    </div>
  )
}
