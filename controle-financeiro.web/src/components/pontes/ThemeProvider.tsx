/**
 * PontesThemeProvider — paleta + fonte GLOBAL do produto, persistida.
 *
 * Fonte da verdade da personalização (#90). Envolve a app inteira no root.
 * Qualquer página (site, auth, internas, settings) lê via `usePontesTheme()`.
 *
 * Persiste a escolha em localStorage → sobrevive reload e vale em todas as telas.
 * Efeitos colaterais centralizados: injeta a fonte escolhida, aplica scrollbar
 * (cor accent) + fundo do body conforme a paleta.
 */

import { useEffect, useState, type ReactNode } from "react"
import { palettes, fonts } from "./theme"
import { applyPontesScrollbar } from "./_globalStyles"
import { PontesThemeCtx, type PontesThemeValue } from "./themeContext"

const LS_PALETTE = "pontes.paletteId"
const LS_FONT = "pontes.fontId"

function readLS(key: string, fallback: string): string {
  if (typeof localStorage === "undefined") return fallback
  return localStorage.getItem(key) ?? fallback
}

export function PontesThemeProvider({ children }: { children: ReactNode }) {
  const [paletteId, setPaletteIdState] = useState(() => readLS(LS_PALETTE, "A"))
  const [fontId, setFontIdState] = useState(() => readLS(LS_FONT, "inter"))

  const palette = palettes.find((x) => x.id === paletteId) ?? palettes[0]
  const fontOption = fonts.find((x) => x.id === fontId) ?? fonts[0]

  const setPaletteId = (id: string) => {
    setPaletteIdState(id)
    try { localStorage.setItem(LS_PALETTE, id) } catch { /* ignore */ }
  }
  const setFontId = (id: string) => {
    setFontIdState(id)
    try { localStorage.setItem(LS_FONT, id) } catch { /* ignore */ }
  }

  // Injeta a fonte escolhida (uma vez por fonte).
  useEffect(() => {
    const linkId = `pontes-font-${fontOption.id}`
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link")
      link.id = linkId; link.rel = "stylesheet"; link.href = fontOption.url
      document.head.appendChild(link)
    }
  }, [fontOption])

  // Scrollbar (accent) + fundo do body seguem a paleta — global.
  useEffect(() => {
    applyPontesScrollbar(palette.accent, palette.bg)
  }, [palette])

  const value: PontesThemeValue = {
    palette, font: fontOption.family, fontOption,
    paletteId, fontId, setPaletteId, setFontId,
    palettes, fonts,
  }

  return <PontesThemeCtx.Provider value={value}>{children}</PontesThemeCtx.Provider>
}
