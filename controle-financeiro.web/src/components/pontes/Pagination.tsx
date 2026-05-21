/**
 * Pagination — controles de página com elipse no meio.
 * Sempre mostra: prev | 1 | 2 | 3 | ... | last | next + total info opcional.
 */

import { useEffect } from "react"
import { ensurePontesGlobalStyles } from "./_globalStyles"
import { adjustColor, type Palette } from "./theme"

export type PontesPaginationProps = {
  p: Palette
  font: string
  page: number
  totalPages: number
  onChange: (p: number) => void
  totalLabel?: string
}

export function PontesPagination({
  p, font, page, totalPages, onChange, totalLabel,
}: PontesPaginationProps) {
  useEffect(ensurePontesGlobalStyles, [])
  // Janela: mostra 5 páginas ao redor da atual.
  const windowSize = 5
  const half = Math.floor(windowSize / 2)
  let start = Math.max(1, page - half)
  const end = Math.min(totalPages, start + windowSize - 1)
  start = Math.max(1, end - windowSize + 1)

  const pages: number[] = []
  for (let n = start; n <= end; n++) pages.push(n)

  const showEllipse = end < totalPages - 1
  const showLast = end < totalPages

  const btn = (n: number, isActive = false, key: string = String(n), label: React.ReactNode = n) => (
    <button
      key={key}
      type="button"
      onClick={() => onChange(n)}
      className="pontes-clickable pontes-no-lift"
      data-pontes-variant={isActive ? "primary" : "ghost"}
      style={{
        background: isActive ? p.primary : "transparent",
        color: isActive ? p.heroFg : p.text,
        border: `1px solid ${isActive ? p.primary : p.border}`,
        width: 36, height: 36, borderRadius: 8,
        fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font,
        ["--pontes-hover-bg" as never]: isActive ? adjustColor(p.primary, -0.08) : p.primarySoft,
        ["--pontes-hover-text" as never]: isActive ? p.heroFg : p.primary,
        ["--pontes-hover-border" as never]: p.primary,
        ["--pontes-active-bg" as never]: p.primary,
        ["--pontes-active-text" as never]: p.heroFg,
        ["--pontes-active-border" as never]: p.primary,
      }}
    >{label}</button>
  )

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: font, flexWrap: "wrap" }}>
      {btn(Math.max(1, page - 1), false, "prev", "‹")}
      {pages.map((n) => btn(n, n === page))}
      {showEllipse && <span style={{ color: p.textMuted, padding: "0 8px" }}>…</span>}
      {showLast && btn(totalPages, false, "last")}
      {btn(Math.min(totalPages, page + 1), false, "next", "›")}
      {totalLabel && <span style={{ color: p.textMuted, fontSize: 13, marginLeft: 14 }}>{totalLabel}</span>}
    </div>
  )
}
