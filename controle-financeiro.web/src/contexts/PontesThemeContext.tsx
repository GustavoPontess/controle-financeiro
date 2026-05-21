/**
 * PontesThemeContext — contexto global de paleta + fonte.
 *
 * Stub para a issue #90 (personalização in-app).
 * Quando #90 for implementada:
 *   - Adicionar UI de seleção (drawer/modal)
 *   - Persistência já está aqui (localStorage)
 *   - Apenas plugar o switcher
 *
 * Uso:
 *   const { palette, font } = usePontesTheme()
 *   const { palette, font, setPalette, setFont } = usePontesTheme()
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import {
  type Palette,
  type FontOption,
  palettes,
  fonts,
  defaultPalette,
  defaultFont,
} from '../components/pontes/theme'

const LS_PALETTE = 'pontes_palette_id'
const LS_FONT = 'pontes_font_id'

function loadPalette(): Palette {
  try {
    const id = localStorage.getItem(LS_PALETTE)
    return palettes.find((p) => p.id === id) ?? defaultPalette
  } catch {
    return defaultPalette
  }
}

function loadFont(): FontOption {
  try {
    const id = localStorage.getItem(LS_FONT)
    return fonts.find((f) => f.id === id) ?? defaultFont
  } catch {
    return defaultFont
  }
}

type PontesThemeContextValue = {
  palette: Palette
  font: FontOption
  setPalette: (p: Palette) => void
  setFont: (f: FontOption) => void
}

const PontesThemeContext = createContext<PontesThemeContextValue | null>(null)

export function PontesThemeProvider({ children }: { children: ReactNode }) {
  const [palette, setPaletteState] = useState<Palette>(loadPalette)
  const [font, setFontState] = useState<FontOption>(loadFont)

  const setPalette = useCallback((p: Palette) => {
    setPaletteState(p)
    try { localStorage.setItem(LS_PALETTE, p.id) } catch { /* noop */ }
  }, [])

  const setFont = useCallback((f: FontOption) => {
    setFontState(f)
    try { localStorage.setItem(LS_FONT, f.id) } catch { /* noop */ }
  }, [])

  return (
    <PontesThemeContext.Provider value={{ palette, font, setPalette, setFont }}>
      {children}
    </PontesThemeContext.Provider>
  )
}

export function usePontesTheme(): PontesThemeContextValue {
  const ctx = useContext(PontesThemeContext)
  if (!ctx) throw new Error('usePontesTheme must be used inside PontesThemeProvider')
  return ctx
}
