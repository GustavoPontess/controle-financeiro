/**
 * Alert — banner inline (info/success/warning/error).
 * Renderiza ícone + título strong + corpo.
 */

import { semantic, type Palette } from "./theme"

export type PontesAlertTone = "info" | "success" | "warning" | "error"

export type PontesAlertProps = {
  p: Palette
  font: string
  tone?: PontesAlertTone
  title?: string
  children: React.ReactNode
  icon?: React.ReactNode
  onClose?: () => void
}

const TONE_MAP: Record<PontesAlertTone, { bg: string; border: string; text: string; defaultIcon: string }> = {
  info: { bg: "", border: "", text: "", defaultIcon: "ℹ" },
  success: { bg: semantic.successSoft, border: `${semantic.success}40`, text: "#065F46", defaultIcon: "✓" },
  warning: { bg: semantic.warningSoft, border: `${semantic.warning}40`, text: "#92400E", defaultIcon: "⚠" },
  error: { bg: semantic.dangerSoft, border: `${semantic.danger}40`, text: "#991B1B", defaultIcon: "✕" },
}

export function PontesAlert({
  p, font, tone = "info", title, children, icon, onClose,
}: PontesAlertProps) {
  const conf = tone === "info"
    ? { bg: p.primarySoft, border: `${p.primary}40`, text: p.text, defaultIcon: "ℹ" }
    : TONE_MAP[tone]

  return (
    <div style={{
      background: conf.bg, border: `1px solid ${conf.border}`,
      borderRadius: 10, padding: "12px 16px",
      display: "flex", alignItems: "center", gap: 12, fontFamily: font,
    }}>
      <span style={{ fontSize: 18, color: conf.text }}>{icon ?? conf.defaultIcon}</span>
      <div style={{ flex: 1, fontSize: 13, color: conf.text }}>
        {title && <strong>{title}: </strong>}{children}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{ background: "transparent", border: "none", color: conf.text, cursor: "pointer", fontSize: 16 }}
          aria-label="Fechar"
        >×</button>
      )}
    </div>
  )
}
