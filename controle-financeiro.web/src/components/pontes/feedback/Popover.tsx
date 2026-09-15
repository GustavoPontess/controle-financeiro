/**
 * Popover — menu dropdown por clique. Cor via var(--pontes-*); hover via :hover.
 * `p`/`font` override escopado opcional (#122).
 *
 * O menu é renderizado num PORTAL (document.body, position: fixed) posicionado a
 * partir do retângulo do trigger. Assim ele FLUTUA por cima de tudo e não conta no
 * scroll de nenhum ancestral (tabela/card/main) — evita clipping e scrollbar feia.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from "react"
import { createPortal } from "react-dom"
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
  const [coords, setCoords] = useState<{ top: number; left: number; width?: number } | null>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Posiciona o menu a partir do retângulo do trigger; reposiciona em scroll/resize.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const t = triggerRef.current
      if (!t) return
      const r = t.getBoundingClientRect()
      setCoords({
        top: direction === "up" ? r.top - 8 : r.bottom + 8,
        left: fullWidth || align === "left" ? r.left : r.right,
        width: fullWidth ? r.width : undefined,
      })
    }
    place()
    window.addEventListener("scroll", place, true)
    window.addEventListener("resize", place)
    return () => {
      window.removeEventListener("scroll", place, true)
      window.removeEventListener("resize", place)
    }
  }, [open, direction, align, fullWidth])

  // Fecha ao clicar fora (considera o menu portalizado, que fica fora do wrap).
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (!wrapRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  const transform = [
    !fullWidth && align === "right" ? "translateX(-100%)" : "",
    direction === "up" ? "translateY(-100%)" : "",
  ].join(" ").trim() || undefined

  return (
    <span ref={wrapRef} className={styles.wrap} data-fullwidth={fullWidth ? "true" : undefined} style={scopedThemeVars(p, font) as CSSProperties}>
      <span ref={triggerRef} onClick={() => setOpen(!open)} className={styles.trigger}>{trigger}</span>
      {open && coords && createPortal(
        <div
          ref={menuRef}
          className={styles.menu}
          style={{
            ...(scopedThemeVars(p, font) as CSSProperties),
            position: "fixed", top: coords.top, left: coords.left, right: "auto", bottom: "auto",
            transform, width: coords.width, minWidth: fullWidth ? undefined : minWidth,
          }}
        >
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
        </div>,
        document.body,
      )}
    </span>
  )
}
