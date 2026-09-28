/**
 * Modal & Dialog — overlays centrais. Cor via var(--pontes-*).
 * `p`/`font` override escopado opcional (#122) aplicado na caixa.
 */

import { useEffect, useRef, type ReactNode, type CSSProperties, type RefObject } from "react"
import { X, Info, AlertTriangle } from "lucide-react"
import { PontesButton } from "../buttons/Button"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Modal.module.css"

// Foco ao abrir/fechar (padrão WAI-ARIA de diálogo): ao abrir, o foco entra no overlay; ao fechar,
// volta pra quem abriu. Sem isso o foco ficava ATRÁS do overlay — ex.: escolher "Excluir" no menu ⋮
// devolvia o foco pro ⋮, e um Enter reabria o menu por baixo da confirmação. Roda em useEffect (depois do
// foco síncrono que o menu devolve ao gatilho), então quem abriu o diálogo não precisa fazer nada.
function useFocoDoDialogo(open: boolean, alvo: RefObject<HTMLElement | null>, seletor?: string) {
  useEffect(() => {
    if (!open) return
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const el = seletor ? alvo.current?.querySelector<HTMLElement>(seletor) : alvo.current
    el?.focus()
    return () => { if (anterior?.isConnected) anterior.focus() }
  }, [open, alvo, seletor])
}

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
  const boxRef = useRef<HTMLDivElement>(null)
  useFocoDoDialogo(open, boxRef)
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
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={styles.box}
        data-pontes-overlay-boundary
        style={{ maxWidth, ...scopedThemeVars(p, font) } as CSSProperties}
      >
        {(title || header) && (
          <div className={styles.header}>
            <div className={styles.title}>{title ?? header}</div>
            <button type="button" onClick={onClose} className={styles.close} aria-label="Fechar">
              <X size={18} strokeWidth={2.5} />
            </button>
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
  // Foco no CANCELAR (1º botão das ações), nunca no confirmar destrutivo: um Enter distraído não pode
  // excluir nada.
  const acoesRef = useRef<HTMLDivElement>(null)
  useFocoDoDialogo(open, acoesRef, "button")
  useEffect(() => {
    if (!open) return
    // Captura + stopPropagation: confirmação aberta EM CIMA de um modal — o Esc fecha só ela, não os dois.
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onCancel() } }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [open, onCancel])

  if (!open) return null
  const Icon = tone === "info" ? Info : AlertTriangle

  return (
    <div onClick={onCancel} className={styles.overlay}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={styles.dialogBox}
        data-pontes-overlay-boundary
        style={scopedThemeVars(p, font) as CSSProperties}
      >
        <div className={styles.dialogIcon} data-tone={tone}><Icon size={26} strokeWidth={2.5} /></div>
        <div className={styles.dialogTitle}>{title}</div>
        {description && <div className={styles.dialogDesc}>{description}</div>}
        <div ref={acoesRef} className={styles.dialogActions}>
          <PontesButton variant="outline" fullWidth onClick={onCancel}>{cancelLabel}</PontesButton>
          <PontesButton variant={tone === "danger" ? "danger" : "primary"} fullWidth onClick={onConfirm}>
            {confirmLabel}
          </PontesButton>
        </div>
      </div>
    </div>
  )
}
