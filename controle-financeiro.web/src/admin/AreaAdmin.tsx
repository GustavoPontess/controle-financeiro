// Admin do v2: o gate do beta, num MINI-APP À PARTE (admin.html + src/admin/main.tsx, entrada própria no build).
// Pedido do Gustavo 2026-10-25: "ninguém que usa o app normalmente pode ter ideia de onde fica o admin". O app comum
// não tem nenhuma linha que leve pra cá, nem a rota: em produção o Caddy só serve esta página no endereço secreto
// ADMIN_PATH, que vem do deploy (Caddyfile). Aqui dentro as rotas são relativas a esse endereço (basename).
// O servidor confere de novo em cada chamada (IsAdmin + duas etapas ligadas + conta Ativa). Duas páginas, planilha:
//  - Usuários (uma página e uma tabela só; Gustavo 2026-10-28): todo mundo, com busca e página NO SERVIDOR; quem espera
//    aprovação vem primeiro (ordem do servidor), com Aprovar (só e-mail confirmado) e Recusar na linha; Trocar senha e
//    Bloquear (ativos), Reativar (bloqueados).
// A própria conta não tem ação (o servidor também recusa bloquear a si mesmo). Exclusão LGPD e auditoria: depois.
import { useCallback, useEffect, useRef, useState } from "react"
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom"
import { ArrowLeft, Ban, Check, ChevronsUpDown, Eye, EyeOff, KeyRound, LogOut, MessageCircleMore, PanelLeftClose, PanelLeftOpen, RotateCcw, Settings, ShieldCheck, Users, X } from "lucide-react"
import adminService from "../services/adminService"
import mfaService from "../services/mfaService"
import { mensagemDeErro } from "../api/cliente"
import { useAuth } from "../auth/useAuth"
import { STATUS_LABEL, StatusUsuario, type MetricasAdmin, type UsuarioAdmin } from "../types/Admin"
import Avatar, { urlFoto } from "../componentes/Avatar"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Busca from "../componentes/Busca"
import Confirmar from "../componentes/Confirmar"
import Etiqueta from "../componentes/Etiqueta"
import Menu, { type ItemMenu } from "../componentes/Menu"
import Paginacao from "../componentes/Paginacao"
import Segmentos, { type OpcaoSegmento } from "../componentes/Segmentos"
import { diaDeInstante } from "../utils/dateTime"
import { mascararEmail } from "../utils/mascararEmail"
import { useHideBalance } from "../estado/ocultar"
import casca from "../layout/V2Layout.module.css"
import { irPara } from "./irPara"
import styles from "./AreaAdmin.module.css"
import SolicitacoesAdmin from "./SolicitacoesAdmin"

const TOM: Partial<Record<StatusUsuario, "positivo" | "negativo" | "alerta">> = {
  [StatusUsuario.Ativo]: "positivo",
  [StatusUsuario.AguardandoAprovacao]: "alerta",
  [StatusUsuario.Bloqueado]: "negativo",
  [StatusUsuario.MarcadoParaExclusao]: "negativo",
}

type Filtro = "todos" | "esperando" | "ativos" | "bloqueados" | "recusados"
const FILTROS: OpcaoSegmento<Filtro>[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "esperando", rotulo: "Esperando" },
  { valor: "ativos", rotulo: "Ativos" },
  { valor: "bloqueados", rotulo: "Bloqueados" },
  { valor: "recusados", rotulo: "Recusados" },
]
const STATUS_DO_FILTRO: Record<Exclude<Filtro, "todos">, StatusUsuario> = {
  esperando: StatusUsuario.AguardandoAprovacao,
  ativos: StatusUsuario.Ativo,
  bloqueados: StatusUsuario.Bloqueado,
  recusados: StatusUsuario.Recusado,
}

type Pedido =
  | { tipo: "recusar"; u: UsuarioAdmin }
  | { tipo: "bloquear"; u: UsuarioAdmin }
  | { tipo: "senha"; u: UsuarioAdmin }

const PAGINAS: { secao: string; rotulo: string; icone: typeof Users }[] = [
  { secao: "usuarios", rotulo: "Usuários", icone: Users },
  { secao: "solicitacoes", rotulo: "Solicitações", icone: MessageCircleMore },
]

/** O porteiro: sem login vai pro login do app; quem não é admin vai pra Visão geral, sem mensagem (não confirma que
 *  aqui existe algo). Admin sem as duas etapas ligadas vê só o pedido pra ligar (o servidor recusaria tudo). */
export default function AreaAdmin() {
  const { usuario, carregando, autenticado } = useAuth()
  const admin = !!usuario?.isAdmin
  const [duasEtapas, setDuasEtapas] = useState<boolean | null>(null)
  useEffect(() => {
    if (carregando) return
    if (!autenticado) irPara("/entrar")
    else if (!admin) irPara("/dashboard")
  }, [carregando, autenticado, admin])
  useEffect(() => {
    if (!admin) return
    mfaService.status().then((s) => setDuasEtapas(s.ativo)).catch(() => setDuasEtapas(false))
  }, [admin])
  if (carregando || !usuario || !admin || duasEtapas === null) return null
  if (!duasEtapas) return <LigarDuasEtapas />
  return <Casca meuId={usuario.id} />
}

function LigarDuasEtapas() {
  return (
    <div className={`v2 ${styles.porta}`}>
      <Bloco titulo="Ligue as duas etapas">
        <div className={styles.portaCorpo}>
          <p className={styles.portaTexto}>O admin só abre com o código do celular ligado na sua conta.</p>
          <Botao variante="primario" icone={<ShieldCheck size={16} strokeWidth={2.5} />} onClick={() => irPara("/configuracoes")}>Ir pra Configurações</Botao>
        </div>
      </Bloco>
    </div>
  )
}

/** O bloco da pessoa no pé do menu, igual ao do app (avatar + nome), com o menu da conta: a conta, Voltar ao app,
 *  Configurações e Sair. Sem trocar de espaço nem de conta (não é assunto do admin). O app mora fora deste mini-app:
 *  os links saem com irPara (página inteira), não pelo roteador. */
function ContaAdmin() {
  const { usuario, sair } = useAuth()
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false) }
    document.addEventListener("mousedown", fora); document.addEventListener("keydown", esc)
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc) }
  }, [aberto])
  const nome = usuario?.nome ?? ""
  const iniciais = nome.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?"
  const foto = urlFoto(usuario?.id, usuario?.fotoEm)
  return (
    <div className={casca.usuario} ref={ref}>
      <button type="button" className={casca.usuarioBotao} aria-label={nome || "Conta"} aria-haspopup="menu" aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}>
        <Avatar className={casca.avatar} foto={foto} texto={iniciais} />
        <span className={`${casca.usuarioTexto} ${casca.itemRotulo}`}>
          <span className={casca.usuarioNome}>{nome}</span>
          <span className={casca.usuarioPlano}>Administração</span>
        </span>
        <ChevronsUpDown size={15} strokeWidth={2} className={`${casca.usuarioSeta} ${casca.itemRotulo}`} aria-hidden="true" />
      </button>
      {aberto && (
        <div className={casca.menuUsuario} role="menu" aria-label="Conta">
          <div className={`${casca.menuItem} ${casca.menuConta}`}>
            <Avatar className={casca.avatar} foto={foto} texto={iniciais} />
            <span className={casca.menuContaTexto}>
              <span className={casca.usuarioNome}>{nome}</span>
              <span className={casca.usuarioPlano}>{usuario?.email}</span>
            </span>
          </div>
          <span className={casca.menuSeparador} aria-hidden="true" />
          <button type="button" role="menuitem" className={casca.menuItem} onClick={() => { setAberto(false); irPara("/dashboard") }}>
            <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" /> Voltar ao app
          </button>
          <button type="button" role="menuitem" className={casca.menuItem} onClick={() => { setAberto(false); irPara("/configuracoes") }}>
            <Settings size={16} strokeWidth={2} aria-hidden="true" /> Configurações
          </button>
          <span className={casca.menuSeparador} aria-hidden="true" />
          <button type="button" role="menuitem" className={casca.menuItem} onClick={() => { setAberto(false); void sair().then(() => irPara("/entrar")) }}>
            <LogOut size={16} strokeWidth={2} aria-hidden="true" /> Sair
          </button>
        </div>
      )}
    </div>
  )
}

/** Um número da faixa do topo (contagem; sem valor = carregando). */
function Numero({ rotulo, valor, alerta }: { rotulo: string; valor?: number; alerta?: boolean }) {
  return (
    <div className={styles.numero}>
      <span className={styles.rotulo}>{rotulo}</span>
      {valor === undefined ? <span className={styles.numeroEsqueleto} />
        : <span className={styles.numeroValor} data-alerta={alerta ? "true" : undefined}>{valor.toLocaleString("pt-BR")}</span>}
    </div>
  )
}

/** O lado de dentro do admin: menu lateral só do admin, topo com o título e o olho, e as páginas. Mesmo visual do app
 *  (as classes do V2Layout), mas nada daqui aparece no app: sem a ação principal, sem sino, sem o menu do app. */
function Casca({ meuId }: { meuId: string }) {
  const { pathname } = useLocation()
  const [oculto, alternarOculto] = useHideBalance()
  const [menuAberto, setMenuAberto] = useState(false)
  useEffect(() => { setMenuAberto(false) }, [pathname])
  const atual = PAGINAS.find((p) => pathname.startsWith(`/${p.secao}`))
  return (
    <div className={`v2 ${casca.raiz}`}>
      {menuAberto && <button type="button" className={casca.veu} aria-label="Fechar menu" onClick={() => setMenuAberto(false)} />}
      <aside className={casca.lateral} data-aberto={menuAberto ? "true" : undefined}>
        <div className={casca.marca}>
          <span className={casca.logo}><img src="/site/estaiada-laranja.svg" width={34} height={34} alt="" />Pontes</span>
          <button type="button" className={casca.fecharMenu} aria-label="Fechar menu" onClick={() => setMenuAberto(false)}><PanelLeftClose size={18} strokeWidth={2} /></button>
        </div>
        <nav className={casca.nav} aria-label="Administração">
          <span className={casca.grupo}><span className={casca.itemRotulo}>Administração</span></span>
          {PAGINAS.map(({ secao, rotulo, icone: Icone }) => (
            <NavLink key={secao} to={`/${secao}`} className={({ isActive }) => `${casca.item} ${isActive ? casca.itemAtivo : ""}`}>
              <Icone size={18} strokeWidth={2} aria-hidden="true" /><span className={casca.itemRotulo}>{rotulo}</span>
            </NavLink>
          ))}
        </nav>
        <div className={casca.rodape}>
          <ContaAdmin />
        </div>
      </aside>
      <div className={casca.corpo}>
        <header className={casca.topo}>
          <button type="button" className={casca.abrirMenu} aria-label="Abrir menu" onClick={() => setMenuAberto(true)}><PanelLeftOpen size={18} strokeWidth={2} /></button>
          <h1 className={casca.tituloPagina}>{atual?.rotulo ?? "Administração"}</h1>
          <div className={casca.topoAcoes}>
            <Botao soIcone aria-label={oculto ? "Mostrar e-mails" : "Esconder e-mails"} onClick={alternarOculto}
              icone={oculto ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />} />
          </div>
        </header>
        <main className={casca.conteudo} key={pathname}>
          <Routes>
            <Route path="usuarios" element={<PainelAdmin meuId={meuId} />} />
            <Route path="solicitacoes" element={<SolicitacoesAdmin />} />
            {/* /cadastros virou parte de Usuários; o endereço antigo e qualquer outro caem lá. */}
            <Route path="*" element={<Navigate to="/usuarios" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function PainelAdmin({ meuId }: { meuId: string }) {
  // Olho fechado (botão do topo): e-mail mascarado, como no v1. Dado pessoal de terceiro não fica à vista à toa.
  const [oculto] = useHideBalance()
  const email = (e: string) => (oculto ? mascararEmail(e) : e)
  const [metricas, setMetricas] = useState<MetricasAdmin | null>(null)

  const [busca, setBusca] = useState("")
  const [buscaFeita, setBuscaFeita] = useState("")
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(25)
  const [filtro, setFiltro] = useState<Filtro>("todos")
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[] | null>(null)
  const [total, setTotal] = useState(0)
  const [erroUsuarios, setErroUsuarios] = useState<string | null>(null)

  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null)
  const [versao, setVersao] = useState(0) // muda depois de cada ação: recarrega tudo

  // A busca vai pro servidor 300 ms depois da última tecla, sempre da página 1.
  useEffect(() => {
    const t = setTimeout(() => { setBuscaFeita(busca.trim()); setPagina(1) }, 300)
    return () => clearTimeout(t)
  }, [busca])

  useEffect(() => {
    let vivo = true
    adminService.metricas()
      .then((m) => { if (vivo) setMetricas(m) })
      .catch(() => { /* só os números; a lista mostra o erro dela */ })
    return () => { vivo = false }
  }, [versao])

  useEffect(() => {
    let vivo = true
    setErroUsuarios(null)
    adminService.usuarios(buscaFeita || undefined, pagina, porPagina, filtro === "todos" ? undefined : STATUS_DO_FILTRO[filtro])
      .then((r) => { if (vivo) { setUsuarios(r.items); setTotal(r.total) } })
      .catch((e) => { if (vivo) { setErroUsuarios(mensagemDeErro(e)); setUsuarios((u) => u ?? []) } })
    return () => { vivo = false }
  }, [buscaFeita, pagina, porPagina, filtro, versao])

  const rodar = useCallback(async (acao: () => Promise<unknown>, feito: string) => {
    setOcupado(true); setAviso(null)
    try { await acao(); setAviso({ texto: feito }); setPedido(null); setVersao((v) => v + 1) }
    catch (e) { setAviso({ texto: mensagemDeErro(e), erro: true }); setPedido(null) }
    setOcupado(false)
  }, [])

  const confirmar = () => {
    if (!pedido) return
    const { u } = pedido
    if (pedido.tipo === "recusar") void rodar(() => adminService.recusar(u.id), `Cadastro de ${u.nome} recusado.`)
    if (pedido.tipo === "bloquear") void rodar(() => adminService.bloquear(u.id), `${u.nome} foi bloqueado.`)
    if (pedido.tipo === "senha") void rodar(() => adminService.forcarReset(u.id), `Link de trocar senha enviado pra ${u.nome}.`)
  }

  const m = metricas ?? undefined
  return (
    <div className={styles.pagina}>
      {aviso && <p className={styles.aviso} data-erro={aviso.erro ? "true" : undefined} role={aviso.erro ? "alert" : "status"}>{aviso.texto}</p>}

      {/* Faixa de números numa caixa própria (mesma anatomia de Contas fixas, Transações e Cartões). */}
      <Bloco className={styles.resumo}>
        <div className={styles.numeros}>
          <Numero rotulo="Ativos" valor={m?.ativos} />
          <Numero rotulo="Esperando aprovação" valor={m?.pendentes} alerta={!!m && m.pendentes > 0} />
          <Numero rotulo="Bloqueados" valor={m?.bloqueados} />
        </div>
      </Bloco>

      {/* A tabela: busca e filtro de situação na barra (os dois no servidor); quem espera aprovação vem primeiro.
          No computador, colunas; no celular, a linha empilha (e-mail embaixo, etiqueta do lado do nome). */}
      <Bloco semRespiro>
        <div className={styles.toolbar}>
          <Busca valor={busca} onChange={setBusca} placeholder="Buscar por nome ou e-mail" className={styles.busca} />
          <Segmentos ariaLabel="Situação" valor={filtro} onChange={(v) => { setFiltro(v); setPagina(1) }} opcoes={FILTROS} />
        </div>
        {erroUsuarios && <p className={styles.aviso} data-erro="true" role="alert">{erroUsuarios}</p>}
        {usuarios === null ? (
          <div className={styles.respiro}><Esqueleto linhas={4} altura={18} /></div>
        ) : usuarios.length === 0 ? (
          <p className={styles.vazio}>{buscaFeita ? `Ninguém com "${buscaFeita}".` : filtro !== "todos" ? "Ninguém nesta situação." : "Nenhum usuário."}</p>
        ) : (
          <div className={styles.tabela}>
            <div className={styles.cabecalho} aria-hidden="true">
              <span>Pessoa</span><span>Situação</span><span>Cadastro</span><span>Último acesso</span><span className={styles.colAcoes}>Ações</span>
            </div>
            <ul className={styles.lista} aria-label="Usuários">
              {usuarios.map((u) => {
                const eu = u.id === meuId
                const esperando = u.status === StatusUsuario.AguardandoAprovacao
                const sit = esperando
                  ? { rotulo: u.emailConfirmado ? "Esperando aprovação" : "E-mail não confirmado", tom: "alerta" as const }
                  : { rotulo: STATUS_LABEL[u.status] ?? "Removido", tom: TOM[u.status] }
                const etiqueta = <Etiqueta tom={sit.tom}>{sit.rotulo}</Etiqueta>
                const itens: ItemMenu[] = eu ? [] : [
                  // Aprovar só com o e-mail confirmado (sem isso a etiqueta da linha já diz "E-mail não confirmado").
                  ...(esperando && u.emailConfirmado ? [{ rotulo: "Aprovar", icone: <Check size={15} aria-hidden="true" />, onClick: () => void rodar(() => adminService.aprovar(u.id), `${u.nome} pode entrar.`) }] : []),
                  ...(esperando ? [{ rotulo: "Recusar cadastro", icone: <X size={15} aria-hidden="true" />, perigo: true, onClick: () => setPedido({ tipo: "recusar", u }) }] : []),
                  ...(u.status === StatusUsuario.Ativo ? [
                    { rotulo: "Mandar link de trocar senha", icone: <KeyRound size={15} aria-hidden="true" />, onClick: () => setPedido({ tipo: "senha", u }) },
                    { rotulo: "Bloquear", icone: <Ban size={15} aria-hidden="true" />, perigo: true, onClick: () => setPedido({ tipo: "bloquear", u }) },
                  ] : []),
                  ...(u.status === StatusUsuario.Bloqueado ? [
                    { rotulo: "Reativar", icone: <RotateCcw size={15} aria-hidden="true" />, onClick: () => void rodar(() => adminService.reativar(u.id), `${u.nome} pode entrar de novo.`) },
                  ] : []),
                ]
                return (
                  <li key={u.id} className={styles.linha}>
                    <span className={styles.pessoa}>
                      <span className={styles.icone} aria-hidden="true">{u.nome.trim().charAt(0).toUpperCase() || "?"}</span>
                      <span className={styles.texto}>
                        <span className={styles.nomeLinha}>
                          <span className={styles.nome}>{u.nome}{eu ? " (você)" : ""}</span>
                          <span className={styles.soCelular}>{etiqueta}</span>
                        </span>
                        <span className={styles.sub}>{email(u.email)}</span>
                      </span>
                    </span>
                    <span className={styles.celula} data-rotulo="Situação">{etiqueta}</span>
                    <span className={styles.celula} data-rotulo="Cadastro">{diaDeInstante(u.criadoEm)}</span>
                    <span className={styles.celula} data-rotulo="Último acesso" data-mudo={u.ultimoAcessoEm ? undefined : "true"}>
                      {u.ultimoAcessoEm ? diaDeInstante(u.ultimoAcessoEm) : "Nunca"}
                    </span>
                    <span className={styles.acoes}>
                      {itens.length > 0 && <Menu itens={itens} ariaLabel={`Ações de ${u.nome}`} />}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        {total > 0 && (
          <Paginacao total={total} pagina={pagina} porPagina={porPagina} onPagina={setPagina}
            onPorPagina={(n) => { setPorPagina(n); setPagina(1) }} rotulo="usuários" rotuloSingular="usuário" />
        )}
      </Bloco>

      <Confirmar aberto={pedido?.tipo === "recusar"} perigo ocupado={ocupado} rotuloConfirmar="Recusar cadastro"
        titulo={`Recusar o cadastro de ${pedido?.u.nome ?? ""}?`}
        texto="A pessoa não consegue entrar com este e-mail, e a recusa não se desfaz pelo app."
        onConfirmar={confirmar} onCancelar={() => setPedido(null)} />
      <Confirmar aberto={pedido?.tipo === "bloquear"} perigo ocupado={ocupado} rotuloConfirmar="Bloquear"
        titulo={`Bloquear ${pedido?.u.nome ?? ""}?`}
        texto="A pessoa deixa de conseguir entrar. Os dados ficam guardados e dá pra reativar depois."
        onConfirmar={confirmar} onCancelar={() => setPedido(null)} />
      <Confirmar aberto={pedido?.tipo === "senha"} ocupado={ocupado} rotuloConfirmar="Enviar link"
        titulo={`Mandar o link de trocar senha pra ${pedido?.u.nome ?? ""}?`}
        texto="A pessoa recebe por e-mail o mesmo link do esqueci a senha, que vale por 1 hora."
        onConfirmar={confirmar} onCancelar={() => setPedido(null)} />
    </div>
  )
}
