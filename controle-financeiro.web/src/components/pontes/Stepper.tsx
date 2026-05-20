/**
 * Stepper — wizard de passos horizontal.
 * Cada passo: done (✓ no círculo cheio), current (anel destaque), futuro (cinza).
 */

import type { Palette } from "./theme"

export type PontesStep = {
  label: string
  /** "done" se já completou, "current" se em andamento, undefined se futuro. */
  status?: "done" | "current"
}

export type PontesStepperProps = {
  p: Palette
  font: string
  steps: PontesStep[]
  /** Largura mínima de cada step (default 90). */
  minStepWidth?: number
}

export function PontesStepper({ p, font, steps, minStepWidth = 90 }: PontesStepperProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, width: "100%" }}>
      {steps.map((s, i, arr) => (
        <div key={s.label} style={{ display: "flex", alignItems: "center", flex: i < arr.length - 1 ? 1 : 0 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: minStepWidth }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: s.status === "done" ? p.primary : s.status === "current" ? p.surface : p.bg,
              color: s.status === "done" ? p.heroFg : s.status === "current" ? p.primary : p.textMuted,
              border: s.status === "current" ? `2px solid ${p.primary}` : "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700,
              boxShadow: s.status === "current" ? `0 0 0 4px ${p.primary}22` : undefined,
            }}>
              {s.status === "done" ? "✓" : i + 1}
            </div>
            <div style={{
              fontSize: 11, fontWeight: 600,
              color: s.status ? p.text : p.textMuted, fontFamily: font, textAlign: "center",
            }}>{s.label}</div>
          </div>
          {i < arr.length - 1 && (
            <div style={{
              flex: 1, height: 2,
              background: s.status === "done" ? p.primary : p.border,
              marginBottom: 22,
            }} />
          )}
        </div>
      ))}
    </div>
  )
}
