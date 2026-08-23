import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import {
  PontesButton, PontesField, PontesInput, PontesAlert, PontesLogo, PontesCheckbox,
} from '@/components/pontes'
import { useAuth } from '../../hooks/useAuth'
import { getSenhaRequisitos } from '../../utils/passwordPolicy'
import styles from './RegisterPage.module.css'

function PasswordStrengthIndicator({ senha }: { senha: string }) {
  if (!senha) return null

  // NIST SP 800-63B: só tamanho importa (sem regra de composição) — um único critério,
  // não faz mais sentido barra de progresso de 5 níveis. Indicador simples ok/não-ok.
  const requisitos = getSenhaRequisitos(senha)

  return (
    <div className={styles.strength}>
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
  const [aceitaPrivacidade, setAceitaPrivacidade] = useState(false)
  const [errors, setErrors] = useState<{ nome?: string; email?: string; dataNascimento?: string; password?: string; confirmPassword?: string; privacidade?: string }>({})
  const [isLoading, setIsLoading] = useState(false)

  const clearErr = (k: keyof typeof errors) => setErrors((p) => ({ ...p, [k]: undefined }))

  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!nome.trim()) e.nome = 'Informe seu nome'
    if (!email.trim()) e.email = 'Informe o e-mail'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'E-mail inválido'
    if (!dataNascimento) e.dataNascimento = 'Informe a data de nascimento'
    if (!password) e.password = 'Informe a senha'
    else if (getSenhaRequisitos(password).some((r) => !r.ok)) e.password = 'Senha não atende aos requisitos'
    if (!confirmPassword) e.confirmPassword = 'Confirme a senha'
    else if (password !== confirmPassword) e.confirmPassword = 'As senhas não conferem'
    if (!aceitaPrivacidade) e.privacidade = 'Você precisa aceitar a Política de Privacidade pra continuar'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validate()) return

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
          <Link to="/" className={styles.backLink}>
            <ArrowLeft size={16} /> Voltar à página inicial
          </Link>

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
          <form onSubmit={handleSubmit} className={styles.formBody} noValidate>
            {error && (
              <PontesAlert tone="error">{error}</PontesAlert>
            )}

            <PontesField label="Nome completo" htmlFor="reg-nome" required error={errors.nome}>
              <PontesInput
                id="reg-nome"
                type="text"
                value={nome}
                onChange={(e) => { setNome(e.target.value); clearErr('nome') }}
                invalid={!!errors.nome}
                autoComplete="name"
              />
            </PontesField>

            <PontesField label="E-mail" htmlFor="reg-email" required error={errors.email}>
              <PontesInput
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearErr('email') }}
                invalid={!!errors.email}
                autoComplete="email"
              />
            </PontesField>

            <PontesField label="Data de nascimento" htmlFor="reg-nascimento" required error={errors.dataNascimento}>
              <PontesInput
                id="reg-nascimento"
                type="date"
                value={dataNascimento}
                onChange={(e) => { setDataNascimento(e.target.value); clearErr('dataNascimento') }}
                invalid={!!errors.dataNascimento}
                autoComplete="bday"
              />
            </PontesField>

            <PontesField label="Senha" htmlFor="reg-senha" required error={errors.password}>
              <PontesInput
                id="reg-senha"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearErr('password') }}
                invalid={!!errors.password}
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

            <PontesField label="Confirmar senha" htmlFor="reg-confirmar" required error={errors.confirmPassword}>
              <PontesInput
                id="reg-confirmar"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); clearErr('confirmPassword') }}
                invalid={!!errors.confirmPassword}
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

            <div className={styles.consentRow}>
              <PontesCheckbox
                checked={aceitaPrivacidade}
                onChange={(v) => { setAceitaPrivacidade(v); clearErr('privacidade') }}
              />
              <span className={styles.consentText}>
                Li e aceito a{' '}
                <Link to="/privacidade" target="_blank" className={styles.link}>Política de Privacidade</Link>.
              </span>
            </div>
            {errors.privacidade && <p className={styles.consentError}>{errors.privacidade}</p>}

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
            Ao criar sua conta você também concorda com os{' '}
            <Link to="/termos-de-uso" target="_blank" className={styles.link}>Termos de Uso</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
