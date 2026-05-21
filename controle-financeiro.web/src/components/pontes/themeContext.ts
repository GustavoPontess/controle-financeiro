/**
 * themeContext — context + hook do tema Pontes global.
 * Separado do ThemeProvider.tsx pra não quebrar react-refresh.
 */

import { createContext, useContext } from "react"
import type { Palette, FontOption } from "./theme"

export type PontesThemeValue = {
  palette: Palette
  font: string
  fontOption: FontOption
  paletteId: string
  fontId: string
  setPaletteId: (id: string) => void
  setFontId: (id: string) => void
  palettes: Palette[]
  fonts: FontOption[]
}

export const PontesThemeCtx = createContext<PontesThemeValue | null>(null)

/** Hook global de tema Pontes. Lança se usado fora do provider. */
export function usePontesTheme(): PontesThemeValue {
  const ctx = useContext(PontesThemeCtx)
  if (!ctx) throw new Error("usePontesTheme precisa estar dentro de <PontesThemeProvider>")
  return ctx
}
