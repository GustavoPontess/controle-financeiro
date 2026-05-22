/**
 * OtpInput — entrada de código numérico (2FA / e-mail). Foco via :focus (CSS).
 * `p`/`font` override escopado opcional (#122).
 */

import { useEffect, useRef, type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Otp.module.css"

export type PontesOtpInputProps = {
  p?: Palette
  font?: string
  length?: number
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
}

export function PontesOtpInput({
  p, font, length = 6, value, onChange, onComplete,
}: PontesOtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (value.length === length && onComplete) onComplete(value)
  }, [value, length, onComplete])

  const digits = Array.from({ length }, (_, i) => value[i] ?? "")

  const setDigit = (i: number, d: string) => {
    const clean = d.replace(/\D/g, "").slice(-1)
    const next = digits.slice()
    next[i] = clean
    onChange(next.join(""))
    if (clean && i < length - 1) refs.current[i + 1]?.focus()
  }

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus()
  }

  return (
    <div className={styles.wrap} style={scopedThemeVars(p, font) as CSSProperties}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          value={d}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          inputMode="numeric"
          maxLength={1}
          className={styles.cell}
        />
      ))}
    </div>
  )
}
