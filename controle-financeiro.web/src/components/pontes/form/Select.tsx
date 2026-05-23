/**
 * Select — dropdown custom (não usa <select> nativo). Cor via var(--pontes-*).
 * Hover de opção via CSS :hover. `p`/`font` override escopado opcional (#122).
 */

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { ChevronDown, Check } from "lucide-react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Select.module.css"

export type PontesSelectOption<T extends string = string> = {
  value: T
  label?: string
}

export type PontesSelectProps<T extends string = string> = {
  p?: Palette
  font?: string
  options: (T | PontesSelectOption<T>)[]
  value: T
  onChange: (v: T) => void
  placeholder?: string
  fullWidth?: boolean
  invalid?: boolean
  disabled?: boolean
}

export function PontesSelect<T extends string = string>({
  p, font, options, value, onChange, placeholder = "Selecione",
  fullWidth = true, invalid, disabled,
}: PontesSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  const normalized: PontesSelectOption<T>[] = options.map((o) =>
    typeof o === "string" ? { value: o as T, label: o } : (o as PontesSelectOption<T>)
  )
  const selected = normalized.find((o) => o.value === value)

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      data-fullwidth={fullWidth ? undefined : "false"}
      style={scopedThemeVars(p, font) as CSSProperties}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={styles.trigger}
        data-open={open ? "true" : undefined}
        data-invalid={invalid ? "true" : undefined}
        data-placeholder={value ? undefined : "true"}
      >
        <span>{selected?.label ?? (value || placeholder)}</span>
        <span className={styles.caret}><ChevronDown size={16} /></span>
      </button>
      {open && (
        <div className={styles.menu}>
          {normalized.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={styles.option}
              data-selected={opt.value === value ? "true" : undefined}
            >
              <span>{opt.label ?? opt.value}</span>
              {opt.value === value && <span className={styles.check}><Check size={14} strokeWidth={2.5} /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
