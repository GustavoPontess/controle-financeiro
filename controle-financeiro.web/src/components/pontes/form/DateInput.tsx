/**
 * PontesDateInput — input compacto estilo Pontes com popover que abre o
 * PontesDatePicker (calendário custom). Substitui `<input type="date">`
 * nativo pra manter visual consistente em qualquer browser/SO.
 *
 * Aceita string "YYYY-MM-DD" (mesma API do native), valida min/max.
 * onChange entrega a mesma string YYYY-MM-DD — compatível com forms
 * existentes que já usavam `<PontesInput type="date">`.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { Calendar } from "lucide-react"
import { scopedThemeVars, type Palette } from "../theme"
import { PontesDatePicker } from "./DatePicker"
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

export function PontesDateInput({
  p, font, value, onChange, min, max, invalid, disabled, placeholder, autoFocus,
}: PontesDateInputProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  // Fecha ao ESC.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

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

      {open && (
        <div className={styles.popover} role="dialog">
          <PontesDatePicker value={isoToDate(value)} onChange={handlePick} />
        </div>
      )}
    </div>
  )
}
