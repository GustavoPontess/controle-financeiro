/**
 * EmptyState — caixa com ícone + título + descrição + ações. Cor via var(--pontes-*).
 * `p`/`font` override escopado opcional (#122).
 */

import { type ReactNode, type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./EmptyState.module.css"

export type PontesEmptyStateProps = {
  p?: Palette
  font?: string
  icon?: ReactNode
  title: string
  description?: string
  actions?: ReactNode
  maxWidth?: number
}

export function PontesEmptyState({
  p, font, icon = "📭", title, description, actions, maxWidth,
}: PontesEmptyStateProps) {
  // Sem maxWidth por padrão: o empty state ocupa toda a largura do container e o conteúdo já fica
  // centralizado (text-align + ícone margin:auto no CSS). Passe maxWidth só se quiser capar.
  return (
    <div
      className={styles.wrap}
      style={{ ...(maxWidth ? { maxWidth } : null), ...scopedThemeVars(p, font) } as CSSProperties}
    >
      <div className={styles.icon}>{icon}</div>
      <div className={styles.title}>{title}</div>
      {description && <div className={styles.desc}>{description}</div>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
