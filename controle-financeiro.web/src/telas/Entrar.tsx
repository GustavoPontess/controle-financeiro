// Login: contas lembradas (roster, e-mail preenchido ao escolher), e-mail + senha (mostrar/ocultar), manter
// conectado, verificação em duas etapas (MFA, confiar no dispositivo), conta em carência de exclusão (reativar),
// pedir acesso, termos, e o painel DEV de contas de teste (só em desenvolvimento). O visual é o do rascunho aprovado
// (rascunhos/entrar.html do hub Pontes Dev, 2026-10-26): cada estado é uma <section data-passo> da MolduraAcesso.
import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import MolduraAcesso, { CampoAcesso, Seta, VoltarA } from "../site/MolduraAcesso"
import css from "../site/Acesso.module.css"
import { BarraDev, useEstadoDev, useSemInatividadeDev } from "../dev/BarraDev"
import { CONTAS_EXEMPLO, ESTADOS_ACESSO } from "../dev/estadosAcesso"
import rosterService, { type ContaLembrada } from "../services/rosterService"
import mfaService from "../services/mfaService"
import { api, codigoDoErro, mensagemDeErro, sessaoCaiuPorInatividade } from "../api/cliente"
import { useAuth } from "../auth/useAuth"
import VerificacaoHumana, { useVerificacaoHumana } from "../componentes/VerificacaoHumana"
import { propsDeLinkInterno } from "../pwa/instalar"

// Senha padrão das contas de TESTE do seeder de dev (nunca uma senha real; não existe em produção).
const DEV_SENHA = "Dev@123456"
type DevConta = { email: string; nome: string; senhaPadrao: boolean }
type Passo = "escolher" | "form" | "mfa" | "exclusao" | "esqueci"

const AVISO_ESPERA = "Muitas tentativas. Espere o contador pra tentar de novo."
const iniciais = (nome: string) => nome.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()
const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

export default function Entrar() {
  const { entrar, verificarMfa, reativar, adicionarConta, autenticado, carregando } = useAuth()
  const navigate = useNavigate()
  const { state, search } = useLocation()
  const contaExcluida = !!(state as { contaExcluida?: boolean } | null)?.contaExcluida
  // Saiu por ficar parado: pela tela (SairPorInatividade manda ?motivo=inatividade) ou pelo servidor (SESSAO_INATIVA).
  const saiuPorInatividade = new URLSearchParams(search).get("motivo") === "inatividade" || sessaoCaiuPorInatividade()

  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [manter, setManter] = useState(false)
  // DEV: "Sem sair por inatividade" ligado no painel marca o "Manter-me conectado" (no build é sempre false).
  const semInatividadeDev = useSemInatividadeDev()
  useEffect(() => { if (semInatividadeDev) setManter(true) }, [semInatividadeDev])
  const [erros, setErros] = useState<{ email?: string; senha?: string }>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  // "Não sou robô" (Turnstile): no login só depois de uma senha errada; no "Esqueci a senha", sempre (manda e-mail).
  const verif = useVerificacaoHumana()
  const [pedirVerificacao, setPedirVerificacao] = useState(false)
  // Bloqueio por excesso de tentativas (429): segundos que faltam; o botão fica travado com o contador.
  const [espera, setEspera] = useState(0)
  useEffect(() => {
    if (espera <= 0) { setErro((e) => (e === AVISO_ESPERA ? null : e)); return } // acabou: some o aviso
    const t = setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])

  // Contas lembradas neste navegador (roster do servidor, por dispositivo; só nome + e-mail mascarado).
  const [roster, setRoster] = useState<ContaLembrada[]>([])
  const [usarOutra, setUsarOutra] = useState(false)
  const [contaSelecionada, setContaSelecionada] = useState<ContaLembrada | null>(null)

  // 2º passo (MFA) e carência de exclusão.
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null)
  const [mfaCodigo, setMfaCodigo] = useState("")
  const [mfaErro, setMfaErro] = useState<string | null>(null)
  const [confiar, setConfiar] = useState(false)
  const [marcada, setMarcada] = useState<{ dias: number | null; token: string | null } | null>(null)
  const [reativarErro, setReativarErro] = useState<string | null>(null)
  // "Esqueci a senha": pede o e-mail e a API manda o link (resposta igual pra qualquer e-mail).
  // Chegar com `state.esqueci` (da tela de redefinir senha, link vencido) abre direto no pedido do link.
  const [esqueci, setEsqueci] = useState(() => !!(state as { esqueci?: boolean } | null)?.esqueci)
  const [esqueciEnviado, setEsqueciEnviado] = useState(false)

  // Painel DEV: contas reais do banco local (endpoint só de dev); clique preenche.
  const [devContas, setDevContas] = useState<DevConta[]>([])

  // `?previa` ou o #estado da barra de dev (só em dev): mostra a tela mesmo logado, pra olhar o visual sem sair da conta.
  const previa = import.meta.env.DEV && (new URLSearchParams(window.location.search).has("previa") || !!window.location.hash)
  // `?adicionar` (logado): conecta OUTRA conta sem sair desta (menu da conta → "Adicionar conta").
  const adicionar = autenticado && new URLSearchParams(window.location.search).has("adicionar")
  // Entrando agora: quem decide pra onde vai é o pós-login (convite de MFA ou Visão geral), não o "já logado".
  const entrando = useRef(false)
  useEffect(() => { if (!carregando && autenticado && !previa && !adicionar && !entrando.current) navigate("/dashboard", { replace: true }) }, [autenticado, carregando, navigate, previa, adicionar])
  useEffect(() => { rosterService.listar().then((r) => setRoster((atual) => (r.length ? r : atual))).catch(() => { /* fica como está */ }) }, [])
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

  // DEV: a barra de estados põe a tela direto em cada passo (sem login nem API). Some no build.
  useEstadoDev(import.meta.env.DEV ? (e) => {
    setMarcada(null); setMfaChallenge(null); setMfaCodigo(""); setEsqueci(false); setEsqueciEnviado(false)
    setContaSelecionada(null); setUsarOutra(true); limparErros()
    if (e === "contas") { setUsarOutra(false); setRoster((r) => (r.length ? r : CONTAS_EXEMPLO)) }
    else if (e === "duas-etapas") setMfaChallenge("dev")
    else if (e === "esqueci") setEsqueci(true)
    else if (e === "link-enviado") { setEsqueci(true); setEsqueciEnviado(true) }
    else if (e === "reativar") setMarcada({ dias: 23, token: null })
  } : undefined)

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
    else if (r.tipo === "exclusao") { entrando.current = false; setMarcada({ dias: r.diasRestantes, token: r.reativacaoToken }) }
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
    const comVerificacao = pedirVerificacao && !!verif.chave
    setEnviando(true)
    // A caixinha pode ainda estar gerando o token (depois de um erro ela renova): espera em vez de travar.
    const token = comVerificacao ? await verif.aguardarToken() : null
    if (comVerificacao && !token) { setEnviando(false); setErro("Confirme que você não é um robô."); return }
    try {
      if (adicionar) { await adicionarConta(email.trim(), senha, token); navigate("/dashboard", { replace: true }); return }
      entrando.current = true
      await tratarResultado(await entrar(email.trim(), senha, manter, token))
    } catch (err) {
      entrando.current = false
      const segundos = (err as { esperarSegundos?: number | null }).esperarSegundos
      if (segundos) { setEspera(segundos); setErro(AVISO_ESPERA) }
      else setErro(err instanceof Error ? err.message : "Não foi possível entrar.")
      // Errou (ou faltou a verificação): a próxima tentativa deste e-mail pede o "não sou robô".
      setPedirVerificacao(true)
      if (comVerificacao) verif.novaRodada() // o token já foi gasto
    } finally { setEnviando(false) }
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
    const token = verif.chave ? await verif.aguardarToken() : null
    if (verif.chave && !token) { setEnviando(false); setErro("Confirme que você não é um robô."); return }
    try {
      await api.post("/auth/forgot-password", { email: email.trim(), turnstileToken: token ?? undefined }, { skipErrorToast: true })
      setEsqueciEnviado(true)
    } catch (err) {
      setErro(codigoDoErro(err) === "VERIFICACAO_HUMANA" ? mensagemDeErro(err) : "Não foi possível enviar agora. Tente de novo em instantes.")
      verif.novaRodada()
    } finally { setEnviando(false) }
  }

  const reativarConta = async () => {
    setReativarErro(null)
    setEnviando(true)
    try {
      if (!marcada?.token) throw new Error("Entre de novo pra reativar a conta.")
      await reativar(marcada.token)
      setMarcada(null)
      entrando.current = true
      await tratarResultado(await entrar(email.trim(), senha, manter))
    } catch (err) { entrando.current = false; setReativarErro(err instanceof Error ? err.message : "Não foi possível reativar a conta.") }
    finally { setEnviando(false) }
  }

  const vista = passo === "escolher" ? "contas" : passo === "form" ? "entrar" : passo === "mfa" ? "duas-etapas" : passo === "exclusao" ? "reativar" : esqueciEnviado ? "link-enviado" : "esqueci"
  const tituloContas = adicionar ? "Qual conta conectar?" : "Escolha sua conta"
  const voltarAoLogin = {
    mfa: () => { setMfaChallenge(null); setMfaCodigo(""); setMfaErro(null); setConfiar(false) },
    exclusao: () => { setMarcada(null); setReativarErro(null); setSenha("") },
    esqueci: () => { setEsqueci(false); setEsqueciEnviado(false); limparErros() },
  }
  const avisoExcluida = (contaExcluida && <p className="aviso-a" role="status">Sua conta foi marcada pra exclusão. Pra reativar, é só entrar de novo em até 30 dias.</p>)
    || (saiuPorInatividade && !adicionar && <p className="aviso-a" role="status">Você saiu porque ficou um tempo sem usar o app. Entre de novo.</p>)

  return (
    <MolduraAcesso titulo="Entrar · Pontes" foto="1740679954227-a0cd19c042a6-1400.webp" frase="O dinheiro da casa," fraseSuave="sem briga."
      lead="Um lugar só pra você e pra quem divide a casa com você. Divisão clara, aprovação de despesas e o acerto do mês pronto."
      benef={["Divisão meio a meio, pela renda ou por porcentagem", "Aprovação de gasto grande em 1 toque", "Conexão com Open Finance (em breve)"]}>

      {/* Contas lembradas neste navegador */}
      {passo === "escolher" && (
        <section data-passo="contas" className="ativo">
          {adicionar && <VoltarA onClick={() => navigate("/dashboard")}>Voltar</VoltarA>}
          <h1>{tituloContas}</h1>
          <p className="sub">Contas que já entraram neste navegador.</p>
          {avisoExcluida}
          <ul className="contas">
            {roster.map((c) => (
              <li key={c.usuarioId} className="conta">
                <button type="button" className="conta-bt" onClick={() => void escolherConta(c)}>
                  <span className="av-a">{iniciais(c.nome)}</span><span><b>{c.nome}</b><small>{c.emailMascarado}</small></span><span className="seta-c seta">→</span>
                </button>
                <button type="button" className="remover-bt" aria-label={`Remover ${c.nome} desta lista`} title="Remover desta lista" onClick={() => void removerConta(c.usuarioId)}>
                  <svg><use href="#i-lixo" /></svg>
                </button>
              </li>
            ))}
            <li className="conta">
              <button type="button" className="conta-bt" onClick={outraConta}>
                <span className="av-a neutro"><svg className="ic-a"><use href="#i-pessoa-mais" /></svg></span><span><b>Entrar em outra conta</b></span>
              </button>
            </li>
          </ul>
        </section>
      )}

      {/* E-mail e senha */}
      {passo === "form" && (
        <section data-passo="entrar" className="ativo">
          {adicionar && roster.length === 0 && <VoltarA onClick={() => navigate("/dashboard")}>Voltar</VoltarA>}
          {roster.length > 0 && (contaSelecionada ? (
            <button type="button" className="chip-a" title="Trocar de conta" onClick={voltarEscolher}>
              <span className="av-a">{iniciais(contaSelecionada.nome)}</span><span>{contaSelecionada.nome}</span> ▾
            </button>
          ) : <VoltarA onClick={voltarEscolher}>Escolher conta salva</VoltarA>)}
          <h1>{adicionar ? "Adicionar conta" : "Bem-vindo de volta"}</h1>
          <p className="sub">Ainda não tem acesso? <Link to="/cadastro">Pedir acesso</Link></p>
          {avisoExcluida}
          <form className="form-a" onSubmit={enviar} noValidate>
            {erro && <p className={`erro ${css.erroTopo}`} role="alert">{erro}</p>}
            {!contaSelecionada && (
              <CampoAcesso rotulo="E-mail" erro={erros.email} type="email" name="email" autoComplete="email" value={email}
                onChange={(e) => { setEmail(e.target.value); setErros((p) => ({ ...p, email: undefined })) }} />
            )}
            <CampoAcesso rotulo="Senha" senha erro={erros.senha} name="senha" autoComplete="current-password" value={senha}
              autoFocus={!!contaSelecionada} onChange={(e) => { setSenha(e.target.value); setErros((p) => ({ ...p, senha: undefined })) }} />
            <div className="opcoes">
              <label className="marcar"><input type="checkbox" checked={manter} onChange={(e) => setManter(e.target.checked)} /> Manter-me conectado</label>
              <button type="button" className="link-a" onClick={() => { setEsqueci(true); limparErros() }}>Esqueci a senha</button>
            </div>
            {pedirVerificacao && verif.chave && <VerificacaoHumana chave={verif.chave} rodada={verif.rodada} aoMudar={verif.setToken} />}
            <button className="btn btn--acc btn-cheio" type="submit" disabled={enviando || espera > 0 || (pedirVerificacao && !!verif.chave && !verif.token)}>
              {espera > 0 ? `Tente de novo em ${Math.floor(espera / 60)}:${String(espera % 60).padStart(2, "0")}` : enviando ? "Entrando…" : <>Entrar <Seta /></>}
            </button>
          </form>
        </section>
      )}

      {/* Verificação em duas etapas */}
      {passo === "mfa" && (
        <section data-passo="duas-etapas" className="ativo">
          <VoltarA onClick={voltarAoLogin.mfa}>Voltar ao login</VoltarA>
          <h1>Verificação em duas etapas</h1>
          <p className="sub">Digite o código do seu app autenticador (ou um código de recuperação).</p>
          <form className="form-a" onSubmit={enviarMfa} noValidate>
            <CampoAcesso rotulo="Código" codigo erro={mfaErro} name="codigo" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false}
              maxLength={10} autoFocus placeholder="000000" value={mfaCodigo} onChange={(e) => { setMfaCodigo(e.target.value); setMfaErro(null) }} />
            <label className="marcar"><input type="checkbox" checked={confiar} onChange={(e) => setConfiar(e.target.checked)} /> Confiar neste dispositivo por 30 dias</label>
            <button className="btn btn--acc btn-cheio" type="submit" disabled={enviando}>{enviando ? "Verificando…" : "Verificar"}</button>
          </form>
        </section>
      )}

      {/* Esqueci a senha */}
      {passo === "esqueci" && !esqueciEnviado && (
        <section data-passo="esqueci" className="ativo">
          <VoltarA onClick={voltarAoLogin.esqueci}>Voltar ao login</VoltarA>
          <h1>Recuperar senha</h1>
          <p className="sub">Informe seu e-mail. Se existir uma conta, enviamos um link pra criar uma senha nova.</p>
          <form className="form-a" onSubmit={enviarEsqueci} noValidate>
            {erro && <p className={`erro ${css.erroTopo}`} role="alert">{erro}</p>}
            <CampoAcesso rotulo="E-mail" erro={erros.email} type="email" name="email" autoComplete="email" autoFocus value={email}
              onChange={(e) => { setEmail(e.target.value); setErros((p) => ({ ...p, email: undefined })) }} />
            {verif.chave && <VerificacaoHumana chave={verif.chave} rodada={verif.rodada} aoMudar={verif.setToken} />}
            <button className="btn btn--acc btn-cheio" type="submit" disabled={enviando || (!!verif.chave && !verif.token)}>{enviando ? "Enviando…" : "Enviar link"}</button>
          </form>
        </section>
      )}
      {passo === "esqueci" && esqueciEnviado && (
        <section data-passo="link-enviado" className="ativo">
          <VoltarA onClick={voltarAoLogin.esqueci}>Voltar ao login</VoltarA>
          <h1>Confira o seu e-mail</h1>
          <p className="alerta-ok" role="status">Se existir uma conta com esse e-mail, o link pra criar uma senha nova já foi enviado. Confira a caixa de entrada (e o spam).</p>
          <p className={`sub ${css.depois}`}>O link abre a tela de <Link to="/redefinir-senha">criar uma senha nova</Link>.</p>
        </section>
      )}

      {/* Conta marcada pra exclusão */}
      {passo === "exclusao" && (
        <section data-passo="reativar" className="ativo">
          <VoltarA onClick={voltarAoLogin.exclusao}>Voltar ao login</VoltarA>
          <h1>Reativar conta</h1>
          <p className="sub">Sua conta está marcada pra exclusão. Você ainda pode reativá-la.</p>
          <div className="form-a">
            {reativarErro && <p className={`erro ${css.erroTopo}`} role="alert">{reativarErro}</p>}
            <p className="aviso-a">
              {marcada?.dias != null
                ? `Faltam ${marcada.dias} ${marcada.dias === 1 ? "dia" : "dias"} pra remoção permanente. Reative pra voltar a usar a sua conta.`
                : "Reative pra voltar a usar a sua conta antes da remoção permanente."}
            </p>
            <button className="btn btn--acc btn-cheio" type="button" disabled={enviando} onClick={() => void reativarConta()}>{enviando ? "Reativando…" : "Reativar conta"}</button>
          </div>
        </section>
      )}

      <p className="rodape-a">
        Ao entrar você concorda com os <Link to="/termos-de-uso" {...propsDeLinkInterno()}>Termos de Uso</Link> e a{" "}
        <Link to="/privacidade" {...propsDeLinkInterno()}>Política de Privacidade</Link>.
      </p>

      {/* DEV: painel único (estados da tela + contas de teste do banco local), nunca em produção. */}
      {import.meta.env.DEV && (
        <BarraDev grupos={ESTADOS_ACESSO} atual={vista} extras={{
          titulo: "Contas de teste (preenche o login)",
          itens: devContas.map((c) => ({
            rotulo: c.nome + (c.senhaPadrao ? "" : " · senha própria"),
            detalhe: c.email,
            dica: c.senhaPadrao ? `Entrar como ${c.nome}` : `Preencher e-mail de ${c.nome} (senha própria, digite)`,
            aoClicar: () => {
              setEmail(c.email); setSenha(c.senhaPadrao ? DEV_SENHA : ""); setContaSelecionada(null); setUsarOutra(true); limparErros()
              setMarcada(null); setMfaChallenge(null); setEsqueci(false); setEsqueciEnviado(false)
            },
          })),
        }} />
      )}
    </MolduraAcesso>
  )
}
