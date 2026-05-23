/**
 * ChoiceCards — escolha segmentada em "cards" grandes (ícone + label).
 *
 * Para seleções binárias/curtas com peso visual (ex: Despesa | Receita).
 * Cada opção tem um `tone` que colore o estado ativo (soft bg + cor + borda).
 * Estilo via ChoiceCards.module.css + var(--pontes-*). `p`/`font` override opcional.
 */

import { type CSSProperties, type ReactNode } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./ChoiceCards.module.css"

export type PontesChoiceTone = "primary" | "accent" | "success" | "danger"

export type PontesChoiceOption<T extends string = string> = {
  value: T
  label: ReactNode
  icon?: ReactNode
  tone?: PontesChoiceTone
}

export type PontesChoiceCardsProps<T extends string = string> = {
  p?: Palette
  font?: string
  options: PontesChoiceOption<T>[]
  value: T
  onChange: (v: T) => void
  /** Colunas do grid. Default = nº de opções. */
  columns?: number
}

export function PontesChoiceCards<T extends string = string>({
  p, font, options, value, onChange, columns,
}: PontesChoiceCardsProps<T>) {
  return (
    <div
      className={styles.grid}
      style={{
        ...scopedThemeVars(p, font),
        gridTemplateColumns: `repeat(${columns ?? options.length}, 1fr)`,
      } as CSSProperties}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={styles.card}
          data-active={opt.value === value ? "true" : undefined}
          data-tone={opt.tone ?? "primary"}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon && <span className={styles.icon} aria-hidden>{opt.icon}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  )
}
