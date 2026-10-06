/**
 * PageHeader — topo PADRÃO das telas internas.
 *
 * Estrutura fixa (igual às outras telas):
 *  - esquerda: nome da tela (`titulo`) + descrição curta embaixo (`descricao`), ou abas / navegação
 *    de período (`start`);
 *  - direita: UM botão primário "Novo/Nova <coisa>" (sm, ícone Plus), sempre no mesmo lugar.
 */

import { type ReactNode } from "react"
import { Plus } from "lucide-react"
import { PontesButton } from "../buttons/Button"
import { PontesInline } from "./Layout"
import styles from "./PageHeader.module.css"

export type PontesPageHeaderProps = {
  /** Nome da tela (ex.: "Transferências"). */
  titulo?: string
  /** Descrição curta embaixo do nome (ex.: "Mova dinheiro entre suas contas"). */
  descricao?: string
  /** Slot à esquerda: abas ou navegação de período (no lugar do título). */
  start?: ReactNode
  /** Rótulo do botão primário, ex.: "Nova conta fixa". Sem ele, o botão não aparece. */
  actionLabel?: string
  onAction?: () => void
  /** Troca o ícone do botão (default Plus 16px / strokeWidth 2.5). */
  actionIcon?: ReactNode
  actionDisabled?: boolean
}

export function PontesPageHeader({ titulo, descricao, start, actionLabel, onAction, actionIcon, actionDisabled }: PontesPageHeaderProps) {
  return (
    <PontesInline gap="lg" justify="between" wrap className={styles.header}>
      {start
        ? <div className={styles.start}>{start}</div>
        : titulo && (
          <div className={styles.start}>
            <h1 className={styles.titulo}>{titulo}</h1>
            {descricao && <p className={styles.descricao}>{descricao}</p>}
          </div>
        )}
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
