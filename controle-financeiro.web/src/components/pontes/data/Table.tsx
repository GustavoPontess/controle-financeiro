/**
 * Table — tabela com header, rows e ações. Cor via var(--pontes-*).
 * Alinhamento/width por coluna ficam inline (por-instância). `p`/`font` escopado.
 */

import { type ReactNode, type CSSProperties } from "react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Table.module.css"

export type PontesTableColumn<R> = {
  key: string
  header: ReactNode
  /** Alinhamento da célula. */
  align?: "left" | "right" | "center"
  render: (row: R, idx: number) => ReactNode
  /** CSS width. */
  width?: string | number
}

export type PontesTableProps<R> = {
  p?: Palette
  font?: string
  title?: string
  subtitle?: string
  toolbar?: ReactNode
  columns: PontesTableColumn<R>[]
  rows: R[]
  footer?: ReactNode
  /** Identificador único por linha (default: index). */
  rowKey?: (row: R, idx: number) => string | number
  emptyMessage?: string
}

export function PontesTable<R>({
  p, font, title, subtitle, toolbar, columns, rows, footer, rowKey, emptyMessage,
}: PontesTableProps<R>) {
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
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>{emptyMessage ?? "Sem dados"}</td>
            </tr>
          ) : rows.map((row, i) => (
            <tr key={rowKey?.(row, i) ?? i} className={styles.row}>
              {columns.map((c) => (
                <td key={c.key} className={styles.td} style={{ textAlign: c.align ?? "left" }}>
                  {c.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  )
}
