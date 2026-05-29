/**
 * StatCard — KPI card com label + valor + tendência. Cor via var(--pontes-*).
 * `p`/`font` são override de tema escopado opcional (transição #122).
 * `tone` colora o `value` (default | success | danger | warning).
 * `hint` aceita uso standalone (sem trend) — descrição abaixo do valor.
 */

import { type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./StatCard.module.css"

export type PontesStatCardTone = "default" | "success" | "danger" | "warning"

export type PontesStatCardProps = {
  p?: Palette
  font?: string
  label: string
  value: string
  trend?: string
  /** true = subida verde, false = descida vermelha. */
  trendUp?: boolean
  hint?: string
  /** Colora o `value`. Default = cor do texto principal. */
  tone?: PontesStatCardTone
}

export function PontesStatCard({
  p, font, label, value, trend, trendUp, hint, tone = "default",
}: PontesStatCardProps) {
  return (
    <div className={styles.card} style={scopedThemeVars(p, font) as CSSProperties}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value} data-tone={tone}>{value}</div>
      {trend ? (
        <div className={styles.trend} data-up={trendUp ? "true" : "false"}>
          {trendUp ? "↑" : "↓"} {trend} {hint ?? "vs mês anterior"}
        </div>
      ) : hint ? (
        <div className={styles.hint}>{hint}</div>
      ) : null}
    </div>
  )
}
