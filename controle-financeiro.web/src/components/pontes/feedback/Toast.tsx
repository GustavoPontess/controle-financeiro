/**
 * Toast — notificação flutuante.
 * Não inclui sistema de fila/posicionamento global — apenas o visual.
 *
 * IMPORTANTE: cores são FIXAS (semantic), NÃO mudam com paleta.
 * Toast é padrão universal — vermelho = erro, verde = sucesso, sempre.
 * Só `font` muda com personalização.
 */

import { semantic } from "../theme"

export type PontesToastTone = "info" | "success" | "warning" | "error"

export type PontesToastProps = {
  font: string
  tone?: PontesToastTone
  title: string
  description?: string
  time?: string
  icon?: React.ReactNode
  onClose?: () => void
  /** @deprecated mantido pra retrocompat — Toast ignora paleta. */
  p?: unknown
}

const TONE_ICON: Record<PontesToastTone, { color: string; defaultIcon: string }> = {
  info: { color: semantic.info, defaultIcon: "ℹ" },
  success: { color: semantic.success, defaultIcon: "✓" },
  warning: { color: semantic.warning, defaultIcon: "⚠" },
  error: { color: semantic.danger, defaultIcon: "✕" },
}

// Tokens visuais fixos (não trocam com paleta).
const TOAST_BG = "#FFFFFF"
const TOAST_BORDER = "#E5EAF2"
const TOAST_TEXT = "#0B1220"
const TOAST_MUTED = "#64748B"

export function PontesToast({
  font, tone = "info", title, description, time, icon, onClose,
}: PontesToastProps) {
  const conf = TONE_ICON[tone]

  return (
    <div style={{
      background: TOAST_BG, border: `1px solid ${TOAST_BORDER}`,
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
        <div style={{ fontSize: 13, fontWeight: 700, color: TOAST_TEXT }}>{title}</div>
        {description && <div style={{ fontSize: 11, color: TOAST_MUTED }}>{description}</div>}
      </div>
      {time && <div style={{ fontSize: 11, color: TOAST_MUTED }}>{time}</div>}
      {onClose && (
        <button
          type="button" onClick={onClose}
          style={{ background: "transparent", border: "none", color: TOAST_MUTED, cursor: "pointer", fontSize: 16 }}
          aria-label="Fechar"
        >×</button>
      )}
    </div>
  )
}
