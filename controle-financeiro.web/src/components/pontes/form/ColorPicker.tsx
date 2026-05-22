/**
 * ColorPicker — paleta horizontal de cores selecionáveis.
 */

import type { Palette } from "../theme"

export type PontesColorPickerProps = {
  p: Palette
  colors: string[]
  value: string
  onChange: (c: string) => void
}

export function PontesColorPicker({ p, colors, value, onChange }: PontesColorPickerProps) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {colors.map((c) => {
        const selected = c === value
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Cor ${c}`}
            style={{
              width: 36, height: 36, borderRadius: 10, background: c,
              border: selected ? `3px solid ${p.text}` : `2px solid ${p.surface}`,
              cursor: "pointer",
              boxShadow: selected ? `0 0 0 2px ${c}` : `0 0 0 1px ${p.border}`,
              outline: "none",
            }}
          />
        )
      })}
    </div>
  )
}
