/**
 * FormControls — toggle, checkbox, radio.
 * Visual coerente entre os três (mesma cor primary, mesmo padding).
 */

import type { Palette } from "./theme"

// =============================================================================
// PontesToggle (switch)
// =============================================================================

export type PontesToggleProps = {
  p: Palette
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
      style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        background: "none", border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: 0, fontFamily: font,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{
        width: 40, height: 22,
        background: checked ? p.primary : p.border,
        borderRadius: 999, position: "relative",
        transition: "background 200ms",
      }}>
        <span style={{
          position: "absolute", top: 2,
          left: checked ? 20 : 2,
          width: 18, height: 18,
          background: "#FFFFFF", borderRadius: "50%",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "left 200ms",
        }} />
      </span>
      {label && <span style={{ fontSize: 14, color: p.text }}>{label}</span>}
    </button>
  )
}

// =============================================================================
// PontesCheckbox
// =============================================================================

export type PontesCheckboxProps = {
  p: Palette
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
      style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        background: "none", border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: 0, fontFamily: font, opacity: disabled ? 0.6 : 1,
      }}
    >
      {checked ? (
        <span style={{
          width: 20, height: 20, background: p.primary, borderRadius: 5,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#FFFFFF", fontSize: 14, fontWeight: 700,
        }}>✓</span>
      ) : (
        <span style={{ width: 20, height: 20, border: `2px solid ${p.border}`, borderRadius: 5, display: "block" }} />
      )}
      {label && <span style={{ fontSize: 14, color: checked ? p.text : p.textMuted }}>{label}</span>}
    </button>
  )
}

// =============================================================================
// PontesRadio
// =============================================================================

export type PontesRadioProps<T extends string = string> = {
  p: Palette
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
      style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        background: "none", border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: 0, fontFamily: font, opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{
        width: 20, height: 20,
        border: `2px solid ${active ? p.primary : p.border}`,
        borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {active && <span style={{ width: 10, height: 10, background: p.primary, borderRadius: "50%" }} />}
      </span>
      {label && <span style={{ fontSize: 14, color: active ? p.text : p.textMuted }}>{label}</span>}
    </button>
  )
}

export type PontesRadioGroupProps<T extends string = string> = {
  p: Palette
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
    <div style={{ display: "flex", flexDirection: direction, gap: direction === "row" ? 18 : 10 }}>
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
