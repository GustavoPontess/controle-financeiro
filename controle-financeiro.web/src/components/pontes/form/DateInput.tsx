/**
 * PontesDateInput — input compacto estilo Pontes com popover que abre o
 * PontesDatePicker (calendário custom). Substitui `<input type="date">`
 * nativo pra manter visual consistente em qualquer browser/SO.
 *
 * Aceita string "YYYY-MM-DD" (mesma API do native), valida min/max.
 * onChange entrega a mesma string YYYY-MM-DD — compatível com forms
 * existentes que já usavam `<PontesInput type="date">`.
 */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
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

// Largura aproximada do PontesDatePicker (`.wrap { max-width: 320px }`,
// conteúdo real ~300px). Usada só pra clampar a posição do popover contra a
// borda do modal/viewport — não precisa ser exata, só não subestimar.
const POPOVER_WIDTH = 300
const POPOVER_HEIGHT = 340

type Pos = { left: number; top?: number; bottom?: number }

export function PontesDateInput({
  p, font, value, onChange, min, max, invalid, disabled, placeholder, autoFocus,
}: PontesDateInputProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  // Posiciona via portal (foge do overflow do modal) e clampa dentro do
  // boundary (modal ou viewport) — mesmo padrão do PontesSelect, senão o
  // popover vaza pra fora em campos de data perto da borda direita.
  const computePos = () => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 4
    const BUFFER = 12
    const boundary = el.closest<HTMLElement>("[data-pontes-overlay-boundary]")
    const b = boundary?.getBoundingClientRect()
    const topLimit = b?.top ?? 0
    const bottomLimit = b?.bottom ?? window.innerHeight
    const leftLimit = b?.left ?? 0
    const rightLimit = b?.right ?? window.innerWidth
    const spaceBelow = bottomLimit - r.bottom - BUFFER
    const spaceAbove = r.top - topLimit - BUFFER
    const up = spaceBelow < POPOVER_HEIGHT && spaceAbove > spaceBelow

    let left = r.left
    if (left + POPOVER_WIDTH > rightLimit - BUFFER) left = rightLimit - BUFFER - POPOVER_WIDTH
    if (left < leftLimit + BUFFER) left = leftLimit + BUFFER

    setPos(up
      ? { left, bottom: window.innerHeight - r.top + gap }
      : { left, top: r.bottom + gap })
  }

  useLayoutEffect(() => { if (open) computePos() }, [open])

  useEffect(() => {
    if (!open) return
    const onReflow = () => computePos()
    window.addEventListener("resize", onReflow)
    window.addEventListener("scroll", onReflow, true)
    return () => {
      window.removeEventListener("resize", onReflow)
      window.removeEventListener("scroll", onReflow, true)
    }
  }, [open])

  // Fecha ao clicar fora (trigger E popover — o popover vive num portal,
  // fora da árvore do wrap).
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (!wrapRef.current?.contains(t) && !popoverRef.current?.contains(t)) setOpen(false)
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
