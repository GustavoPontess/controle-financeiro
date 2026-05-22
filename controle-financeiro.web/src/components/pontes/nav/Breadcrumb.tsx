/**
 * Breadcrumb — trilha de navegação. Cor via var(--pontes-*); hover via :hover.
 * `p`/`font` override escopado opcional (#122).
 */

import { type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Breadcrumb.module.css"

export type PontesBreadcrumbItem = {
  label: string
  href?: string
  onClick?: () => void
}

export type PontesBreadcrumbProps = {
  p?: Palette
  font?: string
  items: PontesBreadcrumbItem[]
  separator?: React.ReactNode
}

export function PontesBreadcrumb({ p, font, items, separator = "/" }: PontesBreadcrumbProps) {
  return (
    <nav aria-label="breadcrumb" className={styles.nav} style={scopedThemeVars(p, font) as CSSProperties}>
      {items.map((it, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className={styles.item}>
            {isLast ? (
              <span className={styles.current}>{it.label}</span>
            ) : it.href ? (
              <a href={it.href} className={styles.link}>{it.label}</a>
            ) : (
              <button type="button" onClick={it.onClick} className={styles.link}>{it.label}</button>
            )}
            {!isLast && <span className={styles.sep}>{separator}</span>}
          </span>
        )
      })}
    </nav>
  )
}
