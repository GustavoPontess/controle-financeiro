// Menu de seções de uma página grande (Configurações; serve pra outras): à esquerda, ícone + nome, a ativa
// destacada como o item do menu principal. Cada item é link pra `?s=<id>` — dá pra voltar/avançar e
// compartilhar. No celular a página mostra só a lista (sem `?s=`) ou só a seção escolhida, com a seta de voltar
// do topo levando de volta à lista (V2Layout), como os Ajustes do iPhone.
import { ChevronRight, type LucideIcon } from "lucide-react"
import { Link } from "react-router-dom"
import styles from "./NavSecoes.module.css"

export type Secao<T extends string> = { id: T; rotulo: string; icone: LucideIcon }

export default function NavSecoes<T extends string>({ secoes, ativa, ariaLabel }: {
  secoes: Secao<T>[]
  ativa: T
  ariaLabel: string
}) {
  return (
    <nav className={styles.nav} aria-label={ariaLabel}>
      {secoes.map(({ id, rotulo, icone: Icone }) => (
        <Link key={id} to={`?s=${id}`} className={styles.item} aria-current={id === ativa ? "page" : undefined}>
          <Icone size={18} strokeWidth={2} aria-hidden="true" />
          <span>{rotulo}</span>
          <ChevronRight size={20} strokeWidth={2} aria-hidden="true" className={styles.seta} />
        </Link>
      ))}
    </nav>
  )
}
