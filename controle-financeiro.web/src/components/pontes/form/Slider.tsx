/**
 * Slider — range slider single thumb. Cor via var(--pontes-*).
 * Posições (percent) ficam inline. `p`/`font` override escopado opcional (#122).
 */

import { type ChangeEvent, type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Slider.module.css"

export type PontesSliderProps = {
  p?: Palette
  font?: string
  label?: string
  min?: number
  max?: number
  step?: number
  value: number
  onChange: (v: number) => void
  formatValue?: (v: number) => string
}

export function PontesSlider({
  p, font, label, min = 0, max = 100, step = 1, value, onChange, formatValue,
}: PontesSliderProps) {
  const percent = ((value - min) / (max - min)) * 100
  const display = formatValue ? formatValue(value) : String(value)

  return (
    <div className={styles.wrap} style={scopedThemeVars(p, font) as CSSProperties}>
      {label && (
        <div className={styles.head}>
          <span className={styles.headLabel}>{label}</span>
          <span className={styles.headValue}>{display}</span>
        </div>
      )}
      <div className={styles.rail}>
        <div className={styles.track} />
        <div className={styles.fill} style={{ width: `${percent}%` }} />
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
          className={styles.input}
        />
        <div className={styles.thumb} style={{ left: `${percent}%` }} />
      </div>
      <div className={styles.ends}>
        <span>{formatValue ? formatValue(min) : min}</span>
        <span>{formatValue ? formatValue(max) : max}</span>
      </div>
    </div>
  )
}
