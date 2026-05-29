/**
 * Select — dropdown custom (não usa <select> nativo). Cor via var(--pontes-*).
 * Menu via portal (document.body) com posição fixa → nunca é cortado por overflow
 * de modal/popup; altura limitada ao espaço da tela (abre pra cima se faltar).
 * Busca automática quando há muitas opções (>8) ou via prop `searchable`.
 */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, Check, Search } from "lucide-react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Select.module.css"

export type PontesSelectOption<T extends string = string> = {
  value: T
  label?: string
}

export type PontesSelectProps<T extends string = string> = {
  p?: Palette
  font?: string
  options: (T | PontesSelectOption<T>)[]
  value: T
  onChange: (v: T) => void
  placeholder?: string
  fullWidth?: boolean
  invalid?: boolean
  disabled?: boolean
  /** Mostra campo de busca. Default: auto quando há > 8 opções. */
  searchable?: boolean
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()

type Pos = { left: number; width: number; top?: number; bottom?: number; maxHeight: number }

export function PontesSelect<T extends string = string>({
  p, font, options, value, onChange, placeholder = "Selecione",
  fullWidth = true, invalid, disabled, searchable,
}: PontesSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [pos, setPos] = useState<Pos | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const computePos = () => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 6
    // BUFFER: distância do menu até as bordas do viewport. Garante que o menu
    // NÃO encoste em footer de modal/edge da página — sempre sobra respiro
    // pros botões abaixo. Quem tiver pouco espaço de qualquer lado encolhe
    // automaticamente em vez de cobrir o footer.
    const BUFFER = 24
    const spaceBelow = window.innerHeight - r.bottom - BUFFER
    const spaceAbove = r.top - BUFFER
    // Vira pra cima quando: (a) cabe pouco embaixo e tem mais espaço em cima,
    // ou (b) embaixo cabe menos que o mínimo confortável (140px).
    const up = (spaceBelow < 200 && spaceAbove > spaceBelow) || spaceBelow < 140
    const room = up ? spaceAbove : spaceBelow
    const maxHeight = Math.max(140, Math.min(320, room))
    setPos(up
      ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + gap, maxHeight }
      : { left: r.left, width: r.width, top: r.bottom + gap, maxHeight })
  }

  useLayoutEffect(() => { if (open) computePos() }, [open])

  useEffect(() => {
    if (!open) { setQuery(""); return }
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    // Fecha ao rolar a PÁGINA, mas não quando o scroll vem de dentro do menu
    // (lista de opções rolável) — senão o dropdown fecha ao tentar rolar.
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onResize = () => setOpen(false)
    document.addEventListener("mousedown", onDocClick)
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onResize)
    const tm = setTimeout(() => inputRef.current?.focus(), 0)
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onResize)
      clearTimeout(tm)
    }
  }, [open])

  const normalized: PontesSelectOption<T>[] = options.map((o) =>
    typeof o === "string" ? { value: o as T, label: o } : (o as PontesSelectOption<T>)
  )
  const selected = normalized.find((o) => o.value === value)
  // Search habilitado por padrão — todo select Pontes tem caixa de busca
  // (igual o select de pesquisa do Ctrl+K). Pass `searchable={false}` pra
  // tirar em casos especiais (lista bem curta, controle único).
  const withSearch = searchable ?? true
  const filtered = withSearch && query
    ? normalized.filter((o) => norm(o.label ?? o.value).includes(norm(query)))
    : normalized

  return (
    <div
      className={styles.wrap}
      data-fullwidth={fullWidth ? undefined : "false"}
      style={scopedThemeVars(p, font) as CSSProperties}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={styles.trigger}
        data-open={open ? "true" : undefined}
        data-invalid={invalid ? "true" : undefined}
        data-placeholder={value ? undefined : "true"}
      >
        <span>{selected?.label ?? (value || placeholder)}</span>
        <span className={styles.caret}><ChevronDown size={16} /></span>
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          className={styles.menu}
          style={{
            position: "fixed", left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom,
            maxHeight: pos.maxHeight, ...scopedThemeVars(p, font),
          } as CSSProperties}
        >
          {withSearch && (
            <div className={styles.searchRow}>
              <Search size={14} className={styles.searchIcon} />
              <input
                ref={inputRef}
                className={styles.searchInput}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar…"
              />
            </div>
          )}
          <div className={styles.options}>
            {filtered.length === 0 ? (
              <div className={styles.noResult}>Nenhum resultado</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  className={styles.option}
                  data-selected={opt.value === value ? "true" : undefined}
                >
                  <span>{opt.label ?? opt.value}</span>
                  {opt.value === value && <span className={styles.check}><Check size={14} strokeWidth={2.5} /></span>}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
