/**
 * StatCard — KPI card com label + valor + tendência. Cor via var(--pontes-*).
 * `p`/`font` são override de tema escopado opcional (transição #122).
 */

import { type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./StatCard.module.css"

export type PontesStatCardProps = {
  p?: Palette
  font?: string
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
    <div className={styles.card} style={scopedThemeVars(p, font) as CSSProperties}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{value}</div>
      {trend && (
        <div className={styles.trend} data-up={trendUp ? "true" : "false"}>
          {trendUp ? "↑" : "↓"} {trend} {hint}
        </div>
      )}
    </div>
  )
}
