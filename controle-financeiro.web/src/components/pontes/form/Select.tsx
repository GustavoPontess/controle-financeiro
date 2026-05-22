/**
 * Select — dropdown custom da biblioteca Pontes (não usa <select> nativo).
 * Móvel de HomePage para componente reutilizável.
 */

import { useEffect, useRef, useState } from "react"
import type { Palette } from "../theme"

export type PontesSelectOption<T extends string = string> = {
  value: T
  label?: string
}

export type PontesSelectProps<T extends string = string> = {
  p: Palette
  font: string
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

  // Fechar ao clicar fora.
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
  const borderColor = invalid ? "#DC2626" : open ? p.primary : p.border

  return (
    <div ref={wrapRef} style={{ position: "relative", width: fullWidth ? "100%" : undefined }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        style={{
          width: "100%", border: `1px solid ${borderColor}`,
          padding: "12px 14px", borderRadius: 10,
          fontSize: 14, fontFamily: font,
          background: p.surface, color: value ? p.text : p.textMuted,
          outline: "none", cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          boxShadow: open ? `0 0 0 3px ${p.primary}22` : undefined,
          transition: "all 150ms ease",
        }}
      >
        <span>{selected?.label ?? value ?? placeholder}</span>
        <span style={{
          color: p.textMuted,
          transform: open ? "rotate(180deg)" : "none",
          transition: "transform 150ms",
        }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          background: p.surface, border: `1px solid ${p.border}`, borderRadius: 10,
          boxShadow: "0 12px 28px rgba(0,0,0,0.12)", overflow: "hidden", zIndex: 50,
          maxHeight: 280, overflowY: "auto",
        }}>
          {normalized.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              onMouseEnter={(e) => {
                if (opt.value !== value) (e.currentTarget as HTMLElement).style.background = p.bg
              }}
              onMouseLeave={(e) => {
                if (opt.value !== value) (e.currentTarget as HTMLElement).style.background = "transparent"
              }}
              style={{
                width: "100%", textAlign: "left", padding: "10px 14px",
                fontSize: 14, color: p.text,
                background: opt.value === value ? p.primarySoft : "transparent",
                border: "none", cursor: "pointer", fontFamily: font,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <span>{opt.label ?? opt.value}</span>
              {opt.value === value && <span style={{ color: p.primary, fontWeight: 700 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
