/**
 * OtpInput — entrada de código numérico (verificação 2FA / e-mail).
 */

import { useEffect, useRef, useState } from "react"
import type { Palette } from "../theme"

export type PontesOtpInputProps = {
  p: Palette
  font: string
  length?: number
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
}

export function PontesOtpInput({
  p, font, length = 6, value, onChange, onComplete,
}: PontesOtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    if (value.length === length && onComplete) onComplete(value)
  }, [value, length, onComplete])

  const digits = Array.from({ length }, (_, i) => value[i] ?? "")

  const setDigit = (i: number, d: string) => {
    const clean = d.replace(/\D/g, "").slice(-1)
    const next = digits.slice()
    next[i] = clean
    const v = next.join("")
    onChange(v)
    if (clean && i < length - 1) refs.current[i + 1]?.focus()
  }

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus()
    }
  }

  return (
    <div style={{ display: "flex", gap: 10 }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          value={d}
          onChange={(e) => setDigit(i, e.target.value)}
          onFocus={() => setActiveIdx(i)}
          onKeyDown={(e) => onKey(i, e)}
          inputMode="numeric"
          maxLength={1}
          style={{
            width: 52, height: 60,
            border: `2px solid ${activeIdx === i ? p.primary : p.border}`,
            borderRadius: 12, textAlign: "center",
            fontSize: 26, fontWeight: 800, color: p.text,
            fontFamily: font, background: p.surface,
            boxShadow: activeIdx === i ? `0 0 0 4px ${p.primary}22` : undefined,
            outline: "none",
            transition: "all 150ms ease",
          }}
        />
      ))}
    </div>
  )
}
