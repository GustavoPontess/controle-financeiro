/**
 * Drawer — painel lateral deslizante. Cor via var(--pontes-*).
 * `p`/`font` override escopado opcional (#122).
 */

import { useEffect, type ReactNode, type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Drawer.module.css"

export type PontesDrawerProps = {
  p?: Palette
  font?: string
  open: boolean
  side?: "left" | "right"
  width?: number
  title?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** Sem cabeçalho (título + fechar) e sem recuo no corpo — o conteúdo é o painel inteiro (ex.: a barra
   *  lateral virando gaveta no celular, que já tem o próprio logo). Fecha por Esc ou tocando fora. */
  bare?: boolean
  /** Nome acessível do painel (obrigatório na prática quando `bare`, que não tem título). */
  ariaLabel?: string
}

export function PontesDrawer({
  p, font, open, side = "right", width = 380, title, onClose, children, footer, bare, ariaLabel,
}: PontesDrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  return (
    <>
      <div onClick={onClose} className={styles.overlay} data-open={open ? "true" : undefined} />
      <aside
        className={styles.panel}
        data-side={side}
        data-open={open ? "true" : undefined}
        data-bare={bare ? "true" : undefined}
        aria-label={ariaLabel ?? title}
        aria-hidden={open ? undefined : true}
        inert={!open}
        style={{ width, ...scopedThemeVars(p, font) } as CSSProperties}
      >
        {!bare && (
          <div className={styles.header}>
            <div className={styles.title}>{title}</div>
            <button type="button" onClick={onClose} className={styles.close} aria-label="Fechar">×</button>
          </div>
        )}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </aside>
    </>
  )
}
