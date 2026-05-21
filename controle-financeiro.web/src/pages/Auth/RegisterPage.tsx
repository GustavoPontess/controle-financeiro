import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import {
  PontesButton, PontesField, PontesInput, PontesAlert, PontesProgress,
  PontesLogo, usePontesTheme, semantic,
} from '@/components/pontes'
import BackButton from '../../components/BackButton'
import { useAuth } from '../../hooks/useAuth'
import { getSenhaRequisitos, getSenhaForca } from '../../utils/passwordPolicy'

function PasswordStrengthIndicator({ senha }: { senha: string }) {
  const { palette: p, font } = usePontesTheme()
  if (!senha) return null

  const requisitos = getSenhaRequisitos(senha)
  const forca = getSenhaForca(requisitos)
  const progresso = (forca / requisitos.length) * 100

  const cor =
    forca <= 2 ? semantic.danger
    : forca <= 3 ? semantic.warning
    : forca === 4 ? semantic.info
    : semantic.success

  return (
    <div style={{ marginTop: -8 }}>
      <PontesProgress
        p={p}
        font={font}
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
              color: r.ok ? semantic.success : p.textMuted,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: font,
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
  const { palette: p, font } = usePontesTheme()

  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

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
            <pattern id="reg-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#reg-grid)" />
        </svg>

        <div style={{
          position: 'absolute', bottom: '-10%', left: '-10%',
          width: '55%', height: '55%', borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link to="/" style={{ display: 'inline-flex', textDecoration: 'none', transition: 'opacity 0.2s, transform 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.transform = 'scale(1.03)' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)' }}
          >
            <PontesLogo color="#ffffff" size={32} variant="full" />
          </Link>
        </div>

        {/* Headline */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: '40px',
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            margin: '0 0 8px',
          }}>
            Comece grátis.{' '}
            <span style={{ opacity: 0.85 }}>Cresça com sua família.</span>
          </p>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px', lineHeight: 1.55, margin: '0 0 32px', fontFamily: font }}>
            Crie sua conta em 2 minutos. Sem cartão, sem fidelidade.
          </p>

          {/* Planos resumidos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { plan: 'Solo', price: 'Grátis', desc: '1 conta + 1 cartão, lançamentos ilimitados' },
              { plan: 'Família', price: 'R$ 15/mês', desc: 'Até 6 membros, rateio e aprovação' },
              { plan: 'Contador', price: 'R$ 39/mês', desc: 'Multi-cliente, relatórios contábeis' },
            ].map((plan) => (
              <div key={plan.plan} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '12px 16px',
                border: '1px solid rgba(255,255,255,0.12)',
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#ffffff', fontSize: '13px', fontWeight: 700, fontFamily: font, margin: 0 }}>{plan.plan}</p>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontFamily: font, margin: 0 }}>{plan.desc}</p>
                </div>
                <p style={{ color: '#ffffff', fontSize: '13px', fontWeight: 700, fontFamily: font, flexShrink: 0, margin: 0 }}>{plan.price}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 24 }}>
          {[
            { n: '98%', l: 'casais recomendam' },
            { n: '< 2min', l: 'pra criar conta' },
            { n: '10×', l: 'mais rápido' },
          ].map((s) => (
            <div key={s.l}>
              <p style={{ color: '#ffffff', fontSize: '22px', fontWeight: 800, fontFamily: font, letterSpacing: '-0.02em', margin: 0 }}>{s.n}</p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontFamily: font, margin: 0 }}>{s.l}</p>
            </div>
          ))}
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
        <div style={{ width: '100%', maxWidth: '400px', paddingBlock: '16px' }}>
          {/* Voltar para homepage */}
          <BackButton to="/" />

          {/* Logo mobile */}
          <div className="auth-logo-mobile" style={{ marginBottom: '32px', textAlign: 'center' }}>
            <style>{`@media (min-width: 900px) { .auth-logo-mobile { display: none !important; } }`}</style>
            <Link to="/" style={{ display: 'inline-flex', textDecoration: 'none', transition: 'opacity 0.2s, transform 0.2s' }}>
              <PontesLogo color={p.primary} size={28} variant="full" />
            </Link>
          </div>

          {/* Header */}
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{
              fontFamily: font,
              fontSize: '28px',
              fontWeight: 700,
              color: p.text,
              letterSpacing: '-0.02em',
              margin: '0 0 4px',
            }}>
              Criar conta grátis
            </h1>
            <p style={{ fontSize: '14px', color: p.textMuted, fontFamily: font, margin: 0 }}>
              Já tem conta?{' '}
              <Link to="/auth/login" style={{ color: p.primary, textDecoration: 'none', fontWeight: 600 }}>
                Fazer login
              </Link>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <PontesAlert font={font} tone="error">{error}</PontesAlert>
            )}

            <PontesField p={p} font={font} label="Nome completo" htmlFor="reg-nome" required>
              <PontesInput
                p={p}
                font={font}
                id="reg-nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                autoComplete="name"
              />
            </PontesField>

            <PontesField p={p} font={font} label="E-mail" htmlFor="reg-email" required>
              <PontesInput
                p={p}
                font={font}
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </PontesField>

            <PontesField p={p} font={font} label="Data de nascimento" htmlFor="reg-nascimento">
              <PontesInput
                p={p}
                font={font}
                id="reg-nascimento"
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                autoComplete="bday"
              />
            </PontesField>

            <PontesField p={p} font={font} label="Senha" htmlFor="reg-senha" required>
              <PontesInput
                p={p}
                font={font}
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
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, color: p.textMuted }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
            </PontesField>

            <PasswordStrengthIndicator senha={password} />

            <PontesField p={p} font={font} label="Confirmar senha" htmlFor="reg-confirmar" required>
              <PontesInput
                p={p}
                font={font}
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
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, color: p.textMuted }}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
            </PontesField>

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
              Criar conta grátis
            </PontesButton>
          </form>

          {/* Footer */}
          <p style={{
            marginTop: '24px', textAlign: 'center',
            fontSize: '12px',
            color: p.textMuted,
            fontFamily: font,
          }}>
            Ao criar sua conta você concorda com os{' '}
            <span style={{ color: p.textMuted }}>Termos de Uso</span>
            {' '}e{' '}
            <span style={{ color: p.textMuted }}>Política de Privacidade</span>.
          </p>
        </div>
      </div>
    </div>
  )
}
