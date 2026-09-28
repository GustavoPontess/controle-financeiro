/**
 * PontesDateInput — input compacto estilo Pontes com popover que abre o
 * PontesDatePicker (calendário custom). Substitui `<input type="date">`
 * nativo pra manter visual consistente em qualquer browser/SO.
 *
 * Aceita string "YYYY-MM-DD" (mesma API do native), valida min/max.
 * onChange entrega a mesma string YYYY-MM-DD — compatível com forms
 * existentes que já usavam `<PontesInput type="date">`.
 */

import { type CSSProperties } from "react"
import { createPortal } from "react-dom"
import { Calendar } from "lucide-react"
import { scopedThemeVars, type Palette } from "../theme"
import { PontesDatePicker } from "./DatePicker"
import { useAnchoredPopover } from "./useAnchoredPopover"
import styles from "./DateInput.module.css"

export type PontesDateInputProps = {
  p?: Palette
  font?: string
  /** Valor "YYYY-MM-DD". String vazia = sem data. */
  value: string
  /** Recebe "YYYY-MM-DD" (vazio se limpou). */
  onChange: (v: string) => void
  /** Mínimo "YYYY-MM-DD". */
  min?: string
  /** Máximo "YYYY-MM-DD". */
  max?: string
  invalid?: boolean
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
}

const isoToDate = (iso: string): Date | null => {
  if (!iso) return null
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

const dateToIso = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

const formatPtBR = (iso: string): string => {
  const d = isoToDate(iso)
  if (!d) return ""
  return d.toLocaleDateString("pt-BR")
}

// Largura aproximada do PontesDatePicker (`.wrap { max-width: 320px }`,
// conteúdo real ~300px). Usada só pra clampar a posição do popover contra a
// borda do modal/viewport — não precisa ser exata, só não subestimar.
const POPOVER_WIDTH = 300
const POPOVER_HEIGHT = 340

export function PontesDateInput({
  p, font, value, onChange, min, max, invalid, disabled, placeholder, autoFocus,
}: PontesDateInputProps) {
  // Portal + clamp no boundary do modal + fechar ao clicar fora/Esc — comum com o PontesMonthInput.
  const { open, setOpen, pos, wrapRef, triggerRef, popoverRef } = useAnchoredPopover(POPOVER_WIDTH, POPOVER_HEIGHT)

  const handlePick = (d: Date) => {
    const iso = dateToIso(d)
    // Respeita min/max sem precisar de feedback (input nativo só permite click).
    if (min && iso < min) return
    if (max && iso > max) return
    onChange(iso)
    setOpen(false)
  }

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      style={scopedThemeVars(p, font) as CSSProperties}
      data-invalid={invalid ? "true" : undefined}
      data-disabled={disabled ? "true" : undefined}
    >
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Calendar size={14} className={styles.icon} />
        <span className={styles.value} data-empty={value ? undefined : "true"}>
          {value ? formatPtBR(value) : (placeholder ?? "Selecione")}
        </span>
      </button>

      {open && pos && createPortal(
        <div
          ref={popoverRef}
          className={styles.popover}
          role="dialog"
          style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, ...scopedThemeVars(p, font) } as CSSProperties}
        >
          <PontesDatePicker value={isoToDate(value)} onChange={handlePick} />
        </div>,
        document.body,
      )}
    </div>
  )
}
