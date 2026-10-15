// Confirmação do v2 (excluir, estornar…): véu + cartão central. Esc ou clique no véu cancela; o foco
// abre no "Cancelar" (o caminho seguro) e volta pra quem abriu ao fechar.
import { useEffect, useRef, type ReactNode } from "react"
import Botao from "./Botao"
import styles from "./Confirmar.module.css"

export default function Confirmar({ aberto, titulo, texto, rotuloConfirmar, rotuloCancelar = "Cancelar", perigo, ocupado, onConfirmar, onCancelar, children }: {
  aberto: boolean
  titulo: string
  texto?: ReactNode
  rotuloConfirmar: string
  /** O caminho seguro. Quando a ação é um cancelamento, use algo como "Manter" — senão os dois botões dizem "Cancelar". */
  rotuloCancelar?: string
  /** Ação destrutiva: botão vermelho. */
  perigo?: boolean
  /** Enviando: trava os botões. */
  ocupado?: boolean
  onConfirmar: () => void
  onCancelar: () => void
  /** Conteúdo extra entre o texto e os botões (ex.: o campo de motivo). Com ele, o foco não vai pro "Cancelar". */
  children?: ReactNode
}) {
  const cancelarRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (!aberto) return
    const antes = document.activeElement as HTMLElement | null
    if (!children) cancelarRef.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !ocupado) onCancelar() }
    document.addEventListener("keydown", esc)
    return () => { document.removeEventListener("keydown", esc); antes?.focus?.() }
  }, [aberto, ocupado, onCancelar, children])

  if (!aberto) return null
  return (
    <div className={styles.veu} onMouseDown={(e) => { if (e.target === e.currentTarget && !ocupado) onCancelar() }}>
      <div className={styles.caixa} role="alertdialog" aria-modal="true" aria-labelledby="confirmar-titulo">
        <h2 id="confirmar-titulo" className={styles.titulo}>{titulo}</h2>
        {texto && <div className={styles.texto}>{texto}</div>}
        {children && <div className={styles.conteudo}>{children}</div>}
        <div className={styles.acoes}>
          <Botao ref={cancelarRef} disabled={ocupado} onClick={onCancelar}>{rotuloCancelar}</Botao>
          <Botao variante="primario" perigo={perigo} disabled={ocupado} onClick={onConfirmar}>
            {ocupado ? "Aguarde…" : rotuloConfirmar}
          </Botao>
        </div>
      </div>
    </div>
  )
}
