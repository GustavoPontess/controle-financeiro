// Menu de ações de uma linha (⋮): abre pra baixo, alinhado à direita; fecha ao clicar fora, no Esc e ao
// escolher. Pra ação que não merece botão na linha (antecipar/cancelar parcela…).
import { useEffect, useRef, useState, type ReactNode } from "react"
import { MoreHorizontal } from "lucide-react"
import Botao from "./Botao"
import styles from "./Menu.module.css"

export type ItemMenu = { rotulo: string; icone?: ReactNode; perigo?: boolean; onClick: () => void }

export default function Menu({ itens, ariaLabel }: { itens: ItemMenu[]; ariaLabel: string }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false) }
    document.addEventListener("mousedown", fora); document.addEventListener("keydown", esc)
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc) }
  }, [aberto])

  return (
    <div className={styles.menu} ref={ref}>
      <Botao variante="texto" soIcone aria-label={ariaLabel} aria-haspopup="menu" aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)} icone={<MoreHorizontal size={18} strokeWidth={2} aria-hidden="true" />} />
      {aberto && (
        <div className={styles.lista} role="menu" aria-label={ariaLabel}>
          {itens.map((i) => (
            <button key={i.rotulo} type="button" role="menuitem" className={styles.item} data-perigo={i.perigo || undefined}
              onClick={() => { setAberto(false); i.onClick() }}>
              {i.icone}{i.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
