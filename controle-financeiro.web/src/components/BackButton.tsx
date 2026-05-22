/**
 * BackButton — botão "← Voltar à página X" usado nas telas de auth.
 * Usa usePontesTheme (provider global) para cor de hover dinâmica.
 * Sem dependência de MUI — renderiza Link do React Router com estilos inline.
 */
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { usePontesTheme } from '@/components/pontes'

interface BackButtonProps {
  to: string
  label?: string
}

export default function BackButton({ to, label = 'Voltar à página inicial' }: BackButtonProps) {
  const { palette, font } = usePontesTheme()

  return (
    <Link
      to={to}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        color: '#777573',
        textDecoration: 'none',
        fontSize: 13,
        fontFamily: font,
        fontWeight: 500,
        marginBottom: 24,
        padding: '6px 12px',
        borderRadius: 8,
        border: '1px solid #e4e1de',
        backgroundColor: '#fafaf9',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.color = palette.primary
        el.style.borderColor = palette.primary
        el.style.backgroundColor = `${palette.primary}08`
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.color = '#777573'
        el.style.borderColor = '#e4e1de'
        el.style.backgroundColor = '#fafaf9'
      }}
    >
      <ArrowLeft size={16} />
      {label}
    </Link>
  )
}
