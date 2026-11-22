// Anexos das solicitações (selo Beta e Admin): as imagens grandes na própria tela (por cima da página), com ‹ › pra passar entre eles,
// setas do teclado, Esc ou clique fora pra fechar, e "2 de 3" + o nome do anexo embaixo.
import { useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import Etiqueta from "./Etiqueta"
import styles from "./VerAnexos.module.css"

/** `mostrarValores` só nos anexos do selo Beta (sem ele, a etiqueta não aparece). */
export type AnexoParaVer = { url: string; nome: string; texto: string | null; mostrarValores?: boolean }

export default function VerAnexos({ anexos, indice, aoMudar, aoFechar }: {
  anexos: AnexoParaVer[]
  indice: number
  aoMudar: (i: number) => void
  aoFechar: () => void
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const total = anexos.length
  const ir = (passo: number) => aoMudar((indice + passo + total) % total)

  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null
    caixa.current?.focus()
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); aoFechar() } // só o visualizador: o formulário de baixo continua
      else if (e.key === "ArrowRight" && total > 1) aoMudar((indice + 1) % total)
      else if (e.key === "ArrowLeft" && total > 1) aoMudar((indice - 1 + total) % total)
    }
    document.addEventListener("keydown", tecla, true)
    return () => { document.removeEventListener("keydown", tecla, true); antes?.focus?.() }
  }, [indice, total, aoMudar, aoFechar])

  const a = anexos[indice]
  if (!a) return null
  return (
    <div className={styles.veu} onMouseDown={(e) => { if (e.target === e.currentTarget) aoFechar() }}>
      <div ref={caixa} className={styles.caixa} role="dialog" aria-modal="true" aria-label={`Anexo ${indice + 1} de ${total}: ${a.nome}`} tabIndex={-1}>
        <button type="button" className={styles.fechar} aria-label="Fechar" onClick={aoFechar}><X size={18} strokeWidth={2.25} aria-hidden="true" /></button>
        <div className={styles.palco}>
          {total > 1 && (
            <button type="button" className={styles.seta} data-lado="esq" aria-label="Anterior" onClick={() => ir(-1)}>
              <ChevronLeft size={22} strokeWidth={2.25} aria-hidden="true" />
            </button>
          )}
          <img src={a.url} alt={a.nome} className={styles.imagem} />
          {total > 1 && (
            <button type="button" className={styles.seta} data-lado="dir" aria-label="Próximo" onClick={() => ir(1)}>
              <ChevronRight size={22} strokeWidth={2.25} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className={styles.legenda}>
          <span className={styles.contador}>{indice + 1} de {total}</span>
          <span className={styles.nome}>{a.nome}</span>
          {a.mostrarValores !== undefined && <Etiqueta tom={a.mostrarValores ? "alerta" : undefined}>{a.mostrarValores ? "Com valores" : "Valores escondidos"}</Etiqueta>}
        </div>
        {a.texto && <p className={styles.texto}>{a.texto}</p>}
      </div>
    </div>
  )
}
