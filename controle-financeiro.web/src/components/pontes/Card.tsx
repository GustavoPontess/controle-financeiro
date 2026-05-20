/**
 * Card — surface básica com border + padding + radius.
 * Usada como container de outros componentes.
 */

import type { ReactNode } from "react"
import { shadows, type Palette } from "./theme"

export type PontesCardProps = {
  p: Palette
  children: ReactNode
  padding?: number
  radius?: number
  shadow?: "none" | "sm" | "md" | "lg" | "xl"
  /** Se true: borda tracejada (empty state, drop zone). */
  dashed?: boolean
  className?: string
  style?: React.CSSProperties
}

export function PontesCard({
  p, children, padding = 20, radius = 14, shadow = "none", dashed, className, style,
}: PontesCardProps) {
  const shadowMap = {
    none: "none", sm: shadows.sm, md: shadows.md, lg: shadows.lg, xl: shadows.xl,
  } as const

  return (
    <div
      className={className}
      style={{
        background: p.surface,
        border: `1px ${dashed ? "dashed" : "solid"} ${p.border}`,
        borderRadius: radius,
        padding,
        boxShadow: shadowMap[shadow],
        ...style,
      }}
    >
      {children}
    </div>
  )
}
