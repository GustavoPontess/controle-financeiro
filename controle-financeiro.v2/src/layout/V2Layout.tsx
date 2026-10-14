// Front v2 — esqueleto: menu lateral plano (recolhe num trilho de ícones), topo com olho/tema/"Nova
// transação", conteúdo. Projeto SEPARADO do app atual: mesma API (proxy do Vite), mesmo login (cookie de
// localhost vale nos dois).
import { useEffect, useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  BarChart3, CreditCard, Gauge, Handshake, Landmark, LayoutDashboard, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen,
  Plus, Receipt, Repeat, Scale, Settings, Sun, Tags, Target, Upload, Users, X, Eye, EyeOff,
} from "lucide-react"
import Logo from "../componentes/Logo"
import LogoMark from "../componentes/LogoMark"
import { useAuth } from "../auth/useAuth"
import { useHideBalance } from "../estado/ocultar"
import { useTema } from "./useTema"
import styles from "./V2Layout.module.css"

const PRINCIPAL = [
  { para: "/dashboard", rotulo: "Visão geral", icone: LayoutDashboard },
  { para: "/transacoes", rotulo: "Transações", icone: Receipt },
  { para: "/cartoes", rotulo: "Cartões", icone: CreditCard },
  { para: "/contas-fixas", rotulo: "Contas fixas", icone: Repeat },
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

/** Título do topo pela rota (prefixo mais longo). */
export function tituloDaRota(pathname: string): string {
  const todos = [...PRINCIPAL, ...GERENCIAR, { para: "/configuracoes", rotulo: "Configurações" }]
  const hit = todos.filter((i) => pathname === i.para || pathname.startsWith(i.para + "/")).sort((a, b) => b.para.length - a.para.length)[0]
  return hit?.rotulo ?? "Pontes"
}

export default function V2Layout() {
  const { usuario, sair } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [tema, alternarTema] = useTema()
  const [oculto, alternarOculto] = useHideBalance()
  const [menuAberto, setMenuAberto] = useState(false)
  // Trilho: só ícones (o nome aparece ao passar o mouse). Lembrado por dispositivo.
  const [recolhido, setRecolhido] = useState(() => { try { return localStorage.getItem(CHAVE_MENU) === "trilho" } catch { return false } })
  // No trilho, o avatar abre um menu pequeno (nome, e-mail, sair) — assim o rodapé não muda de altura.
  const [menuUsuario, setMenuUsuario] = useState(false)
  useEffect(() => { setMenuAberto(false); setMenuUsuario(false) }, [pathname])
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
    <div className={`v2 ${styles.raiz}`} data-tema={tema} data-menu={recolhido ? "trilho" : undefined}>
      {menuAberto && <button type="button" className={styles.veu} aria-label="Fechar menu" onClick={() => setMenuAberto(false)} />}
      <aside className={styles.lateral} data-aberto={menuAberto ? "true" : undefined}>
        <div className={styles.marca}>
          <span className={styles.logo}><Logo size={26} /></span>
          <span className={styles.logoMini}><LogoMark size={24} /></span>
          <button type="button" className={styles.recolher} aria-label={recolhido ? "Expandir menu" : "Recolher menu"} title={recolhido ? "Expandir menu" : "Recolher menu"}
            onClick={() => { setRecolhido((r) => !r); setMenuUsuario(false) }}>
            {recolhido ? <PanelLeftOpen size={18} strokeWidth={2} /> : <PanelLeftClose size={18} strokeWidth={2} />}
          </button>
          <button type="button" className={styles.fecharMenu} aria-label="Fechar menu" onClick={() => setMenuAberto(false)}><X size={18} /></button>
        </div>
        <nav className={styles.nav} aria-label="Principal">
          {PRINCIPAL.map((i) => <Item key={i.para} {...i} />)}
          <span className={styles.grupo}><span className={styles.itemRotulo}>Gerenciar</span></span>
          {GERENCIAR.map((i) => <Item key={i.para} {...i} />)}
        </nav>
        <div className={styles.rodape}>
          <Item para="/configuracoes" rotulo="Configurações" icone={Settings} />
          <div className={styles.usuario}>
            <button type="button" className={styles.avatar} aria-label={usuario?.nome ?? "Conta"} title={recolhido ? usuario?.nome : undefined}
              aria-haspopup={recolhido ? "menu" : undefined} aria-expanded={recolhido ? menuUsuario : undefined}
              onClick={() => { if (recolhido) setMenuUsuario((v) => !v) }}>{iniciais}</button>
            <span className={`${styles.usuarioTexto} ${styles.itemRotulo}`}>
              <span className={styles.usuarioNome}>{usuario?.nome ?? "—"}</span>
              <span className={styles.usuarioPlano}>Plano gratuito</span>
            </span>
            <button type="button" className={styles.sair} aria-label="Sair" title="Sair" onClick={sairAgora}>
              <LogOut size={16} strokeWidth={2} />
            </button>
            {recolhido && menuUsuario && (
              <div className={styles.menuUsuario} role="menu">
                <span className={styles.usuarioNome}>{usuario?.nome}</span>
                <span className={styles.usuarioPlano}>{usuario?.email}</span>
                <button type="button" role="menuitem" className={styles.menuSair} onClick={sairAgora}>
                  <LogOut size={16} strokeWidth={2} aria-hidden="true" /> Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className={styles.corpo}>
        <header className={styles.topo}>
          <button type="button" className={styles.abrirMenu} aria-label="Abrir menu" onClick={() => setMenuAberto(true)}><Menu size={20} /></button>
          <h1 className={styles.tituloPagina}>{tituloDaRota(pathname)}</h1>
          <div className={styles.topoAcoes}>
            <button type="button" className={styles.icone} aria-label={oculto ? "Mostrar valores" : "Esconder valores"} onClick={alternarOculto}>
              {oculto ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
            </button>
            <button type="button" className={styles.icone} aria-label={tema === "claro" ? "Tema escuro" : "Tema claro"} onClick={alternarTema}>
              {tema === "claro" ? <Moon size={18} strokeWidth={2} /> : <Sun size={18} strokeWidth={2} />}
            </button>
            <button type="button" className={styles.primario} onClick={() => navigate("/transacoes/nova")}>
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" /><span>Nova transação</span>
            </button>
          </div>
        </header>
        <main className={styles.conteudo} key={pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
