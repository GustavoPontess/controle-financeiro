/**
 * Pagination — controles de página com elipse. Cor via var(--pontes-*).
 * `p`/`font` override escopado opcional (#122).
 */

import { type ReactNode, type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Pagination.module.css"

export type PontesPaginationProps = {
  p?: Palette
  font?: string
  page: number
  totalPages: number
  onChange: (p: number) => void
  totalLabel?: string
}

export function PontesPagination({
  p, font, page, totalPages, onChange, totalLabel,
}: PontesPaginationProps) {
  const windowSize = 5
  const half = Math.floor(windowSize / 2)
  let start = Math.max(1, page - half)
  const end = Math.min(totalPages, start + windowSize - 1)
  start = Math.max(1, end - windowSize + 1)

  const pages: number[] = []
  for (let n = start; n <= end; n++) pages.push(n)

  const showEllipse = end < totalPages - 1
  const showLast = end < totalPages

  const btn = (n: number, isActive = false, key: string = String(n), label: ReactNode = n) => (
    <button
      key={key}
      type="button"
      onClick={() => onChange(n)}
      className={styles.btn}
      data-active={isActive ? "true" : undefined}
    >
      {label}
    </button>
  )

  return (
    <div className={styles.wrap} style={scopedThemeVars(p, font) as CSSProperties}>
      {btn(Math.max(1, page - 1), false, "prev", "‹")}
      {pages.map((n) => btn(n, n === page))}
      {showEllipse && <span className={styles.ellipse}>…</span>}
      {showLast && btn(totalPages, false, "last")}
      {btn(Math.min(totalPages, page + 1), false, "next", "›")}
      {totalLabel && <span className={styles.total}>{totalLabel}</span>}
    </div>
  )
}
