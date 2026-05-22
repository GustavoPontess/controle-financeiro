/**
 * Badge / Chip — etiqueta de status pequena. Cor via var(--pontes-*).
 * `p`/`font` são override de tema escopado opcional (transição #122).
 */

import { type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Badge.module.css"

export type PontesBadgeTone =
  | "primary" | "accent" | "soft" | "success" | "warning" | "danger" | "neutral" | "outline"

export type PontesBadgeProps = {
  p?: Palette
  font?: string
  tone?: PontesBadgeTone
  children: React.ReactNode
  size?: "sm" | "md"
}

export function PontesBadge({ p, font, tone = "primary", size = "md", children }: PontesBadgeProps) {
  return (
    <span
      className={styles.badge}
      data-tone={tone}
      data-size={size}
      style={scopedThemeVars(p, font) as CSSProperties}
    >
      {children}
    </span>
  )
}
