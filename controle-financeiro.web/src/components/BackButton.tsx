/**
 * BackButton — botão "← Voltar à página X" usado nas telas de auth.
 * Usa PontesThemeContext para cor de hover dinâmica.
 */
import { Box } from '@mui/material'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { tokens } from '../theme/tokens'
import { usePontesTheme } from '../contexts/PontesThemeContext'

interface BackButtonProps {
  to: string
  label?: string
}

export default function BackButton({ to, label = 'Voltar à página inicial' }: BackButtonProps) {
  const { palette, font } = usePontesTheme()
  const brand = palette.primary

  return (
    <Box
      component={Link}
      to={to}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75,
        color: tokens.color.text.secondary,
        textDecoration: 'none',
        fontSize: tokens.typography.fontSize.sm,
        fontFamily: font.family,
        fontWeight: 500,
        mb: 3,
        px: 1.5, py: 0.75,
        borderRadius: tokens.radius.md,
        border: `1px solid ${tokens.color.border.default}`,
        backgroundColor: '#fafaf9',
        transition: 'all 0.15s',
        '&:hover': { color: brand, borderColor: brand, backgroundColor: `${brand}08` },
      }}
    >
      <ArrowLeft size={16} />
      {label}
    </Box>
  )
}
