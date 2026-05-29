/**
 * Table — tabela com header, rows e ações. Cor via var(--pontes-*).
 * Alinhamento/width por coluna ficam inline (por-instância). `p`/`font` escopado.
 *
 * Paginação:
 *   `pagination` ativa o rodapé padrão do DS (page-size + nav + range).
 *   Modo "uncontrolled" (default): a tabela gerencia page/pageSize por estado
 *   interno. Defaults: pageSize=25, opções [10, 25, 50, 100], hard cap 100.
 *   Modo "controlled": passe page/onPageChange/pageSize/onPageSizeChange.
 */

import { useEffect, useState, type ReactNode, type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Table.module.css"
import {
  PontesTablePagination, PONTES_TABLE_PAGE_SIZE_DEFAULT, PONTES_TABLE_PAGE_SIZES,
} from "./TablePagination"

export type PontesTableColumn<R> = {
  key: string
  header: ReactNode
  /** Alinhamento da célula. */
  align?: "left" | "right" | "center"
  render: (row: R, idx: number) => ReactNode
  /** CSS width. */
  width?: string | number
}

export type PontesTablePaginationConfig = {
  /** Ativa paginação. `true` usa defaults; objeto permite tunar. */
  enabled?: boolean
  /** Default 25. Hard cap 100. */
  pageSize?: number
  /** Default [10, 25, 50, 100]. */
  pageSizes?: readonly number[]
  /** Controlled mode. Omitir = uncontrolled. */
  page?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
}

export type PontesTableProps<R> = {
  p?: Palette
  font?: string
  title?: string
  subtitle?: string
  toolbar?: ReactNode
  columns: PontesTableColumn<R>[]
  rows: R[]
  /** Footer custom — sobrescreve a paginação se ambos forem passados. */
  footer?: ReactNode
  /** Identificador único por linha (default: index). */
  rowKey?: (row: R, idx: number) => string | number
  emptyMessage?: string
  /** Passe `true` para ativar paginação com defaults, ou objeto para tunar. */
  pagination?: boolean | PontesTablePaginationConfig
}

function resolvePaginationConfig(
  pagination: boolean | PontesTablePaginationConfig | undefined,
): PontesTablePaginationConfig | null {
  if (!pagination) return null
  if (pagination === true) return { enabled: true }
  return { enabled: true, ...pagination }
}

export function PontesTable<R>({
  p, font, title, subtitle, toolbar, columns, rows, footer, rowKey, emptyMessage, pagination,
}: PontesTableProps<R>) {
  const config = resolvePaginationConfig(pagination)
  const initialSize = config?.pageSize ?? PONTES_TABLE_PAGE_SIZE_DEFAULT

  // Uncontrolled state. Em modo controlado, esses estados ficam ignorados.
  const [innerPage, setInnerPage] = useState(1)
  const [innerSize, setInnerSize] = useState(initialSize)

  const isControlled = config?.page != null
  const page = isControlled ? (config!.page as number) : innerPage
  const pageSize = config?.onPageSizeChange ? initialSize : innerSize

  // Quando filtro encolhe `rows.length`, volta pra página 1 (uncontrolled).
  useEffect(() => {
    if (!isControlled) setInnerPage(1)
  }, [rows.length, pageSize, isControlled])

  const visibleRows = config?.enabled
    ? rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)
    : rows

  return (
    <div className={styles.wrap} style={scopedThemeVars(p, font) as CSSProperties}>
      {(title || subtitle || toolbar) && (
        <div className={styles.head}>
          <div>
            {title && <div className={styles.title}>{title}</div>}
            {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
          </div>
          {toolbar && <div className={styles.toolbar}>{toolbar}</div>}
        </div>
      )}

      <table className={styles.table}>
        <thead>
          <tr className={styles.theadRow}>
            {columns.map((c) => (
              <th key={c.key} className={styles.th} style={{ textAlign: c.align ?? "left", width: c.width }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>{emptyMessage ?? "Sem dados"}</td>
            </tr>
          ) : visibleRows.map((row, i) => {
            // idx absoluto pra render() respeitar a posição na lista completa.
            const absoluteIdx = config?.enabled ? (page - 1) * pageSize + i : i
            return (
              <tr key={rowKey?.(row, absoluteIdx) ?? absoluteIdx} className={styles.row}>
                {columns.map((c) => (
                  <td key={c.key} className={styles.td} style={{ textAlign: c.align ?? "left" }}>
                    {c.render(row, absoluteIdx)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>

      {footer
        ? <div className={styles.footer}>{footer}</div>
        : config?.enabled && (
          <PontesTablePagination
            total={rows.length}
            page={page}
            pageSize={pageSize}
            onPageChange={(np) => {
              if (isControlled) config!.onPageChange?.(np)
              else setInnerPage(np)
            }}
            onPageSizeChange={(ns) => {
              if (config!.onPageSizeChange) config!.onPageSizeChange(ns)
              else { setInnerSize(ns); setInnerPage(1) }
            }}
            pageSizes={config!.pageSizes ?? PONTES_TABLE_PAGE_SIZES}
          />
        )}
    </div>
  )
}
