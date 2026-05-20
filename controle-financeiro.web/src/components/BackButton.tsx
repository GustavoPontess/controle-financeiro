/**
 * BackButton — botão "← Voltar à página X" usado nas telas de auth.
 * Estilizado como pill outline com hover teal.
 */
import { Box } from '@mui/material'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { tokens } from '../theme/tokens'

const BRAND = tokens.color.brand.primary

interface BackButtonProps {
  to: string
  label?: string
}

export default function BackButton({ to, label = 'Voltar à página inicial' }: BackButtonProps) {
  return (
    <Box
      component={Link}
      to={to}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75,
        color: tokens.color.text.secondary,
        textDecoration: 'none',
        fontSize: tokens.typography.fontSize.sm,
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        fontWeight: 500,
        mb: 3,
        px: 1.5, py: 0.75,
        borderRadius: tokens.radius.md,
        border: `1px solid ${tokens.color.border.default}`,
        backgroundColor: '#fafaf9',
        transition: 'all 0.15s',
        '&:hover': { color: BRAND, borderColor: BRAND, backgroundColor: `${BRAND}08` },
      }}
    >
      <ArrowLeft size={16} />
      {label}
    </Box>
  )
}
