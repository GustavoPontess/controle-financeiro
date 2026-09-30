/**
 * TablePagination — rodapé padrão de tabela com page-size + navegação + range.
 * Pode ser usado standalone (qualquer tabela custom) ou via `pagination`
 * prop do PontesTable.
 *
 * Limites do projeto: opções [10, 25, 50, 100], default 25, hard cap 100.
 * Por que o cap: render de >100 linhas vira jank visual e dói no mobile.
 * Quem precisar de mais usa filtro/busca, não pagesize maior.
 */

import { type CSSProperties } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { scopedThemeVars, type Palette } from "../theme"
import { PontesSelect } from "../form/Select"
import styles from "./TablePagination.module.css"

/** Opções padrão do projeto. Importe se quiser estender/reusar. */
export const PONTES_TABLE_PAGE_SIZES = [10, 25, 50, 100] as const
export const PONTES_TABLE_PAGE_SIZE_DEFAULT = 10
/** Hard cap — qualquer valor maior é clampado pra cá. */
export const PONTES_TABLE_PAGE_SIZE_MAX = 100

// Páginas a exibir com reticências: 1 … (atual±1) … último — permite pular pra qualquer página.
function buildPages(current: number, total: number): (number | "…")[] {
  const delta = 1
  const lo = Math.max(1, current - delta)
  const hi = Math.min(total, current + delta)
  const nums: number[] = []
  for (let i = lo; i <= hi; i++) nums.push(i)
  const out: (number | "…")[] = []
  if (nums[0] > 1) { out.push(1); if (nums[0] > 2) out.push("…") }
  out.push(...nums)
  if (nums[nums.length - 1] < total) { if (nums[nums.length - 1] < total - 1) out.push("…"); out.push(total) }
  return out
}

export type PontesTablePaginationProps = {
  p?: Palette
  font?: string
  /** Total de linhas (já filtrado). */
  total: number
  /** Página 1-based atual. */
  page: number
  /** Linhas por página atual. */
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  /** Default: [10, 25, 50, 100]. Valores > 100 são removidos. */
  pageSizes?: readonly number[]
  /** Default: "registros". Singular: "registro". */
  itemLabel?: string
  itemLabelSingular?: string
}

export function PontesTablePagination({
  p, font, total, page, pageSize, onPageChange, onPageSizeChange,
  pageSizes = PONTES_TABLE_PAGE_SIZES,
  itemLabel = "registros", itemLabelSingular = "registro",
}: PontesTablePaginationProps) {
  // Higieniza opções e respeita o hard cap.
  const options = pageSizes
    .filter((n) => n > 0 && n <= PONTES_TABLE_PAGE_SIZE_MAX)
    .map((n) => ({ value: String(n), label: String(n) }))

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, total)
  const label = total === 1 ? itemLabelSingular : itemLabel

  return (
    <div className={styles.wrap} style={scopedThemeVars(p, font) as CSSProperties}>
      <div className={styles.sizeGroup}>
        <span className={styles.sizeLabel}>Linhas por página</span>
        <div className={styles.sizeSelect}>
          <PontesSelect
            value={String(pageSize)}
            onChange={(v) => onPageSizeChange(Number(v))}
            options={options}
            searchable={false}
          />
        </div>
      </div>
      <div className={styles.range}>
        {total === 0 ? `0 ${label}` : `${from}–${to} de ${total} ${label}`}
      </div>
      <div className={styles.nav}>
        <button
          type="button"
          className={styles.navBtn}
          aria-label="Página anterior"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          <ChevronLeft size={16} strokeWidth={2.5} />
        </button>
        {buildPages(safePage, totalPages).map((it, i) =>
          it === "…" ? (
            <span key={`e${i}`} className={styles.ellipse}>…</span>
          ) : (
            <button
              key={it}
              type="button"
              className={styles.pageBtn}
              data-active={it === safePage ? "true" : undefined}
              aria-current={it === safePage ? "page" : undefined}
              onClick={() => onPageChange(it)}
            >
              {it}
            </button>
          )
        )}
        <button
          type="button"
          className={styles.navBtn}
          aria-label="Próxima página"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          <ChevronRight size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
