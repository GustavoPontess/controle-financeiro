/**
 * Modal & Dialog — overlays centrais.
 *
 * PontesModal: caixa de conteúdo livre com header/footer opcionais.
 * PontesDialog: variante de confirmação (ícone + título + msg + botões).
 */

import { useEffect, type ReactNode } from "react"
import { PontesButton } from "./Button"
import { semantic, type Palette } from "./theme"

// =============================================================================
// PontesModal
// =============================================================================

export type PontesModalProps = {
  p: Palette
  font: string
  open: boolean
  title?: string
  onClose: () => void
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  maxWidth?: number
}

export function PontesModal({
  p, font, open, title, onClose, header, footer, children, maxWidth = 480,
}: PontesModalProps) {
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
        position: "fixed", inset: 0, background: "rgba(11,18,32,0.6)",
        zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: p.surface, borderRadius: 18, padding: 0,
          maxWidth, width: "90%",
          boxShadow: "0 30px 80px rgba(0,0,0,0.4)",
          fontFamily: font, overflow: "hidden",
        }}
      >
        {(title || header) && (
          <div style={{
            padding: "20px 24px", borderBottom: `1px solid ${p.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: p.text }}>{title ?? header}</div>
            <button
              type="button" onClick={onClose}
              style={{ background: "transparent", border: "none", fontSize: 20, color: p.textMuted, cursor: "pointer" }}
              aria-label="Fechar"
            >×</button>
          </div>
        )}
        <div style={{ padding: 24 }}>{children}</div>
        {footer && (
          <div style={{
            padding: "16px 24px", background: p.bg,
            display: "flex", justifyContent: "flex-end", gap: 10,
            borderTop: `1px solid ${p.border}`,
          }}>{footer}</div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// PontesDialog (confirmação)
// =============================================================================

export type PontesDialogTone = "danger" | "warning" | "info"

export type PontesDialogProps = {
  p: Palette
  font: string
  open: boolean
  title: string
  description?: string
  tone?: PontesDialogTone
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function PontesDialog({
  p, font, open, title, description, tone = "danger",
  confirmLabel = "Confirmar", cancelLabel = "Cancelar",
  onConfirm, onCancel,
}: PontesDialogProps) {
  if (!open) return null

  const conf = tone === "danger"
    ? { bg: semantic.dangerSoft, fg: semantic.danger, icon: "⚠" }
    : tone === "warning"
    ? { bg: semantic.warningSoft, fg: semantic.warning, icon: "⚠" }
    : { bg: p.primarySoft, fg: p.primary, icon: "ℹ" }

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, background: "rgba(11,18,32,0.6)",
        zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: p.surface, borderRadius: 18, padding: 28,
          maxWidth: 400, width: "90%",
          boxShadow: "0 30px 80px rgba(0,0,0,0.4)",
          fontFamily: font, textAlign: "center",
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: conf.bg, color: conf.fg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, margin: "0 auto 16px",
        }}>{conf.icon}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: p.text, marginBottom: 8 }}>{title}</div>
        {description && (
          <div style={{ fontSize: 14, color: p.textMuted, lineHeight: 1.5, marginBottom: 24 }}>
            {description}
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <PontesButton p={p} font={font} variant="outline" fullWidth onClick={onCancel}>
            {cancelLabel}
          </PontesButton>
          <PontesButton
            p={p} font={font}
            variant={tone === "danger" ? "danger" : "primary"}
            fullWidth onClick={onConfirm}
          >
            {confirmLabel}
          </PontesButton>
        </div>
      </div>
    </div>
  )
}
