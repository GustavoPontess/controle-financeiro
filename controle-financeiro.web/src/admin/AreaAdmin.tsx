// Admin do v2: o gate do beta, num MINI-APP À PARTE (admin.html + src/admin/main.tsx, entrada própria no build).
// Pedido do Gustavo 2026-10-25: "ninguém que usa o app normalmente pode ter ideia de onde fica o admin". O app comum
// não tem nenhuma linha que leve pra cá, nem a rota: em produção o Caddy só serve esta página no endereço secreto
// ADMIN_PATH, que vem do deploy (Caddyfile). Aqui dentro as rotas são relativas a esse endereço (basename).
// O servidor confere de novo em cada chamada (IsAdmin + duas etapas ligadas + conta Ativa). Duas páginas, planilha:
//  - Cadastros: a fila de quem pediu pra entrar, com Aprovar e Recusar na própria linha.
//  - Usuários: todo mundo, com busca e página NO SERVIDOR; Trocar senha e Bloquear (ativos), Reativar (bloqueados).
// A própria conta não tem ação (o servidor também recusa bloquear a si mesmo). Exclusão LGPD e auditoria: depois.
import { useCallback, useEffect, useState } from "react"
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom"
import { ArrowLeft, Check, ClipboardCheck, Eye, EyeOff, PanelLeftClose, PanelLeftOpen, ShieldCheck, Users, X } from "lucide-react"
import adminService from "../services/adminService"
import mfaService from "../services/mfaService"
import { mensagemDeErro } from "../api/cliente"
import { useAuth } from "../auth/useAuth"
import { STATUS_LABEL, StatusUsuario, type MetricasAdmin, type UsuarioAdmin } from "../types/Admin"
import Bloco from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Busca from "../componentes/Busca"
import Confirmar from "../componentes/Confirmar"
import Etiqueta from "../componentes/Etiqueta"
import { InicialFicha } from "../componentes/ListaFicha"
import Paginacao from "../componentes/Paginacao"
import { CelulaPlanilha, LinhaBotaoPlanilha, LinhaPlanilha } from "../componentes/Planilha"
import SecaoPlanilha from "../componentes/SecaoPlanilha"
import { dataBR } from "../utils/dateTime"
import { mascararEmail } from "../utils/mascararEmail"
import { useHideBalance } from "../estado/ocultar"
import Logo from "../componentes/Logo"
import casca from "../layout/V2Layout.module.css"
import { irPara } from "./irPara"
import styles from "./AreaAdmin.module.css"

const TOM: Partial<Record<StatusUsuario, "positivo" | "negativo" | "alerta">> = {
  [StatusUsuario.Ativo]: "positivo",
  [StatusUsuario.AguardandoAprovacao]: "alerta",
  [StatusUsuario.Bloqueado]: "negativo",
  [StatusUsuario.MarcadoParaExclusao]: "negativo",
}

type Pedido =
  | { tipo: "recusar"; u: UsuarioAdmin }
  | { tipo: "bloquear"; u: UsuarioAdmin }
  | { tipo: "senha"; u: UsuarioAdmin }

type Secao = "cadastros" | "usuarios"
const PAGINAS: { secao: Secao; rotulo: string; icone: typeof Users }[] = [
  { secao: "cadastros", rotulo: "Cadastros", icone: ClipboardCheck },
  { secao: "usuarios", rotulo: "Usuários", icone: Users },
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

/** O lado de dentro do admin: menu lateral só do admin, topo com o título e o olho, e as páginas. Mesmo visual do app
 *  (as classes do V2Layout), mas nada daqui aparece no app: sem "Nova transação", sem sino, sem o menu financeiro. */
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
          <span className={casca.logo}><Logo size={26} /></span>
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
          {/* O app mora fora deste mini-app: link comum, não do roteador. */}
          <a href="/dashboard" className={casca.item}>
            <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" /><span className={casca.itemRotulo}>Voltar ao app</span>
          </a>
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
            <Route index element={<Navigate to="cadastros" replace />} />
            <Route path="cadastros" element={<PainelAdmin meuId={meuId} secao="cadastros" />} />
            <Route path="usuarios" element={<PainelAdmin meuId={meuId} secao="usuarios" />} />
            <Route path="*" element={<Navigate to="cadastros" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function PainelAdmin({ meuId, secao }: { meuId: string; secao: Secao }) {
  // Olho fechado (botão do topo): e-mail mascarado, como no v1. Dado pessoal de terceiro não fica à vista à toa.
  const [oculto] = useHideBalance()
  const email = (e: string) => (oculto ? mascararEmail(e) : e)
  const [metricas, setMetricas] = useState<MetricasAdmin | null>(null)
  const [pendentes, setPendentes] = useState<UsuarioAdmin[] | null>(null)
  const [erroCadastros, setErroCadastros] = useState<string | null>(null)

  const [busca, setBusca] = useState("")
  const [buscaFeita, setBuscaFeita] = useState("")
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(25)
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
    setErroCadastros(null)
    Promise.all([adminService.metricas(), adminService.pendentes()])
      .then(([m, p]) => { if (vivo) { setMetricas(m); setPendentes(p) } })
      .catch((e) => { if (vivo) { setErroCadastros(mensagemDeErro(e)); setPendentes((p) => p ?? []) } })
    return () => { vivo = false }
  }, [versao])

  useEffect(() => {
    let vivo = true
    setErroUsuarios(null)
    adminService.usuarios(buscaFeita || undefined, pagina, porPagina)
      .then((r) => { if (vivo) { setUsuarios(r.items); setTotal(r.total) } })
      .catch((e) => { if (vivo) { setErroUsuarios(mensagemDeErro(e)); setUsuarios((u) => u ?? []) } })
    return () => { vivo = false }
  }, [buscaFeita, pagina, porPagina, versao])

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

      {secao === "cadastros" && <SecaoPlanilha titulo="Cadastros" rotuloNome="Pessoa" colunas={["Cadastro em", "E-mail"]} semBarra larguraAcao="200px"
        carregando={!pendentes} erro={erroCadastros}
        vazio={pendentes?.length === 0 ? "Nenhum cadastro esperando aprovação." : undefined}
        numeros={[
          { rotulo: "Esperando", valor: m?.pendentes, contagem: true, tom: m && m.pendentes > 0 ? "negativo" : undefined },
          { rotulo: "Nos últimos 7 dias", valor: m?.cadastrosUltimos7Dias, contagem: true },
          { rotulo: "Recusados", valor: m?.recusados, contagem: true },
        ]}>
        {pendentes?.map((u) => (
          <LinhaPlanilha key={u.id} marca={<InicialFicha texto={u.nome} />} nome={<span>{u.nome}</span>} detalhe={email(u.email)}
            acao={<>
              <Botao variante="primario" disabled={ocupado || !u.emailConfirmado} icone={<Check size={15} strokeWidth={2.5} aria-hidden="true" />}
                aria-label={`Aprovar ${u.nome}`}
                onClick={() => void rodar(() => adminService.aprovar(u.id), `${u.nome} pode entrar.`)}>Aprovar</Botao>
              <Botao disabled={ocupado} icone={<X size={15} strokeWidth={2.5} aria-hidden="true" />}
                aria-label={`Recusar ${u.nome}`} onClick={() => setPedido({ tipo: "recusar", u })}>Recusar</Botao>
            </>}>
            <CelulaPlanilha rotulo="Cadastro em">{dataBR(u.criadoEm)}</CelulaPlanilha>
            <CelulaPlanilha rotulo="E-mail">
              {u.emailConfirmado ? <Etiqueta tom="positivo">Confirmado</Etiqueta> : <Etiqueta tom="alerta">Não confirmado</Etiqueta>}
            </CelulaPlanilha>
          </LinhaPlanilha>
        ))}
      </SecaoPlanilha>}

      {secao === "usuarios" && <SecaoPlanilha titulo="Usuários" rotuloNome="Pessoa" colunas={["Situação", "Último acesso"]} semBarra larguraAcao="220px"
        carregando={!usuarios} erro={erroUsuarios}
        acao={<Busca valor={busca} onChange={setBusca} placeholder="Buscar por nome ou e-mail" className={styles.busca} />}
        vazio={usuarios?.length === 0 ? (buscaFeita ? `Ninguém com "${buscaFeita}".` : "Nenhum usuário.") : undefined}
        numeros={[
          { rotulo: "Ativos", valor: m?.ativos, contagem: true },
          { rotulo: "Ativos nos últimos 7 dias", valor: m?.ativosUltimos7Dias, contagem: true },
          { rotulo: "Bloqueados", valor: m?.bloqueados, contagem: true },
        ]}
        rodape={total > 0 ? (
          <LinhaBotaoPlanilha>
            <Paginacao total={total} pagina={pagina} porPagina={porPagina} onPagina={setPagina}
              onPorPagina={(n) => { setPorPagina(n); setPagina(1) }} rotulo="usuários" rotuloSingular="usuário" />
          </LinhaBotaoPlanilha>
        ) : undefined}>
        {usuarios?.map((u) => {
          const eu = u.id === meuId
          return (
            <LinhaPlanilha key={u.id} marca={<InicialFicha texto={u.nome} />} nome={<span>{u.nome}{eu ? " (você)" : ""}</span>} detalhe={email(u.email)}
              acao={eu ? undefined : <>
                {u.status === StatusUsuario.Ativo && <>
                  <Botao variante="texto" disabled={ocupado} aria-label={`Trocar a senha de ${u.nome}`}
                    onClick={() => setPedido({ tipo: "senha", u })}>Trocar senha</Botao>
                  <Botao variante="texto" perigo disabled={ocupado} aria-label={`Bloquear ${u.nome}`}
                    onClick={() => setPedido({ tipo: "bloquear", u })}>Bloquear</Botao>
                </>}
                {u.status === StatusUsuario.Bloqueado && (
                  <Botao disabled={ocupado} aria-label={`Reativar ${u.nome}`}
                    onClick={() => void rodar(() => adminService.reativar(u.id), `${u.nome} pode entrar de novo.`)}>Reativar</Botao>
                )}
              </>}>
              <CelulaPlanilha rotulo="Situação"><Etiqueta tom={TOM[u.status]}>{STATUS_LABEL[u.status] ?? "Removido"}</Etiqueta></CelulaPlanilha>
              <CelulaPlanilha rotulo="Último acesso" tom={u.ultimoAcessoEm ? undefined : "mudo"}>
                {u.ultimoAcessoEm ? dataBR(u.ultimoAcessoEm) : "Nunca"}
              </CelulaPlanilha>
            </LinhaPlanilha>
          )
        })}
      </SecaoPlanilha>}

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
