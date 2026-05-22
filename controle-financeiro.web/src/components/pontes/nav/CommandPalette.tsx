/**
 * CommandPalette — Cmd+K search overlay. Cor via var(--pontes-*).
 * `p`/`font` override escopado opcional (#122).
 */

import { useEffect, type ReactNode, type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./CommandPalette.module.css"

export type PontesCommandItem = {
  key: string
  icon?: ReactNode
  label: ReactNode
  hint?: string
  onSelect: () => void
}

export type PontesCommandPaletteProps = {
  p?: Palette
  font?: string
  open: boolean
  onClose: () => void
  query: string
  onQueryChange: (q: string) => void
  items: PontesCommandItem[]
  /** Index do item destacado (default 0). */
  activeIndex?: number
}

export function PontesCommandPalette({
  p, font, open, onClose, query, onQueryChange, items, activeIndex = 0,
}: PontesCommandPaletteProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div onClick={onClose} className={styles.overlay}>
      <div onClick={(e) => e.stopPropagation()} className={styles.box} style={scopedThemeVars(p, font) as CSSProperties}>
        <div className={styles.search}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className={styles.input}
            placeholder="Buscar..."
          />
          <span className={styles.esc}>ESC</span>
        </div>
        <div className={styles.list}>
          {items.length === 0 ? (
            <div className={styles.empty}>Nenhum resultado</div>
          ) : items.map((it, i) => (
            <button
              key={it.key}
              type="button"
              onClick={() => { it.onSelect(); onClose() }}
              className={styles.item}
              data-active={i === activeIndex ? "true" : undefined}
            >
              {it.icon && <span className={styles.itemIcon}>{it.icon}</span>}
              <div className={styles.itemBody}>
                <div className={styles.itemLabel}>{it.label}</div>
                {it.hint && <div className={styles.itemHint}>{it.hint}</div>}
              </div>
              {i === activeIndex && <span className={styles.enter}>⏎</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
