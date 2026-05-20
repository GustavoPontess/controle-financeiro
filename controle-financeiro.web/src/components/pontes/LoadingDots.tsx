/**
 * LoadingDots — 3 pontinhos pulsando.
 */

import type { Palette } from "./theme"

export type PontesLoadingDotsProps = {
  p: Palette
  color?: string
  size?: number
  gap?: number
}

export function PontesLoadingDots({ p, color, size = 10, gap = 6 }: PontesLoadingDotsProps) {
  const c = color ?? p.primary
  return (
    <>
      <style>{`@keyframes pontes-glow { 0%, 100% { opacity: 0.5 } 50% { opacity: 0.85 } }`}</style>
      <span style={{ display: "inline-flex", gap }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: size, height: size, borderRadius: "50%", background: c,
            animation: `pontes-glow 1.2s ease-in-out ${i * 0.2}s infinite`,
            display: "inline-block",
          }} />
        ))}
      </span>
    </>
  )
}
