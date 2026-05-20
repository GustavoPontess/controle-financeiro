/**
 * Toast — notificação flutuante.
 * Não inclui sistema de fila/posicionamento global — apenas o visual.
 * Use com biblioteca externa de manager (ex: react-hot-toast) ou compose.
 */

import { semantic, type Palette } from "./theme"

export type PontesToastTone = "info" | "success" | "warning" | "error"

export type PontesToastProps = {
  p: Palette
  font: string
  tone?: PontesToastTone
  title: string
  description?: string
  time?: string
  icon?: React.ReactNode
  onClose?: () => void
}

const TONE_ICON: Record<PontesToastTone, { color: string; defaultIcon: string }> = {
  info: { color: "", defaultIcon: "ℹ" },
  success: { color: semantic.success, defaultIcon: "✓" },
  warning: { color: semantic.warning, defaultIcon: "⚠" },
  error: { color: semantic.danger, defaultIcon: "✕" },
}

export function PontesToast({
  p, font, tone = "info", title, description, time, icon, onClose,
}: PontesToastProps) {
  const conf = tone === "info"
    ? { color: p.primary, defaultIcon: "ℹ" }
    : TONE_ICON[tone]

  return (
    <div style={{
      background: p.surface, border: `1px solid ${p.border}`,
      borderRadius: 12, padding: "12px 14px",
      display: "flex", alignItems: "center", gap: 12,
      boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
      fontFamily: font, minWidth: 320,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: conf.color, color: "#FFFFFF",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
      }}>{icon ?? conf.defaultIcon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>{title}</div>
        {description && <div style={{ fontSize: 11, color: p.textMuted }}>{description}</div>}
      </div>
      {time && <div style={{ fontSize: 11, color: p.textMuted }}>{time}</div>}
      {onClose && (
        <button
          type="button" onClick={onClose}
          style={{ background: "transparent", border: "none", color: p.textMuted, cursor: "pointer", fontSize: 16 }}
          aria-label="Fechar"
        >×</button>
      )}
    </div>
  )
}
