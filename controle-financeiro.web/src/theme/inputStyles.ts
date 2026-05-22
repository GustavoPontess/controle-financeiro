/**
 * Estilo compartilhado para MUI TextField nas telas da aplicação.
 *
 * `makeInputSx(palette, fontFamily)` — palette-aware.
 * `inputSx` — atalho estático com defaults (usa token brand + Plus Jakarta).
 *   Mantido para compatibilidade com páginas ainda não migradas.
 */
import type { Palette } from '../components/pontes/theme'
import { tokens } from './tokens'

export function makeInputSx(palette: Palette, fontFamily: string) {
  const brand = palette.primary
  return {
    '& .MuiOutlinedInput-root': {
      backgroundColor: palette.surface,
      borderRadius: tokens.radius.lg,
      fontSize: tokens.typography.fontSize.sm,
      fontFamily,
      '& fieldset': { borderColor: palette.border },
      '&:hover fieldset': { borderColor: brand },
      '&.Mui-focused fieldset': { borderColor: brand, borderWidth: '2px' },
    },
    '& .MuiInputLabel-root': { fontFamily },
    '& .MuiInputLabel-root.Mui-focused': { color: brand },
  }
}

/** Atalho estático — para páginas ainda não migradas ao PontesThemeContext. */
export const inputSx = makeInputSx(
  {
    id: '_static', label: '', description: '',
    primary: tokens.color.brand.primary,
    primaryDark: tokens.color.brand.hover,
    primarySoft: '#ccfbf1',
    accent: tokens.color.brand.primary,
    accentSoft: '#ccfbf1',
    text: tokens.color.text.primary,
    textMuted: tokens.color.text.secondary,
    bg: tokens.color.background.page,
    surface: '#fafaf9',
    border: tokens.color.border.default,
    heroFg: '#ffffff',
  },
  "'Plus Jakarta Sans', system-ui, sans-serif"
)
