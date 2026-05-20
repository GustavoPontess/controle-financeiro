/**
 * Breadcrumb — trilha de navegação.
 * Último item é o atual (negrito, sem link).
 */

import type { Palette } from "./theme"

export type PontesBreadcrumbItem = {
  label: string
  href?: string
  onClick?: () => void
}

export type PontesBreadcrumbProps = {
  p: Palette
  font: string
  items: PontesBreadcrumbItem[]
  separator?: React.ReactNode
}

export function PontesBreadcrumb({ p, font, items, separator = "/" }: PontesBreadcrumbProps) {
  return (
    <nav
      aria-label="breadcrumb"
      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontFamily: font, flexWrap: "wrap" }}
    >
      {items.map((it, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {isLast ? (
              <span style={{ color: p.text, fontWeight: 600 }}>{it.label}</span>
            ) : it.href ? (
              <a href={it.href} style={{ color: p.textMuted, textDecoration: "none" }}>{it.label}</a>
            ) : (
              <button
                type="button"
                onClick={it.onClick}
                style={{ background: "transparent", border: "none", color: p.textMuted, cursor: "pointer", padding: 0, fontFamily: font, fontSize: 14 }}
              >{it.label}</button>
            )}
            {!isLast && <span style={{ color: p.textMuted }}>{separator}</span>}
          </span>
        )
      })}
    </nav>
  )
}
