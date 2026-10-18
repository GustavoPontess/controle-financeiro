// Front v2 — esqueleto: menu lateral plano (recolhe num trilho de ícones), topo com olho/sino/"Nova
// transação", conteúdo. Tema mora em Configurações. Projeto SEPARADO do app atual: mesma API (proxy do Vite), mesmo login (cookie de
// localhost vale nos dois).
import { useEffect, useRef, useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  ArrowLeft, BarChart3, Bell, ChevronsUpDown, CreditCard, Gauge, Handshake, Landmark, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen,
  Plus, Receipt, Repeat, Scale, Settings, Tags, Target, Upload, Users, Eye, EyeOff, Wallet,
} from "lucide-react"
import Botao from "../componentes/Botao"
import Logo from "../componentes/Logo"
import LogoMark from "../componentes/LogoMark"
import { useAuth } from "../auth/useAuth"
import { useHideBalance } from "../estado/ocultar"
import { useNaoLidas } from "../estado/notificacoes"
import PainelNotificacoes from "./PainelNotificacoes"
import styles from "./V2Layout.module.css"

const PRINCIPAL = [
  { para: "/dashboard", rotulo: "Visão geral", icone: LayoutDashboard },
  { para: "/transacoes", rotulo: "Transações", icone: Receipt },
  { para: "/cartoes", rotulo: "Cartões", icone: CreditCard },
  { para: "/contas-fixas", rotulo: "Contas fixas", icone: Repeat },
  { para: "/renda", rotulo: "Renda", icone: Wallet },
  { para: "/relatorios", rotulo: "Relatórios", icone: BarChart3 },
  { para: "/reconciliacao", rotulo: "Reconciliação", icone: Scale },
  { para: "/emprestimos", rotulo: "Empréstimos", icone: Handshake },
  { para: "/importar", rotulo: "Importar extrato", icone: Upload },
]
const GERENCIAR = [
  { para: "/bancos", rotulo: "Bancos", icone: Landmark },
  { para: "/categorias", rotulo: "Categorias", icone: Tags },
  { para: "/familias", rotulo: "Famílias", icone: Users },
  { para: "/metas", rotulo: "Metas", icone: Target },
  { para: "/limites", rotulo: "Limites", icone: Gauge },
]
const CHAVE_MENU = "v2:menu"

/** Seção da rota (prefixo mais longo): dá o título do topo e a raiz pra "voltar". `semMenu` = tela que não
 *  tem item no menu (Notificações, pelo sino): o topo mostra a seta de voltar pra onde a pessoa estava. */
function secaoDaRota(pathname: string): { para: string; rotulo: string; semMenu?: boolean } | undefined {
  const todos = [...PRINCIPAL, ...GERENCIAR, { para: "/configuracoes", rotulo: "Configurações" }, { para: "/notificacoes", rotulo: "Notificações", semMenu: true }]
  return todos.filter((i) => pathname === i.para || pathname.startsWith(i.para + "/")).sort((a, b) => b.para.length - a.para.length)[0]
}

export default function V2Layout() {
  const { usuario, sair } = useAuth()
  const navigate = useNavigate()
  const { pathname, state } = useLocation()
  // Tela interna da seção (/transacoes/nova, /transacoes/:id…): o topo ganha a seta de voltar antes do título
  // — sem repetir o nome da seção numa linha a mais dentro da página. Volta pra onde a pessoa veio, senão pra raiz.
  const secao = secaoDaRota(pathname)
  const emTelaInterna = !!secao && (pathname !== secao.para || !!secao.semMenu)
  const voltarPara = (state as { voltarPara?: string } | null)?.voltarPara ?? (secao && !secao.semMenu ? secao.para : "/dashboard")
  const naoLidas = useNaoLidas(pathname)
  const [oculto, alternarOculto] = useHideBalance()
  const [menuAberto, setMenuAberto] = useState(false)
  // Trilho: só ícones (o nome aparece ao passar o mouse). Lembrado por dispositivo.
  const [recolhido, setRecolhido] = useState(() => { try { return localStorage.getItem(CHAVE_MENU) === "trilho" } catch { return false } })
  // O bloco da pessoa (avatar + nome) abre o menu da conta: e-mail, Configurações, Sair. Vale com o menu
  // aberto, no trilho e na gaveta do celular. Fecha ao clicar fora, no Esc e ao trocar de tela.
  const [menuUsuario, setMenuUsuario] = useState(false)
  const usuarioRef = useRef<HTMLDivElement>(null)
  // Sino: painel com as últimas notificações embaixo do botão; fecha ao clicar fora, no Esc e ao trocar de tela.
  const [painelNotif, setPainelNotif] = useState(false)
  const sinoRef = useRef<HTMLSpanElement>(null)
  useEffect(() => { setMenuAberto(false); setMenuUsuario(false); setPainelNotif(false) }, [pathname])
  useEffect(() => {
    if (!painelNotif) return
    const fora = (e: MouseEvent) => { if (!sinoRef.current?.contains(e.target as Node)) setPainelNotif(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPainelNotif(false) }
    document.addEventListener("mousedown", fora); document.addEventListener("keydown", esc)
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc) }
  }, [painelNotif])
  useEffect(() => {
    if (!menuUsuario) return
    const fora = (e: MouseEvent) => { if (!usuarioRef.current?.contains(e.target as Node)) setMenuUsuario(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuUsuario(false) }
    document.addEventListener("mousedown", fora); document.addEventListener("keydown", esc)
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc) }
  }, [menuUsuario])
  useEffect(() => { try { localStorage.setItem(CHAVE_MENU, recolhido ? "trilho" : "aberto") } catch { /* ignore */ } }, [recolhido])

  const iniciais = (usuario?.nome ?? "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()
  const sairAgora = () => void sair().then(() => navigate("/entrar"))
  const Item = ({ para, rotulo, icone: Icone }: { para: string; rotulo: string; icone: typeof LayoutDashboard }) => (
    <NavLink to={para} title={recolhido ? rotulo : undefined} className={({ isActive }) => `${styles.item} ${isActive ? styles.itemAtivo : ""}`}>
      <Icone size={18} strokeWidth={2} aria-hidden="true" />
      <span className={styles.itemRotulo}>{rotulo}</span>
    </NavLink>
  )

  return (
    <div className={`v2 ${styles.raiz}`} data-menu={recolhido ? "trilho" : undefined}>
      {menuAberto && <button type="button" className={styles.veu} aria-label="Fechar menu" onClick={() => setMenuAberto(false)} />}
      <aside className={styles.lateral} data-aberto={menuAberto ? "true" : undefined}>
        <div className={styles.marca}>
          <span className={styles.logo}><Logo size={26} /></span>
          {/* No trilho a marca compacta É o botão: mostra o "P" e, ao passar o mouse, vira a seta de expandir.
              Mesma linha de 40px nos dois estados — nada embaixo da marca, o menu não desce. */}
          <button type="button" className={styles.recolher} aria-label={recolhido ? "Expandir menu" : "Recolher menu"} title={recolhido ? "Expandir menu" : "Recolher menu"}
            onClick={() => { setRecolhido((r) => !r); setMenuUsuario(false) }}>
            <span className={styles.logoMini}><LogoMark size={26} /></span>
            <span className={styles.recolherIcone}>{recolhido ? <PanelLeftOpen size={18} strokeWidth={2} /> : <PanelLeftClose size={18} strokeWidth={2} />}</span>
          </button>
          <button type="button" className={styles.fecharMenu} aria-label="Fechar menu" onClick={() => setMenuAberto(false)}><PanelLeftClose size={18} strokeWidth={2} /></button>
        </div>
        <nav className={styles.nav} aria-label="Principal">
          {PRINCIPAL.map((i) => <Item key={i.para} {...i} />)}
          <span className={styles.grupo}><span className={styles.itemRotulo}>Gerenciar</span></span>
          {GERENCIAR.map((i) => <Item key={i.para} {...i} />)}
        </nav>
        <div className={styles.rodape}>
          <div className={styles.usuario} ref={usuarioRef}>
            <button type="button" className={styles.usuarioBotao} aria-label={usuario?.nome ?? "Conta"} title={recolhido ? usuario?.nome : undefined}
              aria-haspopup="menu" aria-expanded={menuUsuario} onClick={() => setMenuUsuario((v) => !v)}>
              <span className={styles.avatar} aria-hidden="true">{iniciais}</span>
              <span className={`${styles.usuarioTexto} ${styles.itemRotulo}`}>
                <span className={styles.usuarioNome}>{usuario?.nome ?? "—"}</span>
                <span className={styles.usuarioPlano}>Plano gratuito</span>
              </span>
              <ChevronsUpDown size={15} strokeWidth={2} className={`${styles.usuarioSeta} ${styles.itemRotulo}`} aria-hidden="true" />
            </button>
            {menuUsuario && (
              <div className={styles.menuUsuario} role="menu">
                <span className={styles.usuarioNome}>{usuario?.nome}</span>
                <span className={styles.usuarioPlano}>{usuario?.email}</span>
                <NavLink to="/configuracoes" role="menuitem" className={styles.menuItem}>
                  <Settings size={16} strokeWidth={2} aria-hidden="true" /> Configurações
                </NavLink>
                <button type="button" role="menuitem" className={styles.menuItem} onClick={sairAgora}>
                  <LogOut size={16} strokeWidth={2} aria-hidden="true" /> Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className={styles.corpo}>
        <header className={styles.topo}>
          {/* Mesmo ícone do recolher/expandir do computador — no celular abre/fecha a gaveta. */}
          <button type="button" className={styles.abrirMenu} aria-label="Abrir menu" onClick={() => setMenuAberto(true)}><PanelLeftOpen size={18} strokeWidth={2} /></button>
          {emTelaInterna && (
            <Botao variante="texto" soIcone aria-label="Voltar" className={styles.voltar} onClick={() => navigate(voltarPara)}
              icone={<ArrowLeft size={18} strokeWidth={2.25} />} />
          )}
          <h1 className={styles.tituloPagina}>{secao?.rotulo ?? "Pontes"}</h1>
          <div className={styles.topoAcoes}>
            <Botao soIcone aria-label={oculto ? "Mostrar valores" : "Esconder valores"} onClick={alternarOculto}
              icone={oculto ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />} />
            <span className={styles.sino} ref={sinoRef}>
              <Botao soIcone ativo={painelNotif || pathname === "/notificacoes"} aria-label={naoLidas > 0 ? `Notificações, ${naoLidas} não lidas` : "Notificações"}
                aria-haspopup="dialog" aria-expanded={painelNotif} onClick={() => setPainelNotif((v) => !v)}
                icone={<Bell size={18} strokeWidth={2} />} />
              {naoLidas > 0 && <span className={styles.sinoContador} aria-hidden="true">{naoLidas > 99 ? "99+" : naoLidas}</span>}
              {painelNotif && <PainelNotificacoes voltarPara={pathname} aoFechar={() => setPainelNotif(false)} />}
            </span>
            <Botao variante="primario" compactoNoCelular onClick={() => navigate("/transacoes/nova", { state: { voltarPara: pathname === "/transacoes/nova" ? "/transacoes" : pathname } })}
              icone={<Plus size={16} strokeWidth={2.5} aria-hidden="true" />}>Nova transação</Botao>
          </div>
        </header>
        <main className={styles.conteudo} key={pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
