/**
 * Input — campos de texto. Cor via var(--pontes-*); foco via :focus (CSS puro).
 * `p`/`font` são override de tema escopado opcional (transição #122).
 *
 * Exports: PontesInput, PontesMoneyInput, PontesTextarea.
 */

import { type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Input.module.css"

// =============================================================================
// PontesInput
// =============================================================================

export type PontesInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  p?: Palette
  font?: string
  iconStart?: ReactNode
  iconEnd?: ReactNode
  invalid?: boolean
  fullWidth?: boolean
}

export function PontesInput({
  p, font, iconStart, iconEnd, invalid, fullWidth = true, style, className, ...rest
}: PontesInputProps) {
  const input = (
    <input
      className={[styles.input, className].filter(Boolean).join(" ")}
      data-invalid={invalid ? "true" : undefined}
      data-has-start={iconStart ? "true" : undefined}
      data-has-end={iconEnd ? "true" : undefined}
      data-fullwidth={fullWidth ? undefined : "false"}
      style={{ ...scopedThemeVars(p, font), ...style } as CSSProperties}
      {...rest}
    />
  )

  if (!iconStart && !iconEnd) return input

  return (
    <div className={styles.wrap} data-fullwidth={fullWidth ? undefined : "false"} style={scopedThemeVars(p, font) as CSSProperties}>
      {iconStart && <span className={styles.iconStart}>{iconStart}</span>}
      {input}
      {iconEnd && <span className={styles.iconEnd}>{iconEnd}</span>}
    </div>
  )
}

// =============================================================================
// PontesMoneyInput
// =============================================================================

export type PontesMoneyInputProps = {
  p?: Palette
  font?: string
  label?: string
  value: string
  onChange: (v: string) => void
  suggestions?: string[]
  currency?: string
}

/** Mantém só dígitos e formata como moeda BR (centavos → "1.234,56"). */
function maskValor(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (!digits) return ""
  return (Number(digits) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function PontesMoneyInput({
  p, font, label = "Valor", value, onChange, suggestions = ["+100", "+500", "+1.000", "+5.000"], currency = "R$",
}: PontesMoneyInputProps) {
  return (
    <div className={styles.money} style={scopedThemeVars(p, font) as CSSProperties}>
      <div className={styles.moneyLabel}>{label}</div>
      <div className={styles.moneyRow}>
        <span className={styles.moneyCur}>{currency}</span>
        <input
          className={styles.moneyInput}
          value={value}
          onChange={(e) => onChange(maskValor(e.target.value))}
          inputMode="decimal"
          placeholder="0,00"
        />
      </div>
      <div className={styles.moneyDivider} />
      {suggestions.length > 0 && (
        <div className={styles.moneySugg}>
          {suggestions.map((s) => (
            <button key={s} type="button" className={styles.moneyChip}>{s}</button>
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
  p?: Palette
  font?: string
  invalid?: boolean
  fullWidth?: boolean
}

export function PontesTextarea({
  p, font, invalid, fullWidth = true, style, className, ...rest
}: PontesTextareaProps) {
  return (
    <textarea
      className={[styles.textarea, className].filter(Boolean).join(" ")}
      data-invalid={invalid ? "true" : undefined}
      style={{ width: fullWidth ? "100%" : "auto", ...scopedThemeVars(p, font), ...style } as CSSProperties}
      {...rest}
    />
  )
}
