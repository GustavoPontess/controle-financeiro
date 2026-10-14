// Tela de entrada. Um passo por vez: escolher conta lembrada → e-mail + senha → (2º fator) → entra.
// Também: conta na carência de exclusão (reativar), "esqueci a senha" (inline, a API manda o link) e
// o painel DEV de contas de teste (só em desenvolvimento). Visual: palco da marca com o gradiente da
// paleta escolhida + painel do formulário — sem enfeite (nada de grade, blob ou depoimento inventado).
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft, ArrowRight, Check, Trash2, UserPlus, ChevronDown, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { PontesButton, PontesField, PontesInput, PontesAlert, PontesLogo, PontesCheckbox, PontesAvatar } from '@/components/pontes'
import { useAuth } from '../../hooks/useAuth'
import { api } from '@/api/axiosConfig'
import contaService from '@/services/minhaContaService'
import rosterService, { type ContaLembrada } from '@/services/rosterService'
import styles from './LoginPage.module.css'

const DEV_SENHA = 'Dev@123456'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Contas fictícias do DevDataSeeder (sempre existem em dev, sem risco — nada real).
// Contas de teste que o DevDataSeeder cria no dev local (só o casal).
const DEV_ACCOUNTS_BASE: { email: string; label: string }[] = [
  { email: 'dev@controle.test', label: 'Titular (casal)' },
  { email: 'conjuge@controle.test', label: 'Cônjuge' },
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

// Base + extras do .env, sem repetir e-mail (o .env pode redefinir uma conta já listada). É só o
// fallback: em dev, o painel busca a lista REAL do banco (endpoint /auth/dev/contas) — assim toda
// conta de teste que eu criar aparece sozinha, sem editar esta lista.
const dedupePorEmail = (contas: { email: string; label: string }[]) =>
  contas.filter((c, i, todas) => todas.findIndex((o) => o.email.toLowerCase() === c.email.toLowerCase()) === i)
const DEV_ACCOUNTS = dedupePorEmail([...DEV_ACCOUNTS_BASE, ...contasExtras()])

type Passo = 'escolher' | 'form' | 'mfa' | 'exclusao' | 'esqueci'

const BENEFICIOS = [
  'Rateio explícito — 50/50, % ou valor fixo',
  'Aprovação de despesa em 1 toque',
  'Conexão com Open Finance (em breve)',
]

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

  // "Esqueci a senha": pede o e-mail e a API manda o link. Resposta é a mesma pra qualquer e-mail
  // (não revela se a conta existe).
  const [esqueci, setEsqueci] = useState(false)
  const [esqueciEnviado, setEsqueciEnviado] = useState(false)

  // "Manter-me conectado" (opt-in): sessão persistente + entra no chooser deste navegador.
  const [manterConectado, setManterConectado] = useState(false)
  // Roster / chooser pré-login (server-side, por device).
  const [roster, setRoster] = useState<ContaLembrada[]>([])
  const [usarOutra, setUsarOutra] = useState(false) // "entrar em outra conta" → mostra o form
  const [contaSelecionada, setContaSelecionada] = useState<ContaLembrada | null>(null) // conta escolhida no chooser

  useEffect(() => {
    rosterService.listar().then(setRoster).catch(() => setRoster([]))
  }, [])

  // Painel DEV: lista TODAS as contas REAIS do banco (endpoint só-de-dev). Rótulo bonito quando é
  // conta conhecida (base/.env); senão, o nome do usuário. `senhaPadrao` = aceita a senha de dev
  // (clica-e-entra); nas outras o clique só preenche o e-mail (a senha é própria). Fallback estático
  // (todas tratadas como senha de dev) só se o endpoint falhar.
  type DevConta = { email: string; label: string; senhaPadrao?: boolean }
  const [devContas, setDevContas] = useState<DevConta[]>(DEV_ACCOUNTS)
  const [devAberto, setDevAberto] = useState(() => {
    try { return localStorage.getItem('devPanelRecolhido') !== '1' } catch { return true }
  })
  const alternarDev = (aberto: boolean) => {
    setDevAberto(aberto)
    try { localStorage.setItem('devPanelRecolhido', aberto ? '0' : '1') } catch { /* private mode */ }
  }
  useEffect(() => {
    if (!import.meta.env.DEV) return
    api.get<{ email: string; nome: string; senhaPadrao: boolean }[]>('/auth/dev/contas')
      .then((r) => {
        const rotulo = (email: string) => DEV_ACCOUNTS.find((c) => c.email.toLowerCase() === email.toLowerCase())?.label
        setDevContas(r.data.map((c) => ({ email: c.email, label: rotulo(c.email) ?? c.nome, senhaPadrao: c.senhaPadrao })))
      })
      .catch(() => { /* mantém o fallback estático */ })
  }, [])

  const limparErros = () => { setErrors({}); setError('') }

  const validate = (): boolean => {
    const e: { email?: string; password?: string } = {}
    if (!email.trim()) e.email = 'Informe o e-mail'
    else if (!EMAIL_RE.test(email)) e.email = 'E-mail inválido'
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

  const handleEsqueciSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setErrors({ email: 'Informe o e-mail' }); return }
    if (!EMAIL_RE.test(email)) { setErrors({ email: 'E-mail inválido' }); return }
    setIsLoading(true)
    try {
      await api.post('/auth/forgot-password', { email: email.trim() })
      setEsqueciEnviado(true)
    } catch {
      setError('Não foi possível enviar agora. Tente de novo em instantes.')
    } finally {
      setIsLoading(false)
    }
  }

  // Selecionar uma conta do chooser: revela o e-mail real (a lista só tem mascarado), guarda a conta
  // pra mostrar o chip no topo e vai pro form (a pessoa só digita a senha).
  const handleSelecionarConta = async (conta: ContaLembrada) => {
    try {
      setEmail(await rosterService.obterEmail(conta.usuarioId))
      setContaSelecionada(conta)
    } catch {
      setContaSelecionada(null) // reveal falhou → form normal com o campo de e-mail
    }
    limparErros()
    setUsarOutra(true)
  }

  // "Entrar em outra conta" → form limpo (campo de e-mail visível). Voltar → volta pra lista.
  const irParaOutraConta = () => { setContaSelecionada(null); setEmail(''); limparErros(); setUsarOutra(true) }
  const voltarProChooser = () => { setUsarOutra(false); setContaSelecionada(null); setPassword(''); limparErros() }

  const handleRemoverConta = async (usuarioId: string) => {
    try { await rosterService.remover(usuarioId) } catch { /* ignore */ }
    setRoster((prev) => prev.filter((c) => c.usuarioId !== usuarioId))
  }

  const passo: Passo = marcada ? 'exclusao'
    : mfaChallenge ? 'mfa'
    : esqueci ? 'esqueci'
    : roster.length > 0 && !usarOutra ? 'escolher'
    : 'form'

  const titulo = passo === 'exclusao' ? 'Reativar conta'
    : passo === 'mfa' ? 'Verificação em duas etapas'
    : passo === 'esqueci' ? 'Recuperar senha'
    : passo === 'escolher' ? 'Escolha sua conta'
    : 'Bem-vindo de volta'

  return (
    <div className={styles.root}>
      {/* ── Palco da marca (gradiente da paleta) ─────────────────────────── */}
      <aside className={styles.brand}>
        <div className={styles.brandLogo}>
          <PontesLogo color="var(--pontes-hero-fg)" size={28} onClick={() => navigate('/')} />
        </div>
        <div className={styles.brandMid}>
          <p className={styles.headline}>
            Finanças em família, <span className={styles.headlineDim}>sem briga.</span>
          </p>
          <p className={styles.lead}>
            Um lugar só para você, seu parceiro e seu contador. Rateio claro, aprovação de despesas, visão completa.
          </p>
          <ul className={styles.features}>
            {BENEFICIOS.map((item) => (
              <li key={item}>
                <span className={styles.featureCheck}><Check size={12} strokeWidth={3} aria-hidden="true" /></span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <span className={styles.brandFoot}>Pontes · finanças pessoais e familiares</span>
      </aside>

      {/* ── Painel do formulário ─────────────────────────────────────────── */}
      <main className={styles.painel}>
        <div className={styles.miolo}>
          {/* Um único "voltar", contextual. Veio do chooser → volta pra lista (ou o chip da conta
             selecionada). Home fica no logo. Senão → voltar pra página inicial. */}
          {passo === 'mfa' ? (
            <button type="button" className={styles.voltar}
              onClick={() => { setMfaChallenge(null); setMfaCodigo(''); setMfaErro(undefined); setConfiarDispositivo(false) }}>
              <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" /> Voltar ao login
            </button>
          ) : passo === 'exclusao' ? (
            <button type="button" className={styles.voltar}
              onClick={() => { setMarcada(null); setReativarErro(undefined); setPassword('') }}>
              <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" /> Voltar ao login
            </button>
          ) : passo === 'esqueci' ? (
            <button type="button" className={styles.voltar}
              onClick={() => { setEsqueci(false); setEsqueciEnviado(false); limparErros() }}>
              <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" /> Voltar ao login
            </button>
          ) : passo === 'form' && roster.length > 0 ? (
            contaSelecionada ? (
              <button type="button" className={styles.chip} onClick={voltarProChooser} title="Trocar de conta">
                <PontesAvatar name={contaSelecionada.nome} size={28} />
                <span className={styles.chipNome}>{contaSelecionada.nome}</span>
                <span className={styles.chipEmail}>{contaSelecionada.emailMascarado}</span>
                <ChevronDown size={16} strokeWidth={2.25} aria-hidden="true" className={styles.chipCaret} />
              </button>
            ) : (
              <button type="button" className={styles.voltar} onClick={voltarProChooser}>
                <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" /> Escolher conta salva
              </button>
            )
          ) : (
            <Link to="/" className={styles.voltar}>
              <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" /> Página inicial
            </Link>
          )}

          {/* Logo no celular (o palco some) */}
          <div className={styles.logoMobile}>
            <PontesLogo color="var(--pontes-primary)" size={26} onClick={() => navigate('/')} />
          </div>

          <h1 className={styles.title}>{titulo}</h1>
          {passo === 'form' && (
            <p className={styles.sub}>Não tem conta? <Link to="/auth/register" className={styles.link}>Criar conta grátis</Link></p>
          )}
          {passo === 'mfa' && <p className={styles.sub}>Digite o código do seu app autenticador (ou um código de recuperação).</p>}
          {passo === 'exclusao' && <p className={styles.sub}>Sua conta está marcada para exclusão. Você ainda pode reativá-la.</p>}
          {passo === 'esqueci' && !esqueciEnviado && (
            <p className={styles.sub}>Informe seu e-mail. Se existir uma conta, enviamos um link para criar uma senha nova.</p>
          )}

          {passo === 'escolher' && (
            /* Chooser — contas lembradas neste navegador (só nome + e-mail mascarado). */
            <ul className={styles.lista}>
              {roster.map((c) => (
                <li key={c.usuarioId} className={styles.listaItem}>
                  <button type="button" className={styles.escolher} onClick={() => handleSelecionarConta(c)}>
                    <PontesAvatar name={c.nome} size={36} />
                    <span className={styles.escolherTexto}>
                      <span className={styles.nome}>{c.nome}</span>
                      <span className={styles.mascarado}>{c.emailMascarado}</span>
                    </span>
                    <ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" className={styles.seta} />
                  </button>
                  <button
                    type="button"
                    className={styles.remover}
                    title="Remover desta lista"
                    aria-label={`Remover ${c.nome} desta lista`}
                    onClick={() => handleRemoverConta(c.usuarioId)}
                  >
                    <Trash2 size={15} strokeWidth={2} />
                  </button>
                </li>
              ))}
              <li className={styles.listaItem}>
                <button type="button" className={`${styles.escolher} ${styles.outra}`} onClick={irParaOutraConta}>
                  <span className={styles.avatarNeutro}><UserPlus size={16} strokeWidth={2} aria-hidden="true" /></span>
                  <span className={styles.nome}>Entrar em outra conta</span>
                </button>
              </li>
            </ul>
          )}

          {passo === 'form' && (
            /* Passo 1 — e-mail + senha */
            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              {error && <PontesAlert tone="error">{error}</PontesAlert>}

              {!contaSelecionada && (
                <PontesField label="E-mail" htmlFor="login-email" error={errors.email}>
                  <PontesInput
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })) }}
                    invalid={!!errors.email}
                    autoComplete="email"
                  />
                </PontesField>
              )}

              <PontesField label="Senha" htmlFor="login-senha" error={errors.password}>
                <PontesInput
                  id="login-senha"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })) }}
                  invalid={!!errors.password}
                  autoComplete="current-password"
                  autoFocus={!!contaSelecionada}
                  iconEnd={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      data-testid="toggle-senha"
                      tabIndex={-1}
                      className={styles.eyeBtn}
                      title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />
              </PontesField>

              <div className={styles.opcoes}>
                <PontesCheckbox checked={manterConectado} onChange={setManterConectado} label="Manter-me conectado" />
                <button type="button" className={styles.linkBtn} onClick={() => { setEsqueci(true); limparErros() }}>
                  Esqueci a senha
                </button>
              </div>

              <PontesButton type="submit" variant="primary" size="lg" fullWidth loading={isLoading} disabled={isLoading}
                iconEnd={<ArrowRight size={16} strokeWidth={2.5} />}>
                Entrar
              </PontesButton>
            </form>
          )}

          {passo === 'mfa' && (
            /* Passo 2 — código MFA */
            <form onSubmit={handleMfaSubmit} className={styles.form} noValidate>
              <PontesField label="Código" htmlFor="mfa-codigo" error={mfaErro}>
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

              <PontesCheckbox checked={confiarDispositivo} onChange={setConfiarDispositivo} label="Confiar neste dispositivo por 30 dias" />

              <PontesButton type="submit" variant="primary" size="lg" fullWidth loading={isLoading} disabled={isLoading}>
                Verificar
              </PontesButton>
            </form>
          )}

          {passo === 'esqueci' && (esqueciEnviado ? (
            <PontesAlert tone="success">
              Se existir uma conta com esse e-mail, o link para criar uma senha nova já foi enviado. Confira a caixa de entrada (e o spam).
            </PontesAlert>
          ) : (
            <form onSubmit={handleEsqueciSubmit} className={styles.form} noValidate>
              {error && <PontesAlert tone="error">{error}</PontesAlert>}
              <PontesField label="E-mail" htmlFor="esqueci-email" error={errors.email}>
                <PontesInput
                  id="esqueci-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })) }}
                  invalid={!!errors.email}
                />
              </PontesField>
              <PontesButton type="submit" variant="primary" size="lg" fullWidth loading={isLoading} disabled={isLoading}>
                Enviar link
              </PontesButton>
            </form>
          ))}

          {passo === 'exclusao' && (
            /* Conta na carência — oferece reativar */
            <div className={styles.form}>
              {reativarErro && <PontesAlert tone="error">{reativarErro}</PontesAlert>}
              <PontesAlert tone="warning">
                {marcada!.dias != null
                  ? `Faltam ${marcada!.dias} dia(s) para a remoção permanente. Reative para voltar a usar sua conta.`
                  : 'Reative para voltar a usar sua conta antes da remoção permanente.'}
              </PontesAlert>
              <PontesButton type="button" variant="primary" size="lg" fullWidth loading={isLoading} disabled={isLoading}
                onClick={handleReativar}>
                Reativar conta
              </PontesButton>
            </div>
          )}

          <p className={styles.footer}>
            Ao entrar você concorda com os{' '}
            <Link to="/termos-de-uso" target="_blank">Termos de Uso</Link>
            {' '}e a{' '}
            <Link to="/privacidade" target="_blank">Política de Privacidade</Link>.
          </p>
        </div>
      </main>

      {/* Atalho de DEV — contas de teste (só em desenvolvimento; nunca em produção). Card no canto, recolhe. */}
      {import.meta.env.DEV && (devAberto ? (
        <div className={styles.dev}>
          <div className={styles.devTopo}>
            <span>DEV · clique pra preencher</span>
            <button type="button" onClick={() => alternarDev(false)} aria-label="Recolher contas de teste" title="Recolher">
              <PanelRightClose size={16} strokeWidth={2.2} />
            </button>
          </div>
          {devContas.map((conta) => (
            <button
              key={conta.email}
              type="button"
              className={styles.devItem}
              onClick={() => {
                setEmail(conta.email)
                // Senha própria (conta criada à mão): preenche só o e-mail, você digita a senha.
                setPassword(conta.senhaPadrao === false ? '' : DEV_SENHA)
                setContaSelecionada(null); setUsarOutra(true); setEsqueci(false); setEsqueciEnviado(false)
                limparErros()
              }}
              title={conta.senhaPadrao === false
                ? `Preencher e-mail de ${conta.label} (senha própria — digite)`
                : `Entrar como ${conta.label}`}
            >
              <span className={styles.devNome}>{conta.label}{conta.senhaPadrao === false ? ' · senha própria' : ''}</span>
              <span className={styles.devEmail}>{conta.email}</span>
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className={styles.devReabrir} onClick={() => alternarDev(true)}
          aria-label="Mostrar contas de teste (DEV)" title="Contas de teste (DEV)">
          <PanelRightOpen size={16} strokeWidth={2.2} />
          <span>DEV</span>
        </button>
      ))}
    </div>
  )
}
