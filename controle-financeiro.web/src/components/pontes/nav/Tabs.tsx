/**
 * Tabs — navegação de aba (pills/underline). Cor via var(--pontes-*).
 * `p`/`font` override escopado opcional (#122).
 */

import { type ReactNode, type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Tabs.module.css"

export type PontesTabOption<T extends string = string> = {
  value: T
  label: ReactNode
}

export type PontesTabsProps<T extends string = string> = {
  p?: Palette
  font?: string
  options: PontesTabOption<T>[]
  value: T
  onChange: (v: T) => void
  variant?: "pills" | "underline"
}

export function PontesTabs<T extends string = string>({
  p, font, options, value, onChange, variant = "pills",
}: PontesTabsProps<T>) {
  const underline = variant === "underline"
  return (
    <div className={underline ? styles.underline : styles.pills} style={scopedThemeVars(p, font) as CSSProperties}>
      {options.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={underline ? styles.utab : styles.pill}
          data-active={value === t.value ? "true" : undefined}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
