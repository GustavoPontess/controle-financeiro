import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { PontesButton, PontesField, PontesInput, PontesAlert, PontesLogo } from '@/components/pontes'
import { useAuth } from '../../hooks/useAuth'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [isLoading, setIsLoading] = useState(false)

  const validate = (): boolean => {
    const e: { email?: string; password?: string } = {}
    if (!email.trim()) e.email = 'Informe o e-mail'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'E-mail inválido'
    if (!password) e.password = 'Informe a senha'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validate()) return
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
    <div className={styles.root}>
      {/* ── PAINEL ESQUERDO — brand ───────────────────────────────────── */}
      <div className={styles.brand}>
        {/* grade decorativa */}
        <svg className={styles.grid}>
          <defs>
            <pattern id="auth-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-grid)" />
        </svg>

        {/* blob decorativo */}
        <div className={styles.blob} />

        {/* Logo */}
        <div className={styles.brandLogo}>
          <PontesLogo color="#ffffff" size={32} onClick={() => navigate('/')} />
        </div>

        {/* Headline + features */}
        <div className={styles.brandMid}>
          <p className={styles.headline}>
            Finanças em família,{' '}
            <span className={styles.headlineDim}>sem briga.</span>
          </p>
          <p className={styles.lead}>
            Um lugar só para você, seu parceiro e seu contador. Rateio claro, aprovação de despesas, visão completa.
          </p>

          <div className={styles.features}>
            {[
              'Rateio explícito — 50/50, % ou valor fixo',
              'Aprovação de despesa em 1 toque',
              'Conexão com Open Finance (em breve)',
            ].map((item) => (
              <div key={item} className={styles.featureRow}>
                <div className={styles.featureCheck}>✓</div>
                <span className={styles.featureText}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className={styles.quote}>
          <p className={styles.quoteText}>
            "Eu e minha esposa vivíamos discutindo dinheiro. Em duas semanas com o Pontes, tudo ficou explícito."
          </p>
          <div className={styles.quoteWho}>
            <div className={styles.quoteAvatar}>RM</div>
            <div>
              <p className={styles.quoteName}>Ricardo Moraes</p>
              <p className={styles.quoteRole}>Casal · São Paulo</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── PAINEL DIREITO — form ─────────────────────────────────────── */}
      <div className={styles.form}>
        <div className={styles.formInner}>
          {/* Voltar para homepage */}
          <Link to="/" className={styles.backLink}>
            <ArrowLeft size={16} /> Voltar à página inicial
          </Link>

          {/* Logo mobile */}
          <div className={styles.logoMobile}>
            <PontesLogo color="var(--pontes-primary)" size={28} onClick={() => navigate('/')} />
          </div>

          {/* Header form */}
          <div className={styles.head}>
            <h1 className={styles.title}>Bem-vindo de volta</h1>
            <p className={styles.sub}>
              Não tem conta?{' '}
              <Link to="/auth/register" className={styles.link}>Criar conta grátis</Link>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className={styles.formBody} noValidate>
            {error && (
              <PontesAlert tone="error">{error}</PontesAlert>
            )}

            <PontesField label="E-mail" htmlFor="login-email" required error={errors.email}>
              <PontesInput
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })) }}
                invalid={!!errors.email}
                autoComplete="email"
              />
            </PontesField>

            <PontesField label="Senha" htmlFor="login-senha" required error={errors.password}>
              <PontesInput
                id="login-senha"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })) }}
                invalid={!!errors.password}
                autoComplete="current-password"
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

            <div className={styles.forgotRow}>
              <Link to="/auth/forgot-password" className={styles.forgotLink}>Esqueci a senha</Link>
            </div>

            <PontesButton
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
          <p className={styles.footer}>
            Ao entrar você concorda com os{' '}
            <span className={styles.footerMuted}>Termos de Uso</span>
            {' '}e{' '}
            <span className={styles.footerMuted}>Política de Privacidade</span>.
          </p>
        </div>
      </div>

      {/* Atalho de DEV — login de teste (só em desenvolvimento; nunca em produção) */}
      {import.meta.env.DEV && (
        <button
          type="button"
          className={styles.devHint}
          onClick={() => {
            setEmail('dev@controle.test')
            setPassword('Dev@123456')
            setErrors({})
            setError('')
          }}
          title="Clique para preencher o login de teste"
        >
          <span className={styles.devHintTag}>DEV</span>
          <span className={styles.devHintCol}>
            <span className={styles.devHintLabel}>login de teste · clique p/ preencher</span>
            <span className={styles.devHintCreds}>dev@controle.test · Dev@123456</span>
          </span>
        </button>
      )}
    </div>
  )
}
