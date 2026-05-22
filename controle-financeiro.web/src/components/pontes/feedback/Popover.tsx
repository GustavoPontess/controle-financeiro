/**
 * Popover — menu dropdown por clique. Cor via var(--pontes-*); hover via :hover.
 * `p`/`font` override escopado opcional (#122).
 */

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Popover.module.css"

export type PontesPopoverItem = {
  key: string
  icon?: ReactNode
  label: string
  danger?: boolean
  onClick?: () => void
  /** Insere divisor antes desse item. */
  divider?: boolean
}

export type PontesPopoverProps = {
  p?: Palette
  font?: string
  trigger: ReactNode
  items: PontesPopoverItem[]
  minWidth?: number
  align?: "left" | "right"
  /** Direção de abertura. "up" abre acima do trigger. */
  direction?: "down" | "up"
  /** Trigger ocupa 100% da largura do pai. */
  fullWidth?: boolean
}

export function PontesPopover({
  p, font, trigger, items, minWidth = 200, align = "left", direction = "down", fullWidth = false,
}: PontesPopoverProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  return (
    <span ref={ref} className={styles.wrap} data-fullwidth={fullWidth ? "true" : undefined} style={scopedThemeVars(p, font) as CSSProperties}>
      <span onClick={() => setOpen(!open)} className={styles.trigger}>{trigger}</span>
      {open && (
        <div className={styles.menu} data-dir={direction} data-align={align} style={{ minWidth }}>
          {items.map((it) => (
            <div key={it.key}>
              {it.divider && <div className={styles.divider} />}
              <button
                type="button"
                onClick={() => { it.onClick?.(); setOpen(false) }}
                className={styles.item}
                data-danger={it.danger ? "true" : undefined}
              >
                {it.icon && <span>{it.icon}</span>}
                <span>{it.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </span>
  )
}
