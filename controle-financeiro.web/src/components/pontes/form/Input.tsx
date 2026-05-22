/**
 * Input — campos de texto da biblioteca Pontes.
 *
 * Exports:
 *  - PontesInput  (text/email/password/number, opcional iconStart/iconEnd)
 *  - PontesMoneyInput  (display gigante, sugestões de incremento)
 *  - PontesTextarea
 */

import { type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, useState } from "react"
import { semantic, type Palette } from "../theme"

// =============================================================================
// PontesInput
// =============================================================================

export type PontesInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  p: Palette
  font: string
  iconStart?: ReactNode
  iconEnd?: ReactNode
  invalid?: boolean
  fullWidth?: boolean
}

export function PontesInput({
  p, font, iconStart, iconEnd, invalid, fullWidth = true, style, onFocus, onBlur, ...rest
}: PontesInputProps) {
  const [focused, setFocused] = useState(false)

  const borderColor = invalid
    ? semantic.danger
    : focused ? p.primary : p.border
  const boxShadow = invalid
    ? `0 0 0 3px ${semantic.danger}22`
    : focused ? `0 0 0 3px ${p.primary}22` : undefined

  const inputStyle: React.CSSProperties = {
    width: fullWidth ? "100%" : undefined,
    border: `1px solid ${borderColor}`,
    padding: iconStart ? "12px 14px 12px 38px" : iconEnd ? "12px 38px 12px 14px" : "12px 14px",
    borderRadius: 10,
    fontSize: 14,
    fontFamily: font,
    background: invalid ? "#FEF2F2" : p.surface,
    color: p.text,
    outline: "none",
    boxShadow,
    boxSizing: "border-box",
    transition: "all 150ms ease",
    ...style,
  }

  if (!iconStart && !iconEnd) {
    return (
      <input
        style={inputStyle}
        onFocus={(e) => { setFocused(true); onFocus?.(e) }}
        onBlur={(e) => { setFocused(false); onBlur?.(e) }}
        {...rest}
      />
    )
  }

  return (
    <div style={{ position: "relative", width: fullWidth ? "100%" : undefined }}>
      {iconStart && (
        <span style={{
          position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
          color: p.textMuted, pointerEvents: "none",
        }}>{iconStart}</span>
      )}
      <input
        style={inputStyle}
        onFocus={(e) => { setFocused(true); onFocus?.(e) }}
        onBlur={(e) => { setFocused(false); onBlur?.(e) }}
        {...rest}
      />
      {iconEnd && (
        <span style={{
          position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
          color: p.textMuted,
        }}>{iconEnd}</span>
      )}
    </div>
  )
}

// =============================================================================
// PontesMoneyInput
// =============================================================================

export type PontesMoneyInputProps = {
  p: Palette
  font: string
  label?: string
  value: string
  onChange: (v: string) => void
  suggestions?: string[]
  currency?: string
}

export function PontesMoneyInput({
  p, font, label = "Valor", value, onChange, suggestions = ["+100", "+500", "+1.000", "+5.000"], currency = "R$",
}: PontesMoneyInputProps) {
  return (
    <div style={{
      background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14,
      padding: 24, maxWidth: 380, fontFamily: font,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: p.textMuted,
        letterSpacing: "0.12em", marginBottom: 8, textTransform: "uppercase",
      }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 28, color: p.textMuted, fontWeight: 600 }}>{currency}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            fontSize: 48, fontWeight: 800, color: p.text,
            border: "none", background: "transparent", outline: "none",
            letterSpacing: "-0.025em", width: "100%", fontFamily: font,
          }}
        />
      </div>
      <div style={{ height: 1, background: p.border, marginTop: 8 }} />
      {suggestions.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              style={{
                flex: 1, background: p.bg, color: p.text, border: `1px solid ${p.border}`,
                padding: 6, borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: font,
              }}
            >{s}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// PontesTextarea
// =============================================================================

export type PontesTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  p: Palette
  font: string
  invalid?: boolean
  fullWidth?: boolean
}

export function PontesTextarea({
  p, font, invalid, fullWidth = true, style, onFocus, onBlur, ...rest
}: PontesTextareaProps) {
  const [focused, setFocused] = useState(false)
  const borderColor = invalid ? semantic.danger : focused ? p.primary : p.border
  const boxShadow = invalid
    ? `0 0 0 3px ${semantic.danger}22`
    : focused ? `0 0 0 3px ${p.primary}22` : undefined

  return (
    <textarea
      style={{
        width: fullWidth ? "100%" : undefined,
        border: `1px solid ${borderColor}`,
        padding: "12px 14px",
        borderRadius: 10,
        fontSize: 14, fontFamily: font,
        background: p.surface, color: p.text,
        outline: "none", resize: "none", minHeight: 80,
        boxShadow, boxSizing: "border-box",
        transition: "all 150ms ease",
        ...style,
      }}
      onFocus={(e) => { setFocused(true); onFocus?.(e) }}
      onBlur={(e) => { setFocused(false); onBlur?.(e) }}
      {...rest}
    />
  )
}
