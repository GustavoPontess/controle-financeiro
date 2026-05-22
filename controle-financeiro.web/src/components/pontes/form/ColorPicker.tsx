/**
 * ColorPicker — paleta horizontal de cores. A cor da amostra é dado (inline);
 * borda/ring via var(--pontes-*). `p` override escopado opcional (#122).
 */

import { type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./ColorPicker.module.css"

export type PontesColorPickerProps = {
  p?: Palette
  colors: string[]
  value: string
  onChange: (c: string) => void
}

export function PontesColorPicker({ p, colors, value, onChange }: PontesColorPickerProps) {
  return (
    <div className={styles.wrap} style={scopedThemeVars(p) as CSSProperties}>
      {colors.map((c) => {
        const selected = c === value
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Cor ${c}`}
            className={styles.swatch}
            data-selected={selected ? "true" : undefined}
            style={{ background: c, boxShadow: selected ? `0 0 0 2px ${c}` : undefined }}
          />
        )
      })}
    </div>
  )
}
