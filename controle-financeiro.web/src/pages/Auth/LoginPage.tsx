import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft, Trash2 } from 'lucide-react'
import { PontesButton, PontesField, PontesInput, PontesAlert, PontesLogo, PontesCheckbox, PontesAvatar } from '@/components/pontes'
import { useAuth } from '../../hooks/useAuth'
import contaService from '@/services/minhaContaService'
import rosterService, { type ContaLembrada } from '@/services/rosterService'
import styles from './LoginPage.module.css'

const DEV_SENHA = 'Dev@123456'

// Contas fictícias do DevDataSeeder (sempre existem em dev, sem risco — nada real).
const DEV_ACCOUNTS_BASE: { email: string; label: string }[] = [
  { email: 'dev@controle.test', label: 'Dev (casal)' },
  { email: 'conjuge@controle.test', label: 'Cônjuge do Dev' },
  { email: 'solo@controle.test', label: 'Solo (sem família)' },
]

// Contas locais extras (ex: seu cenário real do MeuCenarioSeeder) — vêm de um
// .env do frontend (gitignored, nunca commitado). Formato:
// VITE_DEV_LOGIN_EXTRA="email1:Rótulo 1,email2:Rótulo 2"
function contasExtras(): { email: string; label: string }[] {
  const raw = import.meta.env.VITE_DEV_LOGIN_EXTRA as string | undefined
  if (!raw) return []
  return raw.split(',').map((par) => {
    const [email, label] = par.split(':')
    return { email: (email ?? '').trim(), label: (label ?? email ?? '').trim() }
  }).filter((c) => c.email)
}

const DEV_ACCOUNTS = [...DEV_ACCOUNTS_BASE, ...contasExtras()]

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, verificarMfaLogin } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [isLoading, setIsLoading] = useState(false)

  // Passo 2 (MFA) — preenchido quando o login retorna que o 2º fator é necessário.
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null)
  const [mfaCodigo, setMfaCodigo] = useState('')
  const [mfaErro, setMfaErro] = useState<string | undefined>()
  // Opt-in "confiar neste dispositivo" — pula o 2º fator nos próximos logins deste navegador.
  const [confiarDispositivo, setConfiarDispositivo] = useState(false)

  // Conta na carência de exclusão — login retornou que a conta está marcada; oferece reativar.
  const [marcada, setMarcada] = useState<{ dias: number | null } | null>(null)
  const [reativarErro, setReativarErro] = useState<string | undefined>()

  // "Manter-me conectado" (opt-in): sessão persistente + entra no chooser deste navegador.
  const [manterConectado, setManterConectado] = useState(false)
  // Roster / chooser pré-login (server-side, por device).
  const [roster, setRoster] = useState<ContaLembrada[]>([])
  const [usarOutra, setUsarOutra] = useState(false) // "entrar em outra conta" → mostra o form

  useEffect(() => {
    rosterService.listar().then(setRoster).catch(() => setRoster([]))
  }, [])

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
      const result = await login(email, password, manterConectado)
      if (result.mfaRequerido) {
        setMfaChallenge(result.challengeToken) // troca pra tela do código
        return
      }
      if (result.contaMarcadaExclusao) {
        setMarcada({ dias: result.diasRestantes }) // troca pra tela de reativação
        return
      }
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReativar = async () => {
    setReativarErro(undefined)
    setIsLoading(true)
    try {
      await contaService.reativarConta(email, password)
      // Reativada → loga normalmente (respeita MFA se estiver ativo).
      setMarcada(null)
      const result = await login(email, password, manterConectado)
      if (result.mfaRequerido) { setMfaChallenge(result.challengeToken); return }
      navigate('/')
    } catch (err) {
      setReativarErro(err instanceof Error ? err.message : 'Não foi possível reativar a conta.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMfaErro(undefined)
    if (!mfaCodigo.trim()) { setMfaErro('Informe o código'); return }
    setIsLoading(true)
    try {
      await verificarMfaLogin(mfaChallenge!, mfaCodigo.trim(), confiarDispositivo, manterConectado)
      navigate('/')
    } catch (err) {
      setMfaErro(err instanceof Error ? err.message : 'Código inválido')
    } finally {
      setIsLoading(false)
    }
  }

  // Selecionar uma conta do chooser: revela o e-mail real (a lista só tem mascarado) e vai pro form
  // pra digitar só a senha.
  const handleSelecionarConta = async (usuarioId: string) => {
    try {
      setEmail(await rosterService.obterEmail(usuarioId))
    } catch { /* conta saiu do roster; segue pro form vazio */ }
    setErrors({}); setError('')
    setUsarOutra(true)
  }

  const handleRemoverConta = async (usuarioId: string) => {
    try { await rosterService.remover(usuarioId) } catch { /* ignore */ }
    setRoster((prev) => prev.filter((c) => c.usuarioId !== usuarioId))
  }

  const mostrarChooser = roster.length > 0 && !usarOutra && !mfaChallenge && !marcada

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
            <h1 className={styles.title}>
              {marcada ? 'Reativar conta' : mfaChallenge ? 'Verificação em duas etapas' : mostrarChooser ? 'Escolha sua conta' : 'Bem-vindo de volta'}
            </h1>
            <p className={styles.sub}>
              {marcada ? (
                'Sua conta está marcada para exclusão. Você ainda pode reativá-la.'
              ) : mfaChallenge ? (
                'Digite o código do seu app autenticador (ou um código de recuperação).'
              ) : mostrarChooser ? (
                'Selecione uma conta para continuar — você só digita a senha.'
              ) : (
                <>Não tem conta?{' '}
                <Link to="/auth/register" className={styles.link}>Criar conta grátis</Link></>
              )}
            </p>
          </div>

          {marcada ? (
            /* Conta na carência — oferece reativar */
            <div className={styles.formBody}>
              {reativarErro && <PontesAlert tone="error">{reativarErro}</PontesAlert>}
              <PontesAlert tone="warning">
                {marcada.dias != null
                  ? `Faltam ${marcada.dias} dia(s) para a remoção permanente. Reative para voltar a usar sua conta.`
                  : 'Reative para voltar a usar sua conta antes da remoção permanente.'}
              </PontesAlert>
              <PontesButton type="button" variant="primary" size="lg" fullWidth loading={isLoading} disabled={isLoading}
                onClick={handleReativar}>
                Reativar conta
              </PontesButton>
              <PontesButton type="button" variant="ghost" size="md" fullWidth
                onClick={() => { setMarcada(null); setReativarErro(undefined); setPassword('') }}>
                Voltar
              </PontesButton>
            </div>
          ) : mfaChallenge ? (
            /* Passo 2 — código MFA */
            <form onSubmit={handleMfaSubmit} className={styles.formBody} noValidate>
              <PontesField label="Código" htmlFor="mfa-codigo" required error={mfaErro}>
                <PontesInput
                  id="mfa-codigo"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  value={mfaCodigo}
                  onChange={(e) => { setMfaCodigo(e.target.value); setMfaErro(undefined) }}
                  invalid={!!mfaErro}
                  placeholder="000000"
                />
              </PontesField>

              <PontesCheckbox
                checked={confiarDispositivo}
                onChange={setConfiarDispositivo}
                label="Confiar neste dispositivo por 30 dias"
              />

              <PontesButton type="submit" variant="primary" size="lg" fullWidth loading={isLoading} disabled={isLoading}>
                Verificar
              </PontesButton>
              <PontesButton
                type="button" variant="ghost" size="md" fullWidth
                onClick={() => { setMfaChallenge(null); setMfaCodigo(''); setMfaErro(undefined); setConfiarDispositivo(false) }}
              >
                Voltar
              </PontesButton>
            </form>
          ) : mostrarChooser ? (
            /* Chooser — escolher conta (roster, opt-in). Só nome + e-mail mascarado. */
            <div className={styles.formBody}>
              <ul className={styles.chooser}>
                {roster.map((c) => (
                  <li key={c.usuarioId} className={styles.chooserItem}>
                    <button
                      type="button"
                      className={styles.chooserPick}
                      onClick={() => handleSelecionarConta(c.usuarioId)}
                    >
                      <PontesAvatar name={c.nome} size={36} />
                      <span className={styles.chooserInfo}>
                        <span className={styles.chooserNome}>{c.nome}</span>
                        <span className={styles.chooserEmail}>{c.emailMascarado}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.chooserRemove}
                      title="Remover desta lista"
                      aria-label={`Remover ${c.nome} desta lista`}
                      onClick={() => handleRemoverConta(c.usuarioId)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
              <PontesButton
                type="button" variant="ghost" size="md" fullWidth
                onClick={() => { setUsarOutra(true); setEmail(''); setErrors({}); setError('') }}
              >
                Entrar em outra conta
              </PontesButton>
            </div>
          ) : (
          /* Passo 1 — email + senha */
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

            <PontesCheckbox
              checked={manterConectado}
              onChange={setManterConectado}
              label="Manter-me conectado neste dispositivo"
            />

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
          )}

          {/* Footer */}
          <p className={styles.footer}>
            Ao entrar você concorda com os{' '}
            <Link to="/termos-de-uso" target="_blank" className={styles.link}>Termos de Uso</Link>
            {' '}e{' '}
            <Link to="/privacidade" target="_blank" className={styles.link}>Política de Privacidade</Link>.
          </p>
        </div>
      </div>

      {/* Atalho de DEV — login de teste (só em desenvolvimento; nunca em produção) */}
      {import.meta.env.DEV && (
        <div className={styles.devHintPanel}>
          <span className={styles.devHintTag}>DEV · clique p/ preencher</span>
          {DEV_ACCOUNTS.map((conta) => (
            <button
              key={conta.email}
              type="button"
              className={styles.devHintRow}
              onClick={() => {
                setEmail(conta.email)
                setPassword(DEV_SENHA)
                setErrors({})
                setError('')
              }}
              title={`Preencher login de ${conta.label}`}
            >
              <span className={styles.devHintLabel}>{conta.label}</span>
              <span className={styles.devHintCreds}>{conta.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
