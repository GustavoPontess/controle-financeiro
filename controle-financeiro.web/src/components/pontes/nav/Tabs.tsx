/**
 * Tabs — navegação de aba.
 * Variant: "pills" (botões redondos) ou "underline" (linha embaixo).
 */

import { useEffect, type ReactNode } from "react"
import { ensurePontesGlobalStyles } from "../_globalStyles"
import { adjustColor, type Palette } from "../theme"

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
  useEffect(ensurePontesGlobalStyles, [])

  if (variant === "underline") {
    return (
      <div style={{ borderBottom: `1px solid ${p.border}`, display: "flex", gap: 28 }}>
        {options.map((t) => {
          const active = value === t.value
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange(t.value)}
              className="pontes-clickable pontes-no-lift"
              data-pontes-variant="ghost"
              style={{
                background: "none", border: "none",
                padding: "10px 0",
                fontSize: 14, fontWeight: 600,
                color: active ? p.primary : p.textMuted,
                borderBottom: `2px solid ${active ? p.primary : "transparent"}`,
                marginBottom: "-1px", cursor: "pointer", fontFamily: font,
                ["--pontes-hover-bg" as never]: "transparent",
                ["--pontes-hover-text" as never]: p.primary,
                ["--pontes-hover-border" as never]: active ? p.primary : adjustColor(p.primary, 0.2),
              }}
            >{t.label}</button>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((t) => {
        const active = value === t.value
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className="pontes-clickable pontes-no-lift"
            data-pontes-variant={active ? "primary" : "ghost"}
            style={{
              background: active ? p.primary : "transparent",
              color: active ? p.heroFg : p.text,
              border: `1px solid ${active ? p.primary : p.border}`,
              padding: "8px 18px", borderRadius: 999,
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font,
              ["--pontes-hover-bg" as never]: active ? adjustColor(p.primary, -0.08) : p.primarySoft,
              ["--pontes-hover-text" as never]: active ? p.heroFg : p.primary,
              ["--pontes-hover-border" as never]: active ? p.primary : p.primary,
              ["--pontes-active-bg" as never]: p.primary,
              ["--pontes-active-text" as never]: p.heroFg,
              ["--pontes-active-border" as never]: p.primary,
            }}
          >{t.label}</button>
        )
      })}
    </div>
  )
}
