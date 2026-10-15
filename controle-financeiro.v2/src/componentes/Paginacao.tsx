// Rodapé de lista do v2: linhas por página + "1–25 de 364" + páginas numeradas (1 … atual±1 … última).
// O servidor pagina (o back limita a 100 por página), então este componente só pede página e tamanho.
import { ChevronLeft, ChevronRight } from "lucide-react"
import styles from "./Paginacao.module.css"

export const TAMANHOS = [10, 25, 50, 100] as const

/** Páginas a mostrar: sempre a 1ª e a última, a atual ±1 e reticências onde pula. */
function paginasVisiveis(atual: number, total: number): (number | "…")[] {
  const lo = Math.max(1, atual - 1)
  const hi = Math.min(total, atual + 1)
  const out: (number | "…")[] = []
  if (lo > 1) { out.push(1); if (lo > 2) out.push("…") }
  for (let i = lo; i <= hi; i++) out.push(i)
  if (hi < total) { if (hi < total - 1) out.push("…"); out.push(total) }
  return out
}

export default function Paginacao({ total, pagina, porPagina, onPagina, onPorPagina, rotulo, rotuloSingular }: {
  total: number
  pagina: number
  porPagina: number
  onPagina: (p: number) => void
  onPorPagina: (n: number) => void
  /** "transações" / "transação" */
  rotulo: string
  rotuloSingular: string
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const atual = Math.min(Math.max(1, pagina), totalPaginas)
  const de = total === 0 ? 0 : (atual - 1) * porPagina + 1
  const ate = Math.min(atual * porPagina, total)

  return (
    <div className={styles.paginacao}>
      <label className={styles.tamanho}>
        <span className={styles.tamanhoRotulo}>Linhas por página</span>
        <select value={porPagina} onChange={(e) => onPorPagina(Number(e.target.value))} aria-label="Linhas por página">
          {TAMANHOS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <span className={styles.faixa}>{de}–{ate} de {total} {total === 1 ? rotuloSingular : rotulo}</span>
      <nav className={styles.paginas} aria-label="Páginas">
        <button type="button" className={styles.seta} aria-label="Página anterior" disabled={atual <= 1} onClick={() => onPagina(atual - 1)}>
          <ChevronLeft size={16} strokeWidth={2.25} />
        </button>
        {paginasVisiveis(atual, totalPaginas).map((p, i) => p === "…"
          ? <span key={`r${i}`} className={styles.reticencias} aria-hidden="true">…</span>
          : (
            <button key={p} type="button" className={styles.pagina} data-atual={p === atual ? "true" : undefined}
              aria-current={p === atual ? "page" : undefined} onClick={() => onPagina(p)}>{p}</button>
          ))}
        <button type="button" className={styles.seta} aria-label="Próxima página" disabled={atual >= totalPaginas} onClick={() => onPagina(atual + 1)}>
          <ChevronRight size={16} strokeWidth={2.25} />
        </button>
      </nav>
    </div>
  )
}
