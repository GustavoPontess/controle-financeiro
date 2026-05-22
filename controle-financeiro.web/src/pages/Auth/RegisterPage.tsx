import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import {
  PontesButton, PontesField, PontesInput, PontesAlert, PontesProgress, PontesLogo,
} from '@/components/pontes'
import BackButton from '../../components/BackButton'
import { useAuth } from '../../hooks/useAuth'
import { getSenhaRequisitos, getSenhaForca } from '../../utils/passwordPolicy'
import styles from './RegisterPage.module.css'

function PasswordStrengthIndicator({ senha }: { senha: string }) {
  if (!senha) return null

  const requisitos = getSenhaRequisitos(senha)
  const forca = getSenhaForca(requisitos)
  const progresso = (forca / requisitos.length) * 100

  const cor =
    forca <= 2 ? 'var(--pontes-danger)'
    : forca <= 3 ? 'var(--pontes-warning)'
    : forca === 4 ? 'var(--pontes-info)'
    : 'var(--pontes-success)'

  return (
    <div className={styles.strength}>
      <PontesProgress value={progresso} color={cor} height={3} showValue={false} />
      <div className={styles.reqs}>
        {requisitos.map((r) => (
          <span key={r.label} className={styles.req} data-ok={r.ok}>
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
    <div className={styles.root}>
      {/* ── PAINEL ESQUERDO — brand ───────────────────────────────────── */}
      <div className={styles.brand}>
        {/* grade decorativa */}
        <svg className={styles.grid}>
          <defs>
            <pattern id="reg-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#reg-grid)" />
        </svg>

        <div className={styles.blob} />

        {/* Logo */}
        <div className={styles.brandLogo}>
          <PontesLogo color="#ffffff" size={32} onClick={() => navigate('/')} />
        </div>

        {/* Headline */}
        <div className={styles.brandMid}>
          <p className={styles.headline}>
            Comece grátis.{' '}
            <span className={styles.headlineDim}>Cresça com sua família.</span>
          </p>
          <p className={styles.lead}>
            Crie sua conta em 2 minutos. Sem cartão, sem fidelidade.
          </p>

          {/* Planos resumidos */}
          <div className={styles.plans}>
            {[
              { plan: 'Solo', price: 'Grátis', desc: '1 conta + 1 cartão, lançamentos ilimitados' },
              { plan: 'Família', price: 'R$ 15/mês', desc: 'Até 6 membros, rateio e aprovação' },
              { plan: 'Contador', price: 'R$ 39/mês', desc: 'Multi-cliente, relatórios contábeis' },
            ].map((plan) => (
              <div key={plan.plan} className={styles.planRow}>
                <div className={styles.planInfo}>
                  <p className={styles.planName}>{plan.plan}</p>
                  <p className={styles.planDesc}>{plan.desc}</p>
                </div>
                <p className={styles.planPrice}>{plan.price}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className={styles.stats}>
          {[
            { n: '98%', l: 'casais recomendam' },
            { n: '< 2min', l: 'pra criar conta' },
            { n: '10×', l: 'mais rápido' },
          ].map((s) => (
            <div key={s.l}>
              <p className={styles.statN}>{s.n}</p>
              <p className={styles.statL}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── PAINEL DIREITO — form ─────────────────────────────────────── */}
      <div className={styles.form}>
        <div className={styles.formInner}>
          {/* Voltar para homepage */}
          <BackButton to="/" />

          {/* Logo mobile */}
          <div className={styles.logoMobile}>
            <PontesLogo color="var(--pontes-primary)" size={28} onClick={() => navigate('/')} />
          </div>

          {/* Header */}
          <div className={styles.head}>
            <h1 className={styles.title}>Criar conta grátis</h1>
            <p className={styles.sub}>
              Já tem conta?{' '}
              <Link to="/auth/login" className={styles.link}>Fazer login</Link>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className={styles.formBody}>
            {error && (
              <PontesAlert tone="error">{error}</PontesAlert>
            )}

            <PontesField label="Nome completo" htmlFor="reg-nome" required>
              <PontesInput
                id="reg-nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                autoComplete="name"
              />
            </PontesField>

            <PontesField label="E-mail" htmlFor="reg-email" required>
              <PontesInput
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </PontesField>

            <PontesField label="Data de nascimento" htmlFor="reg-nascimento">
              <PontesInput
                id="reg-nascimento"
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                autoComplete="bday"
              />
            </PontesField>

            <PontesField label="Senha" htmlFor="reg-senha" required>
              <PontesInput
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
                    className={styles.eyeBtn}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
            </PontesField>

            <PasswordStrengthIndicator senha={password} />

            <PontesField label="Confirmar senha" htmlFor="reg-confirmar" required>
              <PontesInput
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
                    className={styles.eyeBtn}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
            </PontesField>

            <PontesButton
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
          <p className={styles.footer}>
            Ao criar sua conta você concorda com os{' '}
            <span className={styles.footerMuted}>Termos de Uso</span>
            {' '}e{' '}
            <span className={styles.footerMuted}>Política de Privacidade</span>.
          </p>
        </div>
      </div>
    </div>
  )
}
