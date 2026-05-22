/**
 * FormControls — toggle, checkbox, radio. Cor via var(--pontes-*).
 * Estado checked via data-attr (CSS). `p`/`font` override escopado opcional (#122).
 */

import { type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./FormControls.module.css"

// =============================================================================
// PontesToggle (switch)
// =============================================================================

export type PontesToggleProps = {
  p?: Palette
  font?: string
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  disabled?: boolean
}

export function PontesToggle({ p, font, checked, onChange, label, disabled }: PontesToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={styles.control}
      data-checked={checked ? "true" : "false"}
      style={scopedThemeVars(p, font) as CSSProperties}
    >
      <span className={styles.track}><span className={styles.knob} /></span>
      {label && <span className={styles.label}>{label}</span>}
    </button>
  )
}

// =============================================================================
// PontesCheckbox
// =============================================================================

export type PontesCheckboxProps = {
  p?: Palette
  font?: string
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  disabled?: boolean
}

export function PontesCheckbox({ p, font, checked, onChange, label, disabled }: PontesCheckboxProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={styles.control}
      data-checked={checked ? "true" : "false"}
      style={scopedThemeVars(p, font) as CSSProperties}
    >
      <span className={styles.checkbox} data-checked={checked ? "true" : "false"}>{checked ? "✓" : null}</span>
      {label && <span className={styles.labelMuted}>{label}</span>}
    </button>
  )
}

// =============================================================================
// PontesRadio
// =============================================================================

export type PontesRadioProps<T extends string = string> = {
  p?: Palette
  font?: string
  value: T
  current: T
  onChange: (v: T) => void
  label?: string
  disabled?: boolean
}

export function PontesRadio<T extends string = string>({
  p, font, value, current, onChange, label, disabled,
}: PontesRadioProps<T>) {
  const active = value === current
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(value)}
      className={styles.control}
      data-checked={active ? "true" : "false"}
      style={scopedThemeVars(p, font) as CSSProperties}
    >
      <span className={styles.radio}>{active && <span className={styles.radioDot} />}</span>
      {label && <span className={styles.labelMuted}>{label}</span>}
    </button>
  )
}

export type PontesRadioGroupProps<T extends string = string> = {
  p?: Palette
  font?: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  direction?: "row" | "column"
}

export function PontesRadioGroup<T extends string = string>({
  p, font, options, value, onChange, direction = "row",
}: PontesRadioGroupProps<T>) {
  return (
    <div className={styles.group} data-dir={direction} style={scopedThemeVars(p, font) as CSSProperties}>
      {options.map((opt) => (
        <PontesRadio
          key={opt.value}
          p={p}
          font={font}
          value={opt.value}
          current={value}
          onChange={onChange}
          label={opt.label}
        />
      ))}
    </div>
  )
}
