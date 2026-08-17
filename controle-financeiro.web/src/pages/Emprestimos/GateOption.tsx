import React from "react"

/** Rádio de escolha explícita — usado nos pontos com risco de duplicar lançamento.
 * `className` vem de `styles.gateOption` de quem chama (CSS tem a regra `[data-selected]` junto). */
export default function GateOption({ name, value, current, onChange, className, children }: {
  name: string; value: string; current: string; onChange: (v: string) => void
  className: string; children: React.ReactNode
}) {
  return (
    <label className={className} data-selected={current === value ? "" : undefined}>
      <input type="radio" name={name} checked={current === value} onChange={() => onChange(value)} />
      {children}
    </label>
  )
}
