/**
 * Badge / Chip — etiqueta de status pequena.
 *
 * Tons:
 *  - primary  → background = palette.primary
 *  - accent   → background = palette.accent
 *  - soft     → background = palette.primarySoft
 *  - success / warning / danger / neutral  → cores semânticas fixas
 *  - outline  → transparente com borda
 */

import { semantic, type Palette } from "../theme"

export type PontesBadgeTone =
  | "primary" | "accent" | "soft" | "success" | "warning" | "danger" | "neutral" | "outline"

export type PontesBadgeProps = {
  p: Palette
  font: string
  tone?: PontesBadgeTone
  children: React.ReactNode
  size?: "sm" | "md"
}

export function PontesBadge({ p, font, tone = "primary", size = "md", children }: PontesBadgeProps) {
  const sizes = size === "sm"
    ? { padding: "2px 8px", fontSize: 11 }
    : { padding: "4px 12px", fontSize: 12 }

  let s: React.CSSProperties = {}
  if (tone === "primary") s = { background: p.primary, color: p.heroFg }
  if (tone === "accent") s = { background: p.accent, color: "#0B1220" }
  if (tone === "soft") s = { background: p.primarySoft, color: p.primary }
  if (tone === "success") s = { background: semantic.successSoft, color: "#065F46" }
  if (tone === "warning") s = { background: semantic.warningSoft, color: "#92400E" }
  if (tone === "danger") s = { background: semantic.dangerSoft, color: "#991B1B" }
  if (tone === "neutral") s = { background: p.bg, color: p.textMuted, border: `1px solid ${p.border}` }
  if (tone === "outline") s = { background: "transparent", color: p.textMuted, border: `1px solid ${p.border}` }

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      borderRadius: 999, fontWeight: 600, fontFamily: font,
      ...sizes, ...s,
    }}>
      {children}
    </span>
  )
}
