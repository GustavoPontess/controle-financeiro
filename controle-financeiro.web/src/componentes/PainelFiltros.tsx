// Botão "Filtros" + painel ancorado nele (o de Transações; também nas Transações da família). Os campos vêm de quem
// usa (`children`) e vivem num rascunho enquanto o painel está aberto: só valem no "Aplicar". Fecha com Esc ou clique
// fora (sem aplicar). O contador no botão diz quantos filtros estão valendo.
import { useEffect, useRef, type ReactNode } from "react"
import { SlidersHorizontal } from "lucide-react"
import Botao from "./Botao"
import styles from "./PainelFiltros.module.css"

export default function PainelFiltros({ ativos, aberto, aoAbrir, aoFechar, aoAplicar, aoLimpar, children }: {
  /** Quantos filtros estão valendo (o número no botão). */
  ativos: number
  aberto: boolean
  /** Abrir: quem usa copia o que está valendo pro rascunho. */
  aoAbrir: () => void
  aoFechar: () => void
  aoAplicar: () => void
  aoLimpar: () => void
  children: ReactNode
}) {
  const raiz = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) aoFechar() }
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar() }
    document.addEventListener("mousedown", fora)
    document.addEventListener("keydown", esc)
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc) }
  }, [aberto, aoFechar])

  return (
    <div className={styles.wrap} ref={raiz}>
      <Botao ativo={aberto || ativos > 0} aria-expanded={aberto} aria-haspopup="dialog"
        onClick={() => (aberto ? aoFechar() : aoAbrir())}
        icone={<SlidersHorizontal size={15} strokeWidth={2.2} aria-hidden="true" />}>
        Filtros
        {ativos > 0 && <span className={styles.contador}>{ativos}</span>}
      </Botao>
      {aberto && (
        <div className={styles.painel} role="dialog" aria-label="Filtros">
          {children}
          <div className={styles.rodape}>
            <Botao variante="texto" className={styles.limparTudo} onClick={aoLimpar}>Limpar tudo</Botao>
            <Botao variante="primario" onClick={aoAplicar}>Aplicar</Botao>
          </div>
        </div>
      )}
    </div>
  )
}
