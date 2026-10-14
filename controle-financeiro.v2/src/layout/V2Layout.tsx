// Front v2 (bancada) — esqueleto: menu lateral plano, topo com busca/olho/tema/"Nova transação", conteúdo.
// Projeto SEPARADO do app atual: mesma API (proxy do Vite), mesmo login (cookie de localhost vale nos dois).
import { useEffect, useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  BarChart3, CreditCard, Gauge, Handshake, Landmark, LayoutDashboard, LogOut, Menu, Moon, Plus, Receipt, Repeat,
  Scale, Search, Settings, Sun, Tags, Target, Upload, Users, X, Eye, EyeOff,
} from "lucide-react"
import Logo from "../componentes/Logo"
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
  useEffect(() => { setMenuAberto(false) }, [pathname])

  const iniciais = (usuario?.nome ?? "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()
  const Item = ({ para, rotulo, icone: Icone }: { para: string; rotulo: string; icone: typeof LayoutDashboard }) => (
    <NavLink to={para} className={({ isActive }) => `${styles.item} ${isActive ? styles.itemAtivo : ""}`}>
      <Icone size={18} strokeWidth={2} aria-hidden="true" />
      <span>{rotulo}</span>
    </NavLink>
  )

  return (
    <div className={`v2 ${styles.raiz}`} data-tema={tema}>
      {menuAberto && <button type="button" className={styles.veu} aria-label="Fechar menu" onClick={() => setMenuAberto(false)} />}
      <aside className={styles.lateral} data-aberto={menuAberto ? "true" : undefined}>
        <div className={styles.marca}>
          <Logo size={26} />
          <button type="button" className={styles.fecharMenu} aria-label="Fechar menu" onClick={() => setMenuAberto(false)}><X size={18} /></button>
        </div>
        <nav className={styles.nav} aria-label="Principal">
          {PRINCIPAL.map((i) => <Item key={i.para} {...i} />)}
          <span className={styles.grupo}>Gerenciar</span>
          {GERENCIAR.map((i) => <Item key={i.para} {...i} />)}
        </nav>
        <div className={styles.rodape}>
          <NavLink to="/configuracoes" className={({ isActive }) => `${styles.item} ${isActive ? styles.itemAtivo : ""}`}>
            <Settings size={18} strokeWidth={2} aria-hidden="true" /><span>Configurações</span>
          </NavLink>
          <div className={styles.usuario}>
            <span className={styles.avatar} aria-hidden="true">{iniciais}</span>
            <span className={styles.usuarioTexto}>
              <span className={styles.usuarioNome}>{usuario?.nome ?? "—"}</span>
              <span className={styles.usuarioPlano}>Plano gratuito</span>
            </span>
            <button type="button" className={styles.sair} aria-label="Sair" title="Sair" onClick={() => void sair().then(() => navigate("/entrar"))}>
              <LogOut size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </aside>

      <div className={styles.corpo}>
        <header className={styles.topo}>
          <button type="button" className={styles.abrirMenu} aria-label="Abrir menu" onClick={() => setMenuAberto(true)}><Menu size={20} /></button>
          <h1 className={styles.tituloPagina}>{tituloDaRota(pathname)}</h1>
          <div className={styles.topoAcoes}>
            <button type="button" className={styles.busca} onClick={() => navigate("/transacoes")}>
              <Search size={16} strokeWidth={2} aria-hidden="true" /><span>Buscar</span><kbd>⌘K</kbd>
            </button>
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
