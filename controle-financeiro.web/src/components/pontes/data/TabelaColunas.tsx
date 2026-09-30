/**
 * Botão "Colunas" (ícone) que abre um popover ancorado pra mostrar/ocultar colunas da PontesTabela.
 * A 1ª coluna (identidade) fica fixa. Cada item usa um check (✓), não checkbox nativo. Em cima, dois
 * atalhos: definir as colunas atuais como padrão (salvo) e aplicar o padrão salvo. Portalizado (foge
 * do overflow do cartão); fecha ao clicar fora / Esc.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Columns3, Check } from "lucide-react"
import { PontesIconButton } from "../buttons/Button"
import styles from "./Tabela.module.css"

export type PontesColunaToggle = { key: string; header: string }

export function PontesTabelaColunas({
  colunas, ocultas, onToggle,
}: {
  colunas: PontesColunaToggle[]
  ocultas: Set<string>
  onToggle: (key: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!aberto) return
    const place = () => {
      const r = wrapRef.current?.getBoundingClientRect()
      if (!r) return
      setCoords({ top: r.bottom + 8, left: r.right })
    }
    place()
    window.addEventListener("scroll", place, true)
    window.addEventListener("resize", place)
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place) }
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (!wrapRef.current?.contains(t) && !panelRef.current?.contains(t)) setAberto(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setAberto(false) } }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [aberto])

  return (
    <span ref={wrapRef} className={styles.filtrosWrap}>
      <PontesIconButton
        size={32}
        variant="ghost"
        aria-label="Mostrar ou ocultar colunas"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        <Columns3 size={16} strokeWidth={2.2} />
      </PontesIconButton>
      {aberto && coords && createPortal(
        <div
          ref={panelRef}
          className={styles.colunasPanel}
          role="dialog"
          aria-label="Colunas"
          style={{ position: "fixed", top: coords.top, left: coords.left, transform: "translateX(-100%)" }}
        >
          <div className={styles.colunasTitulo}>Exibir colunas</div>
          {colunas.map((c, i) => {
            const visivel = !ocultas.has(c.key)
            const fixa = i === 0
            return (
              <button
                key={c.key}
                type="button"
                className={styles.colunasItem}
                data-oculta={!visivel ? "true" : undefined}
                disabled={fixa}
                aria-pressed={visivel}
                onClick={() => { if (!fixa) onToggle(c.key) }}
              >
                <span className={styles.colunasCheck}>{visivel && <Check size={14} strokeWidth={3} />}</span>
                <span>{c.header}</span>
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </span>
  )
}
