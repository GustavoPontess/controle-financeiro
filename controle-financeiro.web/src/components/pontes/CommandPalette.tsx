/**
 * CommandPalette — Cmd+K search overlay.
 * Visual: input no topo + lista de results.
 * Hospede o open state externamente (atalho de teclado etc).
 */

import { useEffect, type ReactNode } from "react"
import type { Palette } from "./theme"

export type PontesCommandItem = {
  key: string
  icon?: ReactNode
  label: ReactNode
  hint?: string
  onSelect: () => void
}

export type PontesCommandPaletteProps = {
  p: Palette
  font: string
  open: boolean
  onClose: () => void
  query: string
  onQueryChange: (q: string) => void
  items: PontesCommandItem[]
  /** Index do item destacado (default 0). */
  activeIndex?: number
}

export function PontesCommandPalette({
  p, font, open, onClose, query, onQueryChange, items, activeIndex = 0,
}: PontesCommandPaletteProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(11,18,32,0.5)",
        zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: 120,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14,
          padding: 0, maxWidth: 540, width: "90%",
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
          overflow: "hidden", fontFamily: font,
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 18px", borderBottom: `1px solid ${p.border}`,
        }}>
          <span style={{ color: p.textMuted, fontSize: 16 }}>🔍</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            style={{
              flex: 1, border: "none", background: "transparent",
              fontSize: 15, fontFamily: font, color: p.text, outline: "none",
            }}
            placeholder="Buscar..."
          />
          <span style={{ fontSize: 11, color: p.textMuted, background: p.bg, padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>ESC</span>
        </div>
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {items.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: p.textMuted, fontSize: 14 }}>
              Nenhum resultado
            </div>
          ) : items.map((it, i) => (
            <button
              key={it.key}
              type="button"
              onClick={() => { it.onSelect(); onClose() }}
              style={{
                width: "100%", textAlign: "left", border: "none",
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 18px", cursor: "pointer", fontFamily: font,
                background: i === activeIndex ? p.primarySoft : "transparent",
              }}
            >
              {it.icon && <span style={{ fontSize: 18 }}>{it.icon}</span>}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: p.text, fontWeight: 600 }}>{it.label}</div>
                {it.hint && <div style={{ fontSize: 11, color: p.textMuted }}>{it.hint}</div>}
              </div>
              {i === activeIndex && (
                <span style={{
                  fontSize: 11, color: p.textMuted, background: p.surface,
                  padding: "2px 8px", borderRadius: 6, fontWeight: 600,
                  border: `1px solid ${p.border}`,
                }}>⏎</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
