/**
 * PageHeader — topo PADRÃO das telas internas.
 *
 * O título da tela mora SÓ na Navbar; por isso aqui não há <h1> nem subtítulo (antes cada tela
 * repetia o título e inventava o próprio cabeçalho). Estrutura fixa:
 *  - esquerda (opcional): abas / navegação de período (`start`);
 *  - direita: UM botão primário "Novo/Nova <coisa>" (sm, ícone Plus), sempre no mesmo lugar.
 */

import { type ReactNode } from "react"
import { Plus } from "lucide-react"
import { PontesButton } from "../buttons/Button"
import { PontesInline } from "./Layout"
import styles from "./PageHeader.module.css"

export type PontesPageHeaderProps = {
  /** Slot à esquerda: abas ou navegação de período. Nunca título (esse fica na Navbar). */
  start?: ReactNode
  /** Rótulo do botão primário, ex.: "Nova conta fixa". Sem ele, o botão não aparece. */
  actionLabel?: string
  onAction?: () => void
  /** Troca o ícone do botão (default Plus 16px / strokeWidth 2.5). */
  actionIcon?: ReactNode
  actionDisabled?: boolean
}

export function PontesPageHeader({ start, actionLabel, onAction, actionIcon, actionDisabled }: PontesPageHeaderProps) {
  return (
    <PontesInline gap="lg" justify="between" wrap className={styles.header}>
      {start && <div className={styles.start}>{start}</div>}
      {actionLabel && (
        <div className={styles.action}>
          <PontesButton
            variant="primary"
            size="sm"
            iconStart={actionIcon ?? <Plus size={16} strokeWidth={2.5} />}
            onClick={onAction}
            disabled={actionDisabled}
          >
            {actionLabel}
          </PontesButton>
        </div>
      )}
    </PontesInline>
  )
}
