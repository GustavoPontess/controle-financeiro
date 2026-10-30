// Menu de ações de uma linha (⋮): abre pra baixo, alinhado à direita; fecha ao clicar fora, no Esc e ao
// escolher. Pra ação que não merece botão na linha (antecipar/cancelar parcela…). `gatilho` troca o ⋮ por outro
// conteúdo (ex.: o "+" de anexar, com a classe da tela em `classeGatilho`); `aEsquerda` abre alinhado à esquerda;
// `acima` abre pra cima.
import { useEffect, useRef, useState, type ReactNode } from "react"
import { MoreHorizontal } from "lucide-react"
import Botao from "./Botao"
import styles from "./Menu.module.css"

export type ItemMenu = { rotulo: string; icone?: ReactNode; perigo?: boolean; onClick: () => void }

export default function Menu({ itens, ariaLabel, gatilho, classeGatilho, aEsquerda, acima }: {
  itens: ItemMenu[]
  ariaLabel: string
  gatilho?: ReactNode
  classeGatilho?: string
  aEsquerda?: boolean
  acima?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false) }
    // Esc fecha só o menu (numa janela, não fecha a janela junto).
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setAberto(false) } }
    document.addEventListener("mousedown", fora); document.addEventListener("keydown", esc, true)
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc, true) }
  }, [aberto])

  return (
    <div className={styles.menu} ref={ref}>
      {gatilho ? (
        <button type="button" className={classeGatilho} aria-label={ariaLabel} aria-haspopup="menu" aria-expanded={aberto}
          onClick={() => setAberto((v) => !v)}>{gatilho}</button>
      ) : (
        <Botao variante="texto" soIcone aria-label={ariaLabel} aria-haspopup="menu" aria-expanded={aberto}
          onClick={() => setAberto((v) => !v)} icone={<MoreHorizontal size={18} strokeWidth={2} aria-hidden="true" />} />
      )}
      {aberto && (
        <div className={styles.lista} role="menu" aria-label={ariaLabel} data-esquerda={aEsquerda || undefined} data-acima={acima || undefined}>
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
