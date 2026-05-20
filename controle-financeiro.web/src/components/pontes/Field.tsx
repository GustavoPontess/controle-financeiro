/**
 * Field — wrapper de label + control + erro.
 * Padroniza espaçamento de label, mensagem de erro e helper text.
 */

import { type ReactNode } from "react"
import { semantic, type Palette } from "./theme"

export type PontesFieldProps = {
  p: Palette
  font?: string
  label?: string
  helper?: string
  error?: string
  required?: boolean
  children: ReactNode
  htmlFor?: string
}

export function PontesField({
  p, font, label, helper, error, required, children, htmlFor,
}: PontesFieldProps) {
  const labelColor = error ? semantic.danger : p.text
  const helperColor = error ? semantic.danger : p.textMuted

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: font }}>
      {label && (
        <label htmlFor={htmlFor} style={{ fontSize: 13, fontWeight: 600, color: labelColor }}>
          {label}{required && <span style={{ color: semantic.danger, marginLeft: 4 }}>*</span>}
        </label>
      )}
      {children}
      {(error || helper) && (
        <div style={{ fontSize: 12, color: helperColor, marginTop: 2 }}>
          {error || helper}
        </div>
      )}
    </div>
  )
}
