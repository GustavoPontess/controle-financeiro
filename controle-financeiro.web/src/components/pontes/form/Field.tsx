/**
 * Field — wrapper de label + control + erro. Cor via var(--pontes-*).
 * `p`/`font` são override de tema escopado opcional (transição #122).
 */

import { type ReactNode, type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Field.module.css"

export type PontesFieldProps = {
  p?: Palette
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
  return (
    <div className={styles.field} data-error={error ? "true" : undefined} style={scopedThemeVars(p, font) as CSSProperties}>
      {label && (
        <label htmlFor={htmlFor} className={styles.label}>
          {label}{required && <span className={styles.req}>*</span>}
        </label>
      )}
      {children}
      {(error || helper) && <div className={styles.helper}>{error || helper}</div>}
    </div>
  )
}
