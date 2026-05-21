import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { PontesButton, PontesField, PontesInput, PontesAlert, PontesLogo, usePontesTheme } from '@/components/pontes'
import BackButton from '../../components/BackButton'
import { useAuth } from '../../hooks/useAuth'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { palette: p, font } = usePontesTheme()

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
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: font }}>
      <style>{`@media (max-width: 899px) { .auth-brand-panel { display: none !important; } }`}</style>

      {/* ── PAINEL ESQUERDO — brand ───────────────────────────────────── */}
      <div
        className="auth-brand-panel"
        style={{
          display: 'flex',
          width: '48%',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px',
          background: `linear-gradient(150deg, ${p.primary} 0%, ${p.primaryDark} 100%)`,
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
        <div style={{
          position: 'absolute', top: '-15%', right: '-15%',
          width: '60%', height: '60%', borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link to="/" style={{ display: 'inline-flex', textDecoration: 'none' }}>
            <PontesLogo color="#ffffff" size={32} />
          </Link>
        </div>

        {/* Headline + features */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: '42px',
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            margin: '0 0 8px',
          }}>
            Finanças em família,{' '}
            <span style={{ opacity: 0.85 }}>sem briga.</span>
          </p>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px', lineHeight: 1.55, margin: '0 0 32px', fontFamily: font }}>
            Um lugar só para você, seu parceiro e seu contador. Rateio claro, aprovação de despesas, visão completa.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              'Rateio explícito — 50/50, % ou valor fixo',
              'Aprovação de despesa em 1 toque',
              'Conexão com Open Finance (em breve)',
            ].map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ color: '#ffffff', fontSize: '11px', fontWeight: 700 }}>✓</span>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontFamily: font }}>
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div style={{
          position: 'relative', zIndex: 1,
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(8px)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid rgba(255,255,255,0.15)',
        }}>
          <p style={{ color: '#ffffff', fontSize: '14px', lineHeight: 1.6, margin: '0 0 16px', fontStyle: 'italic', fontFamily: font }}>
            "Eu e minha esposa vivíamos discutindo dinheiro. Em duas semanas com o Pontes, tudo ficou explícito."
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 700, color: '#ffffff',
              fontFamily: font,
            }}>RM</div>
            <div>
              <p style={{ color: '#ffffff', fontSize: '13px', fontWeight: 600, fontFamily: font, margin: 0 }}>Ricardo Moraes</p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontFamily: font, margin: 0 }}>Casal · São Paulo</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── PAINEL DIREITO — form ─────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 40px',
        backgroundColor: p.surface,
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          {/* Voltar para homepage */}
          <BackButton to="/" />

          {/* Logo mobile */}
          <div className="auth-logo-mobile" style={{ marginBottom: '32px', textAlign: 'center' }}>
            <style>{`@media (min-width: 900px) { .auth-logo-mobile { display: none !important; } }`}</style>
            <Link to="/" style={{ display: 'inline-flex', textDecoration: 'none' }}>
              <PontesLogo color={p.primary} size={28} />
            </Link>
          </div>

          {/* Header form */}
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{
              fontFamily: font,
              fontSize: '28px',
              fontWeight: 700,
              color: p.text,
              letterSpacing: '-0.02em',
              margin: '0 0 4px',
            }}>
              Bem-vindo de volta
            </h1>
            <p style={{ fontSize: '14px', color: p.textMuted, fontFamily: font, margin: 0 }}>
              Não tem conta?{' '}
              <Link to="/auth/register" style={{ color: p.primary, textDecoration: 'none', fontWeight: 600 }}>
                Criar conta grátis
              </Link>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <PontesAlert font={font} tone="error">{error}</PontesAlert>
            )}

            <PontesField p={p} font={font} label="E-mail" htmlFor="login-email" required>
              <PontesInput
                p={p}
                font={font}
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </PontesField>

            <PontesField p={p} font={font} label="Senha" htmlFor="login-senha" required>
              <PontesInput
                p={p}
                font={font}
                id="login-senha"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                iconEnd={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    data-testid="toggle-senha"
                    tabIndex={-1}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, color: p.textMuted }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
            </PontesField>

            <div style={{ textAlign: 'right', marginTop: -8 }}>
              <Link
                to="/auth/forgot-password"
                style={{ fontSize: 12, color: p.textMuted, textDecoration: 'none', fontFamily: font }}
              >
                Esqueci a senha
              </Link>
            </div>

            <PontesButton
              p={p}
              font={font}
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              disabled={isLoading}
            >
              Entrar
            </PontesButton>
          </form>

          {/* Footer */}
          <p style={{
            marginTop: '32px', textAlign: 'center',
            fontSize: '12px',
            color: p.textMuted,
            fontFamily: font,
          }}>
            Ao entrar você concorda com os{' '}
            <span style={{ color: p.textMuted }}>Termos de Uso</span>
            {' '}e{' '}
            <span style={{ color: p.textMuted }}>Política de Privacidade</span>.
          </p>
        </div>
      </div>
    </div>
  )
}
