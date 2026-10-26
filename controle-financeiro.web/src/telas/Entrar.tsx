// Login do v2 — tudo que o app atual tem, redesenhado: contas lembradas (roster, e-mail preenchido ao
// escolher), e-mail + senha (mostrar/ocultar), manter conectado, verificação em duas etapas (MFA, confiar no
// dispositivo), conta em carência de exclusão (reativar), criar conta, termos, e o painel DEV de contas
// de teste (só em desenvolvimento). Quem já entrou no app atual nem vê esta tela (cookie compartilhado).
import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, ArrowRight, Check, ChevronDown, Eye, EyeOff, PanelRightClose, PanelRightOpen, Trash2, UserPlus } from "lucide-react"
import Logo from "../componentes/Logo"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import rosterService, { type ContaLembrada } from "../services/rosterService"
import mfaService from "../services/mfaService"
import { api } from "../api/cliente"
import { useAuth } from "../auth/useAuth"
import styles from "./Auth.module.css"

// Senha padrão das contas de TESTE do seeder de dev (nunca uma senha real; não existe em produção).
const DEV_SENHA = "Dev@123456"
type DevConta = { email: string; nome: string; senhaPadrao: boolean }
type Passo = "escolher" | "form" | "mfa" | "exclusao" | "esqueci"

const iniciais = (nome: string) => nome.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()
const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

export default function Entrar() {
  const { entrar, verificarMfa, reativar, adicionarConta, autenticado, carregando } = useAuth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const contaExcluida = !!(state as { contaExcluida?: boolean } | null)?.contaExcluida

  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [manter, setManter] = useState(false)
  const [erros, setErros] = useState<{ email?: string; senha?: string }>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Contas lembradas neste navegador (roster do servidor, por dispositivo; só nome + e-mail mascarado).
  const [roster, setRoster] = useState<ContaLembrada[]>([])
  const [usarOutra, setUsarOutra] = useState(false)
  const [contaSelecionada, setContaSelecionada] = useState<ContaLembrada | null>(null)

  // 2º passo (MFA) e carência de exclusão.
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null)
  const [mfaCodigo, setMfaCodigo] = useState("")
  const [mfaErro, setMfaErro] = useState<string | null>(null)
  const [confiar, setConfiar] = useState(false)
  const [marcada, setMarcada] = useState<{ dias: number | null } | null>(null)
  const [reativarErro, setReativarErro] = useState<string | null>(null)
  // "Esqueci a senha": pede o e-mail e a API manda o link (resposta igual pra qualquer e-mail).
  // Chegar com `state.esqueci` (da tela de redefinir senha, link vencido) abre direto no pedido do link.
  const [esqueci, setEsqueci] = useState(() => !!(state as { esqueci?: boolean } | null)?.esqueci)
  const [esqueciEnviado, setEsqueciEnviado] = useState(false)

  // Painel DEV: contas reais do banco local (endpoint só de dev); clique preenche.
  const [devContas, setDevContas] = useState<DevConta[]>([])
  const [devAberto, setDevAberto] = useState(() => { try { return localStorage.getItem("devPanelRecolhido") !== "1" } catch { return true } })
  const alternarDev = (aberto: boolean) => { setDevAberto(aberto); try { localStorage.setItem("devPanelRecolhido", aberto ? "0" : "1") } catch { /* ignore */ } }

  // `?previa` (só em dev): mostra a tela mesmo logado, pra olhar o visual sem precisar sair da conta.
  const previa = import.meta.env.DEV && new URLSearchParams(window.location.search).has("previa")
  // `?adicionar` (logado): conecta OUTRA conta sem sair desta (menu da conta → "Adicionar conta").
  const adicionar = autenticado && new URLSearchParams(window.location.search).has("adicionar")
  // Entrando agora: quem decide pra onde vai é o pós-login (convite de MFA ou Visão geral), não o "já logado".
  const entrando = useRef(false)
  useEffect(() => { if (!carregando && autenticado && !previa && !adicionar && !entrando.current) navigate("/dashboard", { replace: true }) }, [autenticado, carregando, navigate, previa, adicionar])
  useEffect(() => { rosterService.listar().then(setRoster).catch(() => setRoster([])) }, [])
  // Painel DEV: se a API ainda está subindo (reinício em dev), o proxy responde erro — tenta de novo a cada
  // 3s por até 1 min, em vez de ficar sem painel até recarregar a página.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    let vivo = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const tentar = (restantes: number) => {
      api.get<DevConta[]>("/auth/dev/contas", { skipErrorToast: true })
        .then((r) => { if (vivo) setDevContas(r.data) })
        .catch(() => { if (vivo && restantes > 0) timer = setTimeout(() => tentar(restantes - 1), 3000) })
    }
    tentar(20)
    return () => { vivo = false; if (timer) clearTimeout(timer) }
  }, [])

  const passo: Passo = marcada ? "exclusao" : mfaChallenge ? "mfa" : esqueci ? "esqueci" : roster.length > 0 && !usarOutra ? "escolher" : "form"

  const limparErros = () => { setErros({}); setErro(null) }

  const escolherConta = async (c: ContaLembrada) => {
    try { setEmail(await rosterService.obterEmail(c.usuarioId)); setContaSelecionada(c) }
    catch { setContaSelecionada(null) }
    limparErros(); setUsarOutra(true)
  }
  const outraConta = () => { setContaSelecionada(null); setEmail(""); limparErros(); setUsarOutra(true) }
  const voltarEscolher = () => { setUsarOutra(false); setContaSelecionada(null); setSenha(""); limparErros() }
  const removerConta = async (usuarioId: string) => {
    try { await rosterService.remover(usuarioId) } catch { /* ignore */ }
    setRoster((r) => r.filter((c) => c.usuarioId !== usuarioId))
  }

  // Entrou: com MFA desligado e convite valendo, passa por "Proteja sua conta" antes da Visão geral.
  const depoisDeEntrar = async () => {
    let convite = false
    try { convite = (await mfaService.status()).mostrarConvite } catch { /* sem convite */ }
    navigate(convite ? "/proteja-sua-conta" : "/dashboard", { replace: true })
  }

  const tratarResultado = async (r: Awaited<ReturnType<typeof entrar>>) => {
    if (r.tipo === "mfa") { entrando.current = false; setMfaChallenge(r.challengeToken) }
    else if (r.tipo === "exclusao") { entrando.current = false; setMarcada({ dias: r.diasRestantes }) }
    else await depoisDeEntrar()
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro(null)
    const novos: typeof erros = {}
    if (!email.trim()) novos.email = "Informe o e-mail"
    else if (!emailValido(email)) novos.email = "E-mail inválido"
    if (!senha) novos.senha = "Informe a senha"
    setErros(novos)
    if (Object.keys(novos).length) return
    setEnviando(true)
    if (adicionar) {
      try { await adicionarConta(email.trim(), senha); navigate("/dashboard", { replace: true }) }
      catch (err) { setErro(err instanceof Error ? err.message : "Não foi possível conectar a conta.") }
      finally { setEnviando(false) }
      return
    }
    entrando.current = true
    try { await tratarResultado(await entrar(email.trim(), senha, manter)) }
    catch (err) { entrando.current = false; setErro(err instanceof Error ? err.message : "Não foi possível entrar.") }
    finally { setEnviando(false) }
  }

  const enviarMfa = async (e: FormEvent) => {
    e.preventDefault()
    setMfaErro(null)
    if (!mfaCodigo.trim()) { setMfaErro("Informe o código"); return }
    setEnviando(true)
    try { await verificarMfa(mfaChallenge!, mfaCodigo.trim(), confiar, manter); navigate("/dashboard", { replace: true }) }
    catch (err) { setMfaErro(err instanceof Error ? err.message : "Código inválido") }
    finally { setEnviando(false) }
  }

  const enviarEsqueci = async (e: FormEvent) => {
    e.preventDefault()
    setErro(null)
    if (!email.trim() || !emailValido(email)) { setErros({ email: !email.trim() ? "Informe o e-mail" : "E-mail inválido" }); return }
    setEnviando(true)
    try { await api.post("/auth/forgot-password", { email: email.trim() }, { skipErrorToast: true }); setEsqueciEnviado(true) }
    catch { setErro("Não foi possível enviar agora. Tente de novo em instantes.") }
    finally { setEnviando(false) }
  }

  const reativarConta = async () => {
    setReativarErro(null)
    setEnviando(true)
    try {
      await reativar(email.trim(), senha)
      setMarcada(null)
      entrando.current = true
      await tratarResultado(await entrar(email.trim(), senha, manter))
    } catch (err) { entrando.current = false; setReativarErro(err instanceof Error ? err.message : "Não foi possível reativar a conta.") }
    finally { setEnviando(false) }
  }

  const titulo = passo === "exclusao" ? "Reativar conta" : passo === "mfa" ? "Verificação em duas etapas" : passo === "esqueci" ? "Recuperar senha" : passo === "escolher" ? (adicionar ? "Qual conta conectar?" : "Escolha sua conta") : adicionar ? "Adicionar conta" : "Bem-vindo de volta"

  return (
    <div className={`v2 ${styles.raiz}`}>
      <aside className={styles.palco}>
        <div className={styles.marca}><Logo size={28} /></div>
        <div className={styles.palcoMeio}>
          <p className={styles.frase}>Finanças em família, <span className={styles.fraseSuave}>sem briga.</span></p>
          <p className={styles.lead}>Um lugar só para você, seu parceiro e seu contador. Rateio claro, aprovação de despesas, visão completa.</p>
          <ul className={styles.beneficios}>
            {["Rateio explícito: 50/50, % ou valor fixo", "Aprovação de despesa em 1 toque", "Conexão com Open Finance (em breve)"].map((t) => (
              <li key={t}><span className={styles.check}><Check size={12} strokeWidth={3} aria-hidden="true" /></span>{t}</li>
            ))}
          </ul>
        </div>
        <span className={styles.palcoRodape}>Pontes · finanças pessoais e familiares</span>
      </aside>

      <main className={styles.painel}>
        <div className={styles.painelMiolo}>
          {/* Um "voltar" só, contextual */}
          {adicionar && (passo === "escolher" || (passo === "form" && roster.length === 0)) && (
            <button type="button" className={styles.voltar} onClick={() => navigate("/dashboard")}>
              <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" /> Voltar
            </button>
          )}
          {passo === "mfa" ? (
            <button type="button" className={styles.voltar} onClick={() => { setMfaChallenge(null); setMfaCodigo(""); setMfaErro(null); setConfiar(false) }}>
              <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" /> Voltar ao login
            </button>
          ) : passo === "exclusao" ? (
            <button type="button" className={styles.voltar} onClick={() => { setMarcada(null); setReativarErro(null); setSenha("") }}>
              <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" /> Voltar ao login
            </button>
          ) : passo === "esqueci" ? (
            <button type="button" className={styles.voltar} onClick={() => { setEsqueci(false); setEsqueciEnviado(false); limparErros() }}>
              <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" /> Voltar ao login
            </button>
          ) : passo === "form" && roster.length > 0 ? (
            contaSelecionada ? (
              <button type="button" className={styles.chip} onClick={voltarEscolher} title="Trocar de conta">
                <span className={styles.avatar}>{iniciais(contaSelecionada.nome)}</span>
                <span className={styles.chipTexto}>{contaSelecionada.nome} · {contaSelecionada.emailMascarado}</span>
                <ChevronDown size={16} strokeWidth={2.25} aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className={styles.voltar} onClick={voltarEscolher}>
                <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" /> Escolher conta salva
              </button>
            )
          ) : null}

          <div className={styles.marcaMovel}><Logo size={26} /></div>
          <h1 className={styles.titulo}>{titulo}</h1>
          {contaExcluida && (passo === "form" || passo === "escolher") && (
            <p className={styles.aviso} role="status">Sua conta foi marcada pra exclusão. Pra reativar, é só entrar de novo em até 30 dias.</p>
          )}
          {passo === "form" && <p className={styles.sub}>Ainda não tem acesso? <Link to="/cadastro">Pedir acesso</Link></p>}
          {passo === "mfa" && <p className={styles.sub}>Digite o código do seu app autenticador (ou um código de recuperação).</p>}
          {passo === "exclusao" && <p className={styles.sub}>Sua conta está marcada para exclusão. Você ainda pode reativá-la.</p>}
          {passo === "esqueci" && !esqueciEnviado && <p className={styles.sub}>Informe seu e-mail. Se existir uma conta, enviamos um link para criar uma senha nova.</p>}

          {passo === "escolher" && (
            <ul className={styles.lista}>
              {roster.map((c) => (
                <li key={c.usuarioId} className={styles.listaItem}>
                  <button type="button" className={styles.escolher} onClick={() => void escolherConta(c)}>
                    <span className={styles.avatar}>{iniciais(c.nome)}</span>
                    <span className={styles.escolherTexto}><span className={styles.nome}>{c.nome}</span><span className={styles.mascarado}>{c.emailMascarado}</span></span>
                    <ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" className={styles.seta} />
                  </button>
                  <button type="button" className={styles.remover} title="Remover desta lista" aria-label={`Remover ${c.nome} desta lista`} onClick={() => void removerConta(c.usuarioId)}>
                    <Trash2 size={15} strokeWidth={2} />
                  </button>
                </li>
              ))}
              <li className={styles.listaItem}>
                <button type="button" className={`${styles.escolher} ${styles.outra}`} onClick={outraConta}>
                  <span className={`${styles.avatar} ${styles.avatarNeutro}`}><UserPlus size={16} strokeWidth={2} aria-hidden="true" /></span>
                  <span className={styles.nome}>Entrar em outra conta</span>
                </button>
              </li>
            </ul>
          )}

          {passo === "form" && (
            <form className={styles.form} onSubmit={enviar} noValidate>
              {erro && <p className={styles.alerta} role="alert">{erro}</p>}
              {!contaSelecionada && (
                <Campo rotulo="E-mail" erro={erros.email}>
                  <Entrada type="email" autoComplete="email" value={email}
                    onChange={(e) => { setEmail(e.target.value); setErros((p) => ({ ...p, email: undefined })) }} />
                </Campo>
              )}
              <Campo rotulo="Senha" erro={erros.senha}>
                <Entrada type={mostrarSenha ? "text" : "password"} autoComplete="current-password" value={senha}
                  autoFocus={!!contaSelecionada} onChange={(e) => { setSenha(e.target.value); setErros((p) => ({ ...p, senha: undefined })) }}
                  sufixo={<Botao variante="texto" soIcone tabIndex={-1} aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                    onClick={() => setMostrarSenha((v) => !v)} icone={mostrarSenha ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />} />} />
              </Campo>
              <div className={styles.linhaOpcoes}>
                <label className={styles.lembrar}>
                  <input type="checkbox" checked={manter} onChange={(e) => setManter(e.target.checked)} /> Manter-me conectado
                </label>
                <button type="button" className={styles.link} onClick={() => { setEsqueci(true); limparErros() }}>Esqueci a senha</button>
              </div>
              <Botao variante="primario" tamanho="lg" cheio type="submit" disabled={enviando}>
                {enviando ? "Entrando…" : <>Entrar <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" /></>}
              </Botao>
            </form>
          )}

          {passo === "mfa" && (
            <form className={styles.form} onSubmit={enviarMfa} noValidate>
              <Campo rotulo="Código" erro={mfaErro}>
                <Entrada type="text" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} maxLength={10} autoFocus placeholder="000000" value={mfaCodigo}
                  onChange={(e) => { setMfaCodigo(e.target.value); setMfaErro(null) }} />
              </Campo>
              <label className={styles.lembrar}>
                <input type="checkbox" checked={confiar} onChange={(e) => setConfiar(e.target.checked)} /> Confiar neste dispositivo por 30 dias
              </label>
              <Botao variante="primario" tamanho="lg" cheio type="submit" disabled={enviando}>{enviando ? "Verificando…" : "Verificar"}</Botao>
            </form>
          )}

          {passo === "esqueci" && (esqueciEnviado ? (
            <p className={styles.ok}>Se existir uma conta com esse e-mail, o link para criar uma senha nova já foi enviado. Confira a caixa de entrada (e o spam).</p>
          ) : (
            <form className={styles.form} onSubmit={enviarEsqueci} noValidate>
              {erro && <p className={styles.alerta} role="alert">{erro}</p>}
              <Campo rotulo="E-mail" erro={erros.email}>
                <Entrada type="email" autoComplete="email" autoFocus value={email}
                  onChange={(e) => { setEmail(e.target.value); setErros((p) => ({ ...p, email: undefined })) }} />
              </Campo>
              <Botao variante="primario" tamanho="lg" cheio type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar link"}</Botao>
            </form>
          ))}

          {passo === "exclusao" && (
            <div className={styles.form}>
              {reativarErro && <p className={styles.alerta} role="alert">{reativarErro}</p>}
              <p className={styles.aviso}>
                {marcada?.dias != null
                  ? `Faltam ${marcada.dias} dia(s) para a remoção permanente. Reative para voltar a usar sua conta.`
                  : "Reative para voltar a usar sua conta antes da remoção permanente."}
              </p>
              <Botao variante="primario" tamanho="lg" cheio disabled={enviando} onClick={() => void reativarConta()}>
                {enviando ? "Reativando…" : "Reativar conta"}
              </Botao>
            </div>
          )}

          <p className={styles.rodape}>
            Ao entrar você concorda com os <Link to="/termos-de-uso" target="_blank" rel="noreferrer">Termos de Uso</Link> e a{" "}
            <Link to="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade</Link>.
          </p>
        </div>
      </main>

      {/* DEV: contas de teste do banco local — nunca em produção. */}
      {import.meta.env.DEV && devContas.length > 0 && (devAberto ? (
        <div className={styles.dev}>
          <div className={styles.devTopo}>
            <span>DEV · clique pra preencher</span>
            <button type="button" aria-label="Recolher contas de teste" title="Recolher" onClick={() => alternarDev(false)}><PanelRightClose size={16} strokeWidth={2.2} /></button>
          </div>
          {devContas.map((c) => (
            <button key={c.email} type="button" className={styles.devItem}
              title={c.senhaPadrao ? `Entrar como ${c.nome}` : `Preencher e-mail de ${c.nome} (senha própria, digite)`}
              onClick={() => { setEmail(c.email); setSenha(c.senhaPadrao ? DEV_SENHA : ""); setContaSelecionada(null); setUsarOutra(true); limparErros() }}>
              <span className={styles.devNome}>{c.nome}{c.senhaPadrao ? "" : " · senha própria"}</span>
              <span className={styles.devEmail}>{c.email}</span>
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className={styles.devReabrir} aria-label="Mostrar contas de teste (DEV)" title="Contas de teste (DEV)" onClick={() => alternarDev(true)}>
          <PanelRightOpen size={16} strokeWidth={2.2} /><span>DEV</span>
        </button>
      ))}
    </div>
  )
}
