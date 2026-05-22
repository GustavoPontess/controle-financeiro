/**
 * Table — tabela com header (cards/labels), rows e ações.
 * Renderiza customizável via prop `columns` + `rows`.
 */

import { type ReactNode } from "react"
import type { Palette } from "../theme"

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
  p: Palette
  font: string
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
    <div style={{
      background: p.surface, border: `1px solid ${p.border}`,
      borderRadius: 14, overflow: "hidden", fontFamily: font,
    }}>
      {(title || subtitle || toolbar) && (
        <div style={{
          padding: "14px 20px", borderBottom: `1px solid ${p.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            {title && <div style={{ fontSize: 14, fontWeight: 700, color: p.text }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 11, color: p.textMuted }}>{subtitle}</div>}
          </div>
          {toolbar && <div style={{ display: "flex", gap: 8 }}>{toolbar}</div>}
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: p.bg, borderBottom: `1px solid ${p.border}` }}>
            {columns.map((c) => (
              <th key={c.key} style={{
                textAlign: c.align ?? "left", padding: "12px 16px",
                fontSize: 11, fontWeight: 700, color: p.textMuted,
                letterSpacing: "0.08em", textTransform: "uppercase",
                width: c.width,
              }}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: 32, textAlign: "center", color: p.textMuted, fontSize: 13 }}>
                {emptyMessage ?? "Sem dados"}
              </td>
            </tr>
          ) : rows.map((row, i) => (
            <tr key={rowKey?.(row, i) ?? i}
              style={{ borderBottom: i < rows.length - 1 ? `1px solid ${p.border}` : "none" }}>
              {columns.map((c) => (
                <td key={c.key} style={{
                  padding: "12px 16px", color: p.text,
                  textAlign: c.align ?? "left",
                }}>
                  {c.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {footer && (
        <div style={{
          padding: "12px 20px", borderTop: `1px solid ${p.border}`,
          background: p.bg, fontSize: 12, color: p.textMuted,
        }}>
          {footer}
        </div>
      )}
    </div>
  )
}
