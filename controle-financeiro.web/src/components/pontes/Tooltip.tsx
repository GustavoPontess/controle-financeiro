/**
 * Tooltip — texto curto que aparece em hover.
 * Posicionamento simples top (default) ou bottom.
 */

import { useState, type ReactNode } from "react"
import type { Palette } from "./theme"

export type PontesTooltipProps = {
  p: Palette
  font: string
  label: ReactNode
  side?: "top" | "bottom"
  children: ReactNode
}

export function PontesTooltip({ p, font, label, side = "top", children }: PontesTooltipProps) {
  const [open, setOpen] = useState(false)

  const arrowSize = 8
  const offset = 42

  return (
    <span
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span style={{
          position: "absolute",
          ...(side === "top"
            ? { top: -offset, left: "50%", transform: "translateX(-50%)" }
            : { bottom: -offset, left: "50%", transform: "translateX(-50%)" }),
          background: p.text, color: "#FFFFFF",
          padding: "6px 12px", borderRadius: 8,
          fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
          fontFamily: font, zIndex: 100,
        }}>
          {label}
          <span style={{
            position: "absolute",
            ...(side === "top" ? { bottom: -arrowSize / 2 } : { top: -arrowSize / 2 }),
            left: "50%", transform: "translateX(-50%) rotate(45deg)",
            width: arrowSize, height: arrowSize, background: p.text,
          }} />
        </span>
      )}
    </span>
  )
}
