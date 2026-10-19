// Janela do v2 (véu + cartão central) pra conteúdo que não é uma confirmação: ver a foto, escolher entre
// opções. Esc ou clique no véu fecha; o foco entra no primeiro botão e volta pra quem abriu ao fechar.
// Confirmação de ação (excluir, estornar) continua sendo o `Confirmar`.
import { useEffect, useId, useRef, type ReactNode } from "react"
import styles from "./Dialogo.module.css"

export default function Dialogo({ aberto, titulo, onFechar, children, travado }: {
  aberto: boolean
  titulo: string
  onFechar: () => void
  children: ReactNode
  /** Enviando: Esc e clique no véu não fecham. */
  travado?: boolean
}) {
  const id = useId()
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const antes = document.activeElement as HTMLElement | null
    caixa.current?.querySelector<HTMLElement>("button, [href], input")?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !travado) onFechar() }
    document.addEventListener("keydown", esc)
    return () => { document.removeEventListener("keydown", esc); antes?.focus?.() }
  }, [aberto, travado, onFechar])

  if (!aberto) return null
  return (
    <div className={styles.veu} onMouseDown={(e) => { if (e.target === e.currentTarget && !travado) onFechar() }}>
      <div ref={caixa} className={styles.caixa} role="dialog" aria-modal="true" aria-labelledby={id}>
        <h2 id={id} className={styles.titulo}>{titulo}</h2>
        {children}
      </div>
    </div>
  )
}
