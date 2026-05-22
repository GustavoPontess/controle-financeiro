/**
 * Tooltip — texto curto em hover. Cor via var(--pontes-*).
 * `p`/`font` override escopado opcional (#122).
 */

import { useState, type ReactNode, type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Tooltip.module.css"

export type PontesTooltipProps = {
  p?: Palette
  font?: string
  label: ReactNode
  side?: "top" | "bottom"
  children: ReactNode
}

export function PontesTooltip({ p, font, label, side = "top", children }: PontesTooltipProps) {
  const [open, setOpen] = useState(false)

  return (
    <span
      className={styles.wrap}
      style={scopedThemeVars(p, font) as CSSProperties}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span className={styles.tip} data-side={side}>
          {label}
          <span className={styles.arrow} />
        </span>
      )}
    </span>
  )
}
