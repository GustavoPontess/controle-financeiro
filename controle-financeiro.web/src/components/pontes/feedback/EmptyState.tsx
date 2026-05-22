/**
 * EmptyState — caixa centralizada com ícone + título + descrição + ações.
 */

import type { ReactNode } from "react"
import type { Palette } from "../theme"

export type PontesEmptyStateProps = {
  p: Palette
  font: string
  icon?: ReactNode
  title: string
  description?: string
  actions?: ReactNode
  maxWidth?: number
}

export function PontesEmptyState({
  p, font, icon = "📭", title, description, actions, maxWidth = 480,
}: PontesEmptyStateProps) {
  return (
    <div style={{
      background: p.surface, border: `1px dashed ${p.border}`,
      borderRadius: 14, padding: 48, textAlign: "center",
      maxWidth, fontFamily: font,
    }}>
      <div style={{
        width: 72, height: 72, margin: "0 auto 16px",
        background: p.primarySoft, color: p.primary,
        borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 32,
      }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: p.text, marginBottom: 6 }}>{title}</div>
      {description && (
        <div style={{ fontSize: 13, color: p.textMuted, marginBottom: 18, lineHeight: 1.5 }}>
          {description}
        </div>
      )}
      {actions && (
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {actions}
        </div>
      )}
    </div>
  )
}
