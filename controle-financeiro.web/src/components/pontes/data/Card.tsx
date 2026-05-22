/**
 * Card — surface básica com border + padding + radius.
 * Usada como container de outros componentes.
 */

import { useState, type ReactNode } from "react"
import { shadows, type Palette } from "../theme"

export type PontesCardProps = {
  p: Palette
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
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={className}
      onMouseEnter={hover ? () => setHovered(true) : undefined}
      onMouseLeave={hover ? () => setHovered(false) : undefined}
      style={{
        background: p.surface,
        border: `1px ${dashed ? "dashed" : "solid"} ${p.border}`,
        borderRadius: radius,
        padding,
        boxShadow: hover && hovered ? shadows.lg : shadowMap[shadow],
        transform: hover && hovered ? "translateY(-2px)" : "translateY(0)",
        transition: hover ? "transform 200ms cubic-bezier(0.4,0,0.2,1), box-shadow 200ms ease" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
