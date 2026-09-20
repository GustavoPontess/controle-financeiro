/**
 * Segmented — controle de toggle AGRUPADO (container pill + segmento ativo branco). É o padrão
 * usado nos toolbars (Tudo/Receitas/Despesas, Tudo/A receber/A pagar). Antes cada tela recriava
 * isso no próprio *.module.css (`.tipoChips`, `.segmented`); agora é 1 componente do DS, reusado
 * em todas → consistência + zero CSS duplicado. Diferente do PontesTabs (pills soltas / underline).
 */

import { type ReactNode, type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Segmented.module.css"

export type PontesSegmentedOption = { value: string; label: ReactNode }

export type PontesSegmentedProps = {
  p?: Palette
  options: PontesSegmentedOption[]
  value: string
  onChange: (v: string) => void
  /** md = 42px (alinha com inputs/botões do toolbar). sm = compacto. Default md. */
  size?: "sm" | "md"
  ariaLabel?: string
}

export function PontesSegmented({ p, options, value, onChange, size = "md", ariaLabel }: PontesSegmentedProps) {
  return (
    <div
      className={styles.segmented}
      role="tablist"
      aria-label={ariaLabel}
      data-size={size}
      style={scopedThemeVars(p) as CSSProperties}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          data-active={value === o.value ? "true" : undefined}
          className={styles.segBtn}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
