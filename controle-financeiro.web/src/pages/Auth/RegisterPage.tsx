import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import { Eye, EyeOff } from 'lucide-react'
import { PontesButton, PontesField, PontesInput, PontesAlert, PontesProgress } from '@/components/pontes'
import BackButton from '../../components/BackButton'
import { useAuth } from '../../hooks/useAuth'
import { usePontesTheme } from '../../contexts/PontesThemeContext'
import { getSenhaRequisitos, getSenhaForca } from '../../utils/passwordPolicy'
import { tokens } from '../../theme/tokens'
import Logo from '../../components/Logo/Logo'

function PasswordStrengthIndicator({ senha }: { senha: string }) {
  const { palette, font } = usePontesTheme()
  if (!senha) return null

  const requisitos = getSenhaRequisitos(senha)
  const forca = getSenhaForca(requisitos)
  const progresso = (forca / requisitos.length) * 100

  const cor =
    forca <= 2
      ? tokens.color.status.error.main
      : forca <= 3
      ? tokens.color.status.warning.main
      : forca === 4
      ? tokens.color.status.info.main
      : tokens.color.status.success.main

  return (
    <div style={{ marginTop: -8 }}>
      <PontesProgress
        p={palette}
        font={font.family}
        value={progresso}
        color={cor}
        height={3}
        showValue={false}
      />
      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
        {requisitos.map((r) => (
          <span
            key={r.label}
            style={{
              fontSize: 11,
              color: r.ok ? tokens.color.status.success.main : tokens.color.text.disabled,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: font.family,
            }}
          >
            {r.ok ? '✓' : '○'} {r.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const { palette, font } = usePontesTheme()

  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const BRAND = palette.primary
  const BRAND_DARK = palette.primaryDark

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('As senhas não conferem')
      return
    }

    const requisitos = getSenhaRequisitos(password)
    const pendentes = requisitos.filter((r) => !r.ok).map((r) => r.label)
    if (pendentes.length > 0) {
      setError('Senha não atende aos requisitos: ' + pendentes.join('; '))
      return
    }

    setIsLoading(true)
    try {
      await register(email, nome, dataNascimento || null, password)
      navigate('/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex' }}>
      {/* ── PAINEL ESQUERDO — brand ───────────────────────────────────── */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          width: '48%',
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: '48px',
          background: `linear-gradient(150deg, ${BRAND} 0%, ${BRAND_DARK} 100%)`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* grade decorativa */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <defs>
            <pattern id="reg-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#reg-grid)" />
        </svg>

        <Box sx={{
          position: 'absolute', bottom: '-10%', left: '-10%',
          width: '55%', height: '55%', borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box
            component={Link}
            to="/"
            sx={{
              display: 'inline-flex',
              textDecoration: 'none',
              opacity: 1,
              transition: 'opacity 0.2s, transform 0.2s',
              '&:hover': { opacity: 0.8, transform: 'scale(1.03)' },
            }}
          >
            <Logo color="#ffffff" size={32} variant="full" />
          </Box>
        </Box>

        {/* Headline */}
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography
            sx={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: '40px',
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              mb: 2,
            }}
          >
            Comece grátis.{' '}
            <Box component="span" sx={{ opacity: 0.85 }}>Cresça com sua família.</Box>
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px', lineHeight: 1.55, mb: 4, fontFamily: font.family }}>
            Crie sua conta em 2 minutos. Sem cartão, sem fidelidade.
          </Typography>

          {/* Planos resumidos */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              { plan: 'Solo', price: 'Grátis', desc: '1 conta + 1 cartão, lançamentos ilimitados' },
              { plan: 'Família', price: 'R$ 15/mês', desc: 'Até 6 membros, rateio e aprovação' },
              { plan: 'Contador', price: 'R$ 39/mês', desc: 'Multi-cliente, relatórios contábeis' },
            ].map((p) => (
              <Box key={p.plan} sx={{
                display: 'flex', alignItems: 'center', gap: 2,
                background: 'rgba(255,255,255,0.08)',
                borderRadius: tokens.radius.lg,
                p: '12px 16px',
                border: '1px solid rgba(255,255,255,0.12)',
              }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ color: '#ffffff', fontSize: '13px', fontWeight: 700, fontFamily: font.family }}>{p.plan}</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontFamily: font.family }}>{p.desc}</Typography>
                </Box>
                <Typography sx={{ color: '#ffffff', fontSize: '13px', fontWeight: 700, fontFamily: font.family, flexShrink: 0 }}>{p.price}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Stats */}
        <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', gap: 3 }}>
          {[
            { n: '98%', l: 'casais recomendam' },
            { n: '< 2min', l: 'pra criar conta' },
            { n: '10×', l: 'mais rápido' },
          ].map((s) => (
            <Box key={s.l}>
              <Typography sx={{ color: '#ffffff', fontSize: '22px', fontWeight: 800, fontFamily: font.family, letterSpacing: '-0.02em' }}>{s.n}</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontFamily: font.family }}>{s.l}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── PAINEL DIREITO — form ─────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 3, sm: 5 },
          backgroundColor: palette.surface,
          overflowY: 'auto',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: '400px', py: 2 }}>
          {/* Voltar para homepage */}
          <BackButton to="/" />

          {/* Logo mobile */}
          <Box sx={{ display: { md: 'none' }, mb: 4, textAlign: 'center' }}>
            <Box
              component={Link}
              to="/"
              sx={{
                display: 'inline-flex',
                textDecoration: 'none',
                opacity: 1,
                transition: 'opacity 0.2s, transform 0.2s',
                '&:hover': { opacity: 0.75, transform: 'scale(1.03)' },
              }}
            >
              <Logo color={BRAND} size={28} variant="full" />
            </Box>
          </Box>

          {/* Header */}
          <Box sx={{ mb: 3 }}>
            <Typography
              sx={{
                fontFamily: font.family,
                fontSize: '28px',
                fontWeight: 700,
                color: palette.text,
                letterSpacing: '-0.02em',
                mb: 0.5,
              }}
            >
              Criar conta grátis
            </Typography>
            <Typography sx={{ fontSize: tokens.typography.fontSize.sm, color: palette.textMuted, fontFamily: font.family }}>
              Já tem conta?{' '}
              <Link to="/auth/login" style={{ color: BRAND, textDecoration: 'none', fontWeight: 600 }}>
                Fazer login
              </Link>
            </Typography>
          </Box>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <PontesAlert font={font.family} tone="error">{error}</PontesAlert>
            )}

            <PontesField p={palette} font={font.family} label="Nome completo" htmlFor="reg-nome" required>
              <PontesInput
                p={palette}
                font={font.family}
                id="reg-nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                autoComplete="name"
              />
            </PontesField>

            <PontesField p={palette} font={font.family} label="E-mail" htmlFor="reg-email" required>
              <PontesInput
                p={palette}
                font={font.family}
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </PontesField>

            <PontesField p={palette} font={font.family} label="Data de nascimento" htmlFor="reg-nascimento">
              <PontesInput
                p={palette}
                font={font.family}
                id="reg-nascimento"
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                autoComplete="bday"
              />
            </PontesField>

            <PontesField p={palette} font={font.family} label="Senha" htmlFor="reg-senha" required>
              <PontesInput
                p={palette}
                font={font.family}
                id="reg-senha"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                iconEnd={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    data-testid="toggle-senha"
                    tabIndex={-1}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, color: palette.textMuted }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
            </PontesField>

            <PasswordStrengthIndicator senha={password} />

            <PontesField p={palette} font={font.family} label="Confirmar senha" htmlFor="reg-confirmar" required>
              <PontesInput
                p={palette}
                font={font.family}
                id="reg-confirmar"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                iconEnd={
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    data-testid="toggle-confirmar"
                    tabIndex={-1}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, color: palette.textMuted }}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
            </PontesField>

            <PontesButton
              p={palette}
              font={font.family}
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              disabled={isLoading}
            >
              Criar conta grátis
            </PontesButton>
          </form>

          {/* Footer */}
          <Typography
            sx={{
              mt: 3, textAlign: 'center',
              fontSize: tokens.typography.fontSize.xs,
              color: tokens.color.text.disabled,
              fontFamily: font.family,
            }}
          >
            Ao criar sua conta você concorda com os{' '}
            <Box component="span" sx={{ color: palette.textMuted }}>Termos de Uso</Box>
            {' '}e{' '}
            <Box component="span" sx={{ color: palette.textMuted }}>Política de Privacidade</Box>.
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
