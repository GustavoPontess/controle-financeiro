// Confirmação do v2 (excluir, estornar…): véu + cartão central. Esc ou clique no véu cancela; o foco
// abre no "Cancelar" (o caminho seguro) e volta pra quem abriu ao fechar.
import { useEffect, useRef, type ReactNode } from "react"
import styles from "./Confirmar.module.css"

export default function Confirmar({ aberto, titulo, texto, rotuloConfirmar, perigo, ocupado, onConfirmar, onCancelar }: {
  aberto: boolean
  titulo: string
  texto?: ReactNode
  rotuloConfirmar: string
  /** Ação destrutiva: botão vermelho. */
  perigo?: boolean
  /** Enviando: trava os botões. */
  ocupado?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  const cancelarRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (!aberto) return
    const antes = document.activeElement as HTMLElement | null
    cancelarRef.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !ocupado) onCancelar() }
    document.addEventListener("keydown", esc)
    return () => { document.removeEventListener("keydown", esc); antes?.focus?.() }
  }, [aberto, ocupado, onCancelar])

  if (!aberto) return null
  return (
    <div className={styles.veu} onMouseDown={(e) => { if (e.target === e.currentTarget && !ocupado) onCancelar() }}>
      <div className={styles.caixa} role="alertdialog" aria-modal="true" aria-labelledby="confirmar-titulo">
        <h2 id="confirmar-titulo" className={styles.titulo}>{titulo}</h2>
        {texto && <div className={styles.texto}>{texto}</div>}
        <div className={styles.acoes}>
          <button ref={cancelarRef} type="button" className={styles.cancelar} disabled={ocupado} onClick={onCancelar}>Cancelar</button>
          <button type="button" className={styles.confirmar} data-perigo={perigo ? "true" : undefined} disabled={ocupado} onClick={onConfirmar}>
            {ocupado ? "Aguarde…" : rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}
