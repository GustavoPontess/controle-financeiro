import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Box, TextField, Typography, Alert, CircularProgress, InputAdornment, IconButton } from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import CustomButton from '../../components/CustomButton'
import { useAuth } from '../../hooks/useAuth'
import { tokens } from '../../theme/tokens'
import Logo from '../../components/Logo/Logo'

const BRAND = tokens.color.brand.primary
const BRAND_DARK = tokens.color.brand.hover

const inputSx = {
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

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login')
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
            <pattern id="auth-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-grid)" />
        </svg>

        {/* blob decorativo */}
        <Box sx={{
          position: 'absolute', top: '-15%', right: '-15%',
          width: '60%', height: '60%', borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Logo color="#ffffff" size={32} variant="full" />
        </Box>

        {/* Headline + features */}
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography
            sx={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: '42px',
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              mb: 2,
            }}
          >
            Finanças em família,{' '}
            <Box component="span" sx={{ opacity: 0.85 }}>sem briga.</Box>
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px', lineHeight: 1.55, mb: 4, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
            Um lugar só para você, seu parceiro e seu contador. Rateio claro, aprovação de despesas, visão completa.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {[
              'Rateio explícito — 50/50, % ou valor fixo',
              'Aprovação de despesa em 1 toque',
              'Conexão com Open Finance (em breve)',
            ].map((item) => (
              <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Box component="span" sx={{ color: '#ffffff', fontSize: '11px', fontWeight: 700 }}>✓</Box>
                </Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
                  {item}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Testimonial */}
        <Box sx={{
          position: 'relative', zIndex: 1,
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(8px)',
          borderRadius: tokens.radius.xl,
          p: 3,
          border: '1px solid rgba(255,255,255,0.15)',
        }}>
          <Typography sx={{ color: '#ffffff', fontSize: '14px', lineHeight: 1.6, mb: 2, fontStyle: 'italic', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
            "Eu e minha esposa vivíamos discutindo dinheiro. Em duas semanas com o Pontes, tudo ficou explícito."
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 700, color: '#ffffff',
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            }}>RM</Box>
            <Box>
              <Typography sx={{ color: '#ffffff', fontSize: '13px', fontWeight: 600, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>Ricardo Moraes</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>Casal · São Paulo</Typography>
            </Box>
          </Box>
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
          backgroundColor: '#ffffff',
          overflowY: 'auto',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: '400px' }}>
          {/* Logo mobile */}
          <Box sx={{ display: { md: 'none' }, mb: 4, textAlign: 'center' }}>
            <Logo color={BRAND} size={28} variant="full" />
          </Box>

          {/* Header form */}
          <Box sx={{ mb: 4 }}>
            <Typography
              sx={{
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                fontSize: '28px',
                fontWeight: 700,
                color: tokens.color.text.primary,
                letterSpacing: '-0.02em',
                mb: 0.5,
              }}
            >
              Bem-vindo de volta
            </Typography>
            <Typography sx={{ fontSize: tokens.typography.fontSize.sm, color: tokens.color.text.secondary, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
              Não tem conta?{' '}
              <Link to="/auth/register" style={{ color: BRAND, textDecoration: 'none', fontWeight: 600 }}>
                Criar conta grátis
              </Link>
            </Typography>
          </Box>

          {/* Form */}
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && (
              <Alert severity="error" sx={{ borderRadius: tokens.radius.lg, fontSize: tokens.typography.fontSize.sm }}>
                {error}
              </Alert>
            )}

            <TextField
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              autoComplete="email"
              sx={inputSx}
            />

            <TextField
              label="Senha"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              autoComplete="current-password"
              sx={inputSx}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword((v) => !v)} edge="end" size="small" tabIndex={-1}>
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ textAlign: 'right', mt: -1 }}>
              <Typography
                component={Link}
                to="/auth/forgot-password"
                sx={{ fontSize: tokens.typography.fontSize.xs, color: tokens.color.text.secondary, textDecoration: 'none', '&:hover': { color: BRAND } }}
              >
                Esqueci a senha
              </Typography>
            </Box>

            <CustomButton type="submit" variant="primary" fullWidth disabled={isLoading} style={{ marginTop: 4 }}>
              {isLoading ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Entrar'}
            </CustomButton>
          </Box>

          {/* Footer */}
          <Typography
            sx={{
              mt: 4, textAlign: 'center',
              fontSize: tokens.typography.fontSize.xs,
              color: tokens.color.text.disabled,
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            }}
          >
            Ao entrar você concorda com os{' '}
            <Box component="span" sx={{ color: tokens.color.text.secondary }}>Termos de Uso</Box>
            {' '}e{' '}
            <Box component="span" sx={{ color: tokens.color.text.secondary }}>Política de Privacidade</Box>.
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
