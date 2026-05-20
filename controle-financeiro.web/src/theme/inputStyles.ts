/**
 * Estilo compartilhado para MUI TextField nas telas da aplicação.
 * Referencia tokens do DS — não hardcode cores aqui.
 */
import { tokens } from './tokens'

const BRAND = tokens.color.brand.primary

export const inputSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#fafaf9',
    borderRadius: tokens.radius.lg,
    fontSize: tokens.typography.fontSize.sm,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    '& fieldset': { borderColor: tokens.color.border.default },
    '&:hover fieldset': { borderColor: BRAND },
    '&.Mui-focused fieldset': { borderColor: BRAND, borderWidth: '2px' },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: BRAND },
}
