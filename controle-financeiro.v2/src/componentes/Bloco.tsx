// Seção do v2: título pequeno + ação em texto à direita, sem moldura pesada. `plano` = sem fundo/borda.
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import styles from "./Bloco.module.css"

export default function Bloco({ titulo, acao, para, aoClicar, children, plano, semRespiro, className }: {
  titulo?: ReactNode
  /** Rótulo da ação à direita ("Ver todas"). */
  acao?: string
  /** Destino do link. */
  para?: string
  /** Em vez de link: o que a ação faz (ex.: trocar de aba). */
  aoClicar?: () => void
  children: ReactNode
  plano?: boolean
  semRespiro?: boolean
  className?: string
}) {
  return (
    <section className={`${styles.bloco} ${className ?? ""}`} data-plano={plano ? "true" : undefined} data-sem-respiro={semRespiro ? "true" : undefined}>
      {(titulo || acao) && (
        <header className={styles.topo}>
          {titulo && <h2 className={styles.titulo}>{titulo}</h2>}
          {acao && para && <Link to={para} className={styles.acao}>{acao} <ArrowRight size={14} strokeWidth={2.25} aria-hidden="true" /></Link>}
          {acao && !para && aoClicar && <button type="button" className={styles.acao} onClick={aoClicar}>{acao} <ArrowRight size={14} strokeWidth={2.25} aria-hidden="true" /></button>}
        </header>
      )}
      {children}
    </section>
  )
}

/** Estado "carregando": barras cinzas. */
export function Esqueleto({ linhas = 3, altura = 14 }: { linhas?: number; altura?: number }) {
  return (
    <div className={styles.esqueleto} aria-hidden="true">
      {Array.from({ length: linhas }, (_, i) => <span key={i} style={{ height: altura, width: `${100 - (i % 3) * 18}%` }} />)}
    </div>
  )
}
