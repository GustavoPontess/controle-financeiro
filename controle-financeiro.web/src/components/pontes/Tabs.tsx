/**
 * Tabs — navegação de aba.
 * Variant: "pills" (botões redondos) ou "underline" (linha embaixo).
 */

import type { ReactNode } from "react"
import type { Palette } from "./theme"

export type PontesTabOption<T extends string = string> = {
  value: T
  label: ReactNode
}

export type PontesTabsProps<T extends string = string> = {
  p: Palette
  font: string
  options: PontesTabOption<T>[]
  value: T
  onChange: (v: T) => void
  variant?: "pills" | "underline"
}

export function PontesTabs<T extends string = string>({
  p, font, options, value, onChange, variant = "pills",
}: PontesTabsProps<T>) {
  if (variant === "underline") {
    return (
      <div style={{ borderBottom: `1px solid ${p.border}`, display: "flex", gap: 28 }}>
        {options.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            style={{
              background: "none", border: "none",
              padding: "10px 0",
              fontSize: 14, fontWeight: 600,
              color: value === t.value ? p.primary : p.textMuted,
              borderBottom: `2px solid ${value === t.value ? p.primary : "transparent"}`,
              marginBottom: "-1px", cursor: "pointer", fontFamily: font,
              transition: "color 150ms ease, border-color 150ms ease",
            }}
          >{t.label}</button>
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          style={{
            background: value === t.value ? p.primary : "transparent",
            color: value === t.value ? p.heroFg : p.text,
            border: `1px solid ${value === t.value ? p.primary : p.border}`,
            padding: "8px 18px", borderRadius: 999,
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font,
          }}
        >{t.label}</button>
      ))}
    </div>
  )
}
