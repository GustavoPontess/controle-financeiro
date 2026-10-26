// Escolha única em segmentos (ex.: Despesa / Receita / Transferência). role="radiogroup": Tab entra no
// escolhido, setas trocam a escolha.
import { useRef, type KeyboardEvent, type ReactNode } from "react"
import styles from "./Segmentos.module.css"

export type OpcaoSegmento<T extends string> = { valor: T; rotulo: string; icone?: ReactNode }

export default function Segmentos<T extends string>({ valor, onChange, opcoes, ariaLabel, cheio }: {
  valor: T
  onChange: (valor: T) => void
  opcoes: OpcaoSegmento<T>[]
  ariaLabel: string
  /** Ocupa a largura toda, segmentos iguais. */
  cheio?: boolean
}) {
  const botoes = useRef<(HTMLButtonElement | null)[]>([])
  const indiceAtivo = Math.max(0, opcoes.findIndex((o) => o.valor === valor))

  const tecla = (e: KeyboardEvent, i: number) => {
    const passo = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
    if (!passo) return
    e.preventDefault()
    const n = (i + passo + opcoes.length) % opcoes.length
    onChange(opcoes[n].valor)
    botoes.current[n]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={styles.segmentos} data-cheio={cheio || undefined}>
      {opcoes.map((o, i) => {
        const ativo = o.valor === valor
        return (
          <button key={o.valor} ref={(el) => { botoes.current[i] = el }} type="button" role="radio" aria-checked={ativo}
            tabIndex={i === indiceAtivo ? 0 : -1} className={styles.segmento} data-ativo={ativo || undefined}
            onClick={() => onChange(o.valor)} onKeyDown={(e) => tecla(e, i)}>
            {o.icone}{o.rotulo}
          </button>
        )
      })}
    </div>
  )
}
