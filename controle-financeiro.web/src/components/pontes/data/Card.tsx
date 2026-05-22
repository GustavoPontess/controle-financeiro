/**
 * Card — surface básica com border + padding + radius.
 * Cor via var(--pontes-*) (Card.module.css). Hover é CSS puro (sem estado JS).
 * `p` é override de tema escopado opcional (transição #122).
 */

import { type ReactNode, type CSSProperties } from "react"
import { shadows, scopedThemeVars, type Palette } from "../theme"
import styles from "./Card.module.css"

export type PontesCardProps = {
  p?: Palette
  children: ReactNode
  padding?: number
  radius?: number
  shadow?: "none" | "sm" | "md" | "lg" | "xl"
  /** Se true: borda tracejada (empty state, drop zone). */
  dashed?: boolean
  /** Se true: sobe 2px + sombra ao passar o mouse. */
  hover?: boolean
  className?: string
  style?: React.CSSProperties
}

export function PontesCard({
  p, children, padding = 20, radius = 14, shadow = "none", dashed, hover, className, style,
}: PontesCardProps) {
  const shadowMap = {
    none: "none", sm: shadows.sm, md: shadows.md, lg: shadows.lg, xl: shadows.xl,
  } as const

  return (
    <div
      className={[styles.card, className].filter(Boolean).join(" ")}
      data-dashed={dashed ? "true" : undefined}
      data-hover={hover ? "true" : undefined}
      style={{
        ...scopedThemeVars(p),
        borderRadius: radius,
        padding,
        boxShadow: shadowMap[shadow],
        ...style,
      } as CSSProperties}
    >
      {children}
    </div>
  )
}
