// Front v2 — esqueleto: menu lateral plano (recolhe num trilho de ícones), topo com olho/tema/"Nova
// transação", conteúdo. Projeto SEPARADO do app atual: mesma API (proxy do Vite), mesmo login (cookie de
// localhost vale nos dois).
import { useCallback, useEffect, useState } from "react"
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  BarChart3, CreditCard, Gauge, Handshake, Landmark, LayoutDashboard, LogOut, Moon, PanelLeftClose, PanelLeftOpen,
  Plus, Receipt, Repeat, Scale, Settings, Sun, Tags, Target, Upload, Users, Eye, EyeOff,
} from "lucide-react"
import Botao from "../componentes/Botao"
import Logo from "../componentes/Logo"
import LogoMark from "../componentes/LogoMark"
import { useAuth } from "../auth/useAuth"
import { useHideBalance } from "../estado/ocultar"
import { useTema } from "./useTema"
import type { ContextoLayout } from "./caminho"
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

const INICIO = "/dashboard"

/** Seção da rota (prefixo mais longo): dá o título do topo e o nível do meio do caminho. */
function secaoDaRota(pathname: string): { para: string; rotulo: string } | undefined {
  const todos = [...PRINCIPAL, ...GERENCIAR, { para: "/configuracoes", rotulo: "Configurações" }]
  return todos.filter((i) => pathname === i.para || pathname.startsWith(i.para + "/")).sort((a, b) => b.para.length - a.para.length)[0]
}

type Nivel = { rotulo: string; para?: string }
/** Início / seção / detalhe — todo nível é link, menos o último (onde a pessoa está). */
function caminhoDaRota(pathname: string, detalhe: string | null): Nivel[] {
  const secao = secaoDaRota(pathname)
  const niveis: Nivel[] = [{ rotulo: "Início", para: INICIO }]
  if (secao) niveis.push(detalhe || pathname !== secao.para ? { rotulo: secao.rotulo, para: secao.para } : { rotulo: secao.rotulo })
  if (detalhe) niveis.push({ rotulo: detalhe })
  return niveis
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
  // Nome do item no fim do caminho (tela de detalhe), preso à rota em que foi definido.
  const [detalhe, setDetalhe] = useState<{ path: string; rotulo: string } | null>(null)
  const definirDetalheNoCaminho = useCallback((rotulo: string | null) => setDetalhe(rotulo ? { path: pathname, rotulo } : null), [pathname])
  const contexto: ContextoLayout = { definirDetalheNoCaminho }
  const caminho = caminhoDaRota(pathname, detalhe?.path === pathname ? detalhe.rotulo : null)
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
          {/* Mesmo ícone do recolher/expandir do computador — no celular abre/fecha a gaveta. */}
          <button type="button" className={styles.abrirMenu} aria-label="Abrir menu" onClick={() => setMenuAberto(true)}><PanelLeftOpen size={18} strokeWidth={2} /></button>
          <div className={styles.tituloBloco}>
            {pathname !== INICIO && (
              <nav className={styles.caminho} aria-label="Você está em">
                {caminho.map((n, i) => (
                  <span key={`${i}-${n.rotulo}`} className={styles.nivel}>
                    {i > 0 && <span className={styles.separador} aria-hidden="true">/</span>}
                    {n.para && i < caminho.length - 1
                      ? <Link to={n.para} className={styles.nivelLink}>{n.rotulo}</Link>
                      : <span className={styles.nivelAtual} aria-current="page">{n.rotulo}</span>}
                  </span>
                ))}
              </nav>
            )}
            <h1 className={styles.tituloPagina}>{secaoDaRota(pathname)?.rotulo ?? "Pontes"}</h1>
          </div>
          <div className={styles.topoAcoes}>
            <Botao soIcone aria-label={oculto ? "Mostrar valores" : "Esconder valores"} onClick={alternarOculto}
              icone={oculto ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />} />
            <Botao soIcone aria-label={tema === "claro" ? "Tema escuro" : "Tema claro"} onClick={alternarTema}
              icone={tema === "claro" ? <Moon size={18} strokeWidth={2} /> : <Sun size={18} strokeWidth={2} />} />
            <Botao variante="primario" compactoNoCelular onClick={() => navigate("/transacoes/nova", { state: { voltarPara: pathname === "/transacoes/nova" ? "/transacoes" : pathname } })}
              icone={<Plus size={16} strokeWidth={2.5} aria-hidden="true" />}>Nova transação</Botao>
          </div>
        </header>
        <main className={styles.conteudo} key={pathname}>
          <Outlet context={contexto} />
        </main>
      </div>
    </div>
  )
}
