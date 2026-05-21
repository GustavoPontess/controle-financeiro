/**
 * usePontesBodyScrollbar — overlay scrollbar no scroll da página inteira (body).
 *
 * Mantém window.scroll, eventos de scroll e position:fixed funcionando
 * (navbar fixed continua ok). Use nas páginas full-screen.
 *
 * Separado de ScrollArea.tsx pra não quebrar react-refresh (arquivo de hook puro).
 */

import { useEffect } from "react"
import { OverlayScrollbars } from "overlayscrollbars"
import "overlayscrollbars/overlayscrollbars.css"
import { ensurePontesOverlayStyles } from "./overlayStyles"

/**
 * Aplica scrollbar overlay no body (scroll da página). Cor do thumb segue a paleta.
 * Barra sempre visível (autoHide never).
 * @param thumbHex cor do thumb (recomendado p.accent pra destaque)
 */
export function usePontesBodyScrollbar(thumbHex: string): void {
  useEffect(() => {
    ensurePontesOverlayStyles()
    document.documentElement.style.setProperty("--pontes-os-thumb", thumbHex)

    const inst = OverlayScrollbars(
      { target: document.body, cancel: { nativeScrollbarsOverlaid: false } },
      {
        scrollbars: { autoHide: "never", theme: "os-theme-pontes" },
        overflow: { x: "hidden", y: "scroll" },
      }
    )
    return () => { inst.destroy() }
  }, [thumbHex])
}
