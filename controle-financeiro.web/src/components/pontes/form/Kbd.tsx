/**
 * Kbd — tecla de atalho estilo teclado.
 * PontesKbd: single key. PontesKbdGroup: sequência ⌘+K.
 */

import type { Palette } from "../theme"

export type PontesKbdProps = {
  p: Palette
  children: React.ReactNode
}

export function PontesKbd({ p, children }: PontesKbdProps) {
  return (
    <kbd style={{
      display: "inline-block", padding: "3px 8px",
      background: p.surface, border: `1px solid ${p.border}`, borderBottomWidth: 2,
      borderRadius: 6, fontSize: 11, fontWeight: 700, color: p.text,
      fontFamily: "monospace", boxShadow: "0 1px 0 rgba(0,0,0,0.05)",
    }}>{children}</kbd>
  )
}

export type PontesKbdGroupProps = {
  p: Palette
  font?: string
  keys: string[]
  label?: string
}

export function PontesKbdGroup({ p, font, keys, label }: PontesKbdGroupProps) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ display: "inline-flex", gap: 3 }}>
        {keys.map((k) => <PontesKbd key={k} p={p}>{k}</PontesKbd>)}
      </span>
      {label && <span style={{ fontSize: 12, color: p.textMuted, fontFamily: font }}>{label}</span>}
    </span>
  )
}
