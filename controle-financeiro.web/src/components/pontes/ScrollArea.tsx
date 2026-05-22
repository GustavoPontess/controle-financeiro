/**
 * PontesScrollArea — container rolável isolado com scrollbar overlay.
 * Pra modal, drawer, lista interna. Conteúdo dentro de viewport próprio.
 *
 * Pra scroll da PÁGINA inteira, use o hook `usePontesBodyScrollbar` (mantém
 * window.scroll + position:fixed funcionando).
 */

import { useEffect, type ReactNode, type CSSProperties } from "react"
import { OverlayScrollbarsComponent } from "overlayscrollbars-react"
import "overlayscrollbars/overlayscrollbars.css"
import { ensurePontesOverlayStyles } from "./overlayStyles"
import type { Palette } from "./theme"

export type PontesScrollAreaProps = {
  p?: Palette
  children: ReactNode
  style?: CSSProperties
  className?: string
  autoHide?: "scroll" | "leave" | "move" | "never"
}

export function PontesScrollArea({
  p, children, style, className, autoHide = "leave",
}: PontesScrollAreaProps) {
  useEffect(ensurePontesOverlayStyles, [])
  const cssVars = { ["--pontes-os-thumb" as never]: p ? p.primary : "var(--pontes-primary)" } as CSSProperties

  return (
    <OverlayScrollbarsComponent
      className={className}
      style={{ ...cssVars, ...style }}
      options={{
        scrollbars: { autoHide, autoHideDelay: 600, theme: "os-theme-pontes" },
        overflow: { x: "hidden", y: "scroll" },
      }}
      defer
    >
      {children}
    </OverlayScrollbarsComponent>
  )
}
