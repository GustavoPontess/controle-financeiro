/**
 * Modal & Dialog — overlays centrais. Cor via var(--pontes-*).
 * `p`/`font` override escopado opcional (#122) aplicado na caixa.
 */

import { useEffect, type ReactNode, type CSSProperties } from "react"
import { PontesButton } from "../buttons/Button"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Modal.module.css"

// =============================================================================
// PontesModal
// =============================================================================

export type PontesModalProps = {
  p?: Palette
  font?: string
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
    <div onClick={onClose} className={styles.overlay}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={styles.box}
        style={{ maxWidth, ...scopedThemeVars(p, font) } as CSSProperties}
      >
        {(title || header) && (
          <div className={styles.header}>
            <div className={styles.title}>{title ?? header}</div>
            <button type="button" onClick={onClose} className={styles.close} aria-label="Fechar">×</button>
          </div>
        )}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  )
}

// =============================================================================
// PontesDialog (confirmação)
// =============================================================================

export type PontesDialogTone = "danger" | "warning" | "info"

export type PontesDialogProps = {
  p?: Palette
  font?: string
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
  const icon = tone === "info" ? "ℹ" : "⚠"

  return (
    <div onClick={onCancel} className={styles.overlay}>
      <div onClick={(e) => e.stopPropagation()} className={styles.dialogBox} style={scopedThemeVars(p, font) as CSSProperties}>
        <div className={styles.dialogIcon} data-tone={tone}>{icon}</div>
        <div className={styles.dialogTitle}>{title}</div>
        {description && <div className={styles.dialogDesc}>{description}</div>}
        <div className={styles.dialogActions}>
          <PontesButton variant="outline" fullWidth onClick={onCancel}>{cancelLabel}</PontesButton>
          <PontesButton variant={tone === "danger" ? "danger" : "primary"} fullWidth onClick={onConfirm}>
            {confirmLabel}
          </PontesButton>
        </div>
      </div>
    </div>
  )
}
