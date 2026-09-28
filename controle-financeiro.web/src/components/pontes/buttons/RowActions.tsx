/**
 * RowActions — menu ⋮ com as ações de UMA linha de lista (padrão das telas internas).
 *
 * Existe pra acabar com a fileira de ícones soltos por linha (cada tela com os seus, sem rótulo):
 * todas as ações da linha vivem aqui, com ícone + texto. Regras do padrão, garantidas pelo
 * componente (a tela não precisa lembrar):
 *  - botão ⋮ com aria-label "Ações" (e aria-haspopup/aria-expanded);
 *  - ação destrutiva (danger) SEMPRE por último, separada por divisor e em tom danger;
 *  - clicar no ⋮ ou num item NÃO dispara o clique da linha (linha clicável abre edição/detalhe).
 *
 * Quem confirma o destrutivo é a TELA (PontesDialog) — aqui o item só avisa o clique.
 * Construído sobre o PontesPopover (portal, teclado, Esc).
 */

import { useState, type ReactNode, type SyntheticEvent } from "react"
import { MoreVertical } from "lucide-react"
import { PontesIconButton } from "./Button"
import { PontesPopover, type PontesPopoverItem } from "../feedback/Popover"
import styles from "./RowActions.module.css"

export type PontesRowAction = {
  key: string
  label: string
  /** Ícone lucide 16px / strokeWidth 2.5 (tamanho do item de menu). */
  icon?: ReactNode
  onClick: () => void
  /** Destrutivo (ex.: "Excluir"): vai pro fim, em tom danger. A tela confirma com PontesDialog. */
  danger?: boolean
}

export type PontesRowActionsProps = {
  actions: PontesRowAction[]
  /** Rótulo acessível do botão ⋮. Default "Ações". */
  ariaLabel?: string
  /** Tamanho do botão ⋮. Default 32 (linhas de lista). */
  size?: 24 | 32
  minWidth?: number
}

// Não deixa o clique/tecla do ⋮ (nem de um item — o portal propaga pela árvore React) subir até a
// linha clicável. O Esc do menu escuta na captura do document, então segue funcionando.
const naoPropagar = (e: SyntheticEvent) => e.stopPropagation()

export function PontesRowActions({ actions, ariaLabel = "Ações", size = 32, minWidth = 200 }: PontesRowActionsProps) {
  const [aberto, setAberto] = useState(false)
  if (actions.length === 0) return null

  // Ordem estável: não-destrutivas na ordem dada, destrutivas por último (divisor antes da 1ª).
  const normais = actions.filter((a) => !a.danger)
  const destrutivas = actions.filter((a) => a.danger)
  const items: PontesPopoverItem[] = [
    ...normais.map((a) => ({ key: a.key, label: a.label, icon: a.icon, onClick: a.onClick })),
    ...destrutivas.map((a, i) => ({
      key: a.key, label: a.label, icon: a.icon, onClick: a.onClick, danger: true,
      divider: i === 0 && normais.length > 0,
    })),
  ]

  return (
    <span className={styles.wrap} onClick={naoPropagar} onKeyDown={naoPropagar}>
      <PontesPopover
        align="right"
        minWidth={minWidth}
        items={items}
        onOpenChange={setAberto}
        trigger={
          <PontesIconButton
            size={size}
            variant="ghost"
            aria-label={ariaLabel}
            aria-haspopup="menu"
            aria-expanded={aberto}
          >
            <MoreVertical size={16} strokeWidth={2.5} />
          </PontesIconButton>
        }
      />
    </span>
  )
}
