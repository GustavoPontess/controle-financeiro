/**
 * Popover — menu dropdown aberto por clique.
 * Lista de items com ícone opcional e variant danger.
 */

import { useEffect, useRef, useState, type ReactNode } from "react"
import { semantic, type Palette } from "../theme"

export type PontesPopoverItem = {
  key: string
  icon?: ReactNode
  label: string
  danger?: boolean
  onClick?: () => void
  /** Insere divisor antes desse item. */
  divider?: boolean
}

export type PontesPopoverProps = {
  p: Palette
  font: string
  trigger: ReactNode
  items: PontesPopoverItem[]
  minWidth?: number
  align?: "left" | "right"
  /** Direção de abertura. "up" abre acima do trigger (ex: menu no rodapé). */
  direction?: "down" | "up"
  /** Trigger ocupa 100% da largura do pai (ex: card de usuário no sidebar). */
  fullWidth?: boolean
}

export function PontesPopover({
  p, font, trigger, items, minWidth = 200, align = "left", direction = "down", fullWidth = false,
}: PontesPopoverProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  return (
    <span ref={ref} style={{ position: "relative", display: fullWidth ? "block" : "inline-block", width: fullWidth ? "100%" : undefined }}>
      <span onClick={() => setOpen(!open)} style={{ cursor: "pointer", display: fullWidth ? "block" : "inline-block", width: fullWidth ? "100%" : undefined }}>
        {trigger}
      </span>
      {open && (
        <div style={{
          position: "absolute",
          ...(direction === "up" ? { bottom: "calc(100% + 8px)" } : { top: "calc(100% + 8px)" }),
          [align]: 0,
          background: p.surface, border: `1px solid ${p.border}`,
          borderRadius: 10, boxShadow: "0 12px 28px rgba(0,0,0,0.15)",
          padding: 6, minWidth, fontFamily: font, zIndex: 100,
        }}>
          {items.map((it) => (
            <div key={it.key}>
              {it.divider && <div style={{ height: 1, background: p.border, margin: "4px 0" }} />}
              <button
                type="button"
                onClick={() => { it.onClick?.(); setOpen(false) }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = p.bg }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
                style={{
                  width: "100%", textAlign: "left",
                  background: "transparent", border: "none",
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 10px", fontSize: 13,
                  color: it.danger ? semantic.danger : p.text,
                  cursor: "pointer", borderRadius: 6, fontFamily: font,
                }}
              >
                {it.icon && <span>{it.icon}</span>}
                <span>{it.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </span>
  )
}
