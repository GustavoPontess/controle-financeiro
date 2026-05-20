/**
 * Drawer — painel lateral deslizante.
 * Lado right (default) ou left. Cobre toda altura.
 */

import { useEffect, type ReactNode } from "react"
import type { Palette } from "./theme"

export type PontesDrawerProps = {
  p: Palette
  font: string
  open: boolean
  side?: "left" | "right"
  width?: number
  title?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function PontesDrawer({
  p, font, open, side = "right", width = 380, title, onClose, children, footer,
}: PontesDrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(11,18,32,0.55)",
          zIndex: 9998, opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
          transition: "opacity 200ms ease",
        }}
      />
      {/* Panel */}
      <aside
        style={{
          position: "fixed", top: 0, bottom: 0,
          [side]: 0, width, zIndex: 9999,
          background: p.surface,
          borderLeft: side === "right" ? `1px solid ${p.border}` : undefined,
          borderRight: side === "left" ? `1px solid ${p.border}` : undefined,
          boxShadow: side === "right"
            ? "-12px 0 28px rgba(0,0,0,0.12)"
            : "12px 0 28px rgba(0,0,0,0.12)",
          transform: open
            ? "translateX(0)"
            : `translateX(${side === "right" ? "100%" : "-100%"})`,
          transition: "transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          fontFamily: font, display: "flex", flexDirection: "column",
        }}
      >
        <div style={{
          padding: "18px 24px", borderBottom: `1px solid ${p.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: p.text }}>{title}</div>
          <button
            type="button" onClick={onClose}
            style={{ background: "transparent", border: "none", color: p.textMuted, fontSize: 18, cursor: "pointer" }}
            aria-label="Fechar"
          >×</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>{children}</div>
        {footer && (
          <div style={{
            padding: "16px 24px", borderTop: `1px solid ${p.border}`,
            background: p.bg,
          }}>{footer}</div>
        )}
      </aside>
    </>
  )
}
