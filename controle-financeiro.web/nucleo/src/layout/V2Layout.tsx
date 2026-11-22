// Núcleo: o layout do app logado, o MESMO do app Pontes (V2Layout), sem o que é de um produto só. O que muda por
// projeto mora em ./menu.ts (itens, ação principal, atalhos do celular); este arquivo e o CSS não se editam.
// Menu lateral plano (recolhe num trilho de ícones, lembrado no aparelho), topo com título da seção, seta de voltar
// nas telas internas, olho (esconder valores), sino e a ação principal; menu da conta no pé (outras contas
// conectadas neste navegador, Configurações, Sair). Celular: gaveta + barra de atalhos embaixo (2 itens, a ação
// principal no meio, 1 item e o Menu), igual no navegador e no app instalado; o topo perde o "abrir menu" e a ação.
import { useEffect, useRef, useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, Bell, ChevronsUpDown, Eye, EyeOff, LogOut, Menu as IconeMenu, PanelLeftClose, PanelLeftOpen, Plus, Settings } from "lucide-react"
import Avatar, { urlFoto } from "../componentes/Avatar"
import Botao from "../componentes/Botao"
import AvisoDeFuso from "../componentes/AvisoDeFuso"
import { useAuth } from "../auth/useAuth"
import { useHideBalance } from "../estado/ocultar"
import { useNaoLidas } from "../estado/notificacoes"
import PainelNotificacoes from "./PainelNotificacoes"
import { ACAO_PRINCIPAL, ATALHOS, GRUPO, INICIO, LOGO, NOME_DO_APP, OUTRAS, PRINCIPAL, type ItemMenu, type Secao } from "./menu"
import styles from "./V2Layout.module.css"

const CHAVE_MENU = "v2:menu"

/** Seção da rota (prefixo mais longo): dá o título do topo e a raiz pra "voltar". */
function secaoDaRota(pathname: string): Secao | undefined {
  const todos: Secao[] = [...PRINCIPAL, ...GRUPO.itens, ...OUTRAS]
  return todos.filter((i) => pathname === i.para || pathname.startsWith(i.para + "/")).sort((a, b) => b.para.length - a.para.length)[0]
}

/** No pé do menu cabe pouco: "Ana Maria Souza" vira "Ana Souza" (o completo fica no menu da conta). */
const primeiroEUltimo = (nome?: string) => {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean)
  return partes.length > 2 ? `${partes[0]} ${partes[partes.length - 1]}` : partes.join(" ")
}
const iniciaisDe = (nome: string) => nome.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?"

export default function V2Layout() {
  const { usuario, sair, contas, trocarConta, recarregar } = useAuth()
  const navigate = useNavigate()
  const { pathname, search, state } = useLocation()
  // Tela interna da seção: o topo ganha a seta de voltar. Volta pra onde a pessoa veio, senão pra raiz.
  const secao = secaoDaRota(pathname)
  const raiz = secao?.raiz ?? secao?.para
  const emTelaInterna = !!secao && (pathname !== raiz || !!secao.semMenu)
  const voltarPara = (state as { voltarPara?: string } | null)?.voltarPara ?? (secao && !secao.semMenu && raiz ? raiz : INICIO)
  // Página com menu de seções (NavSecoes, `?s=`): no celular a seção escolhida abre sozinha, e a seta volta pra lista.
  const naSecaoDaPagina = new URLSearchParams(search).has("s")
  const voltar = () => navigate(naSecaoDaPagina && window.matchMedia("(max-width: 900px)").matches ? pathname : voltarPara)
  const naoLidas = useNaoLidas(`${usuario?.id ?? ""}:${pathname}`)
  const [oculto, alternarOculto] = useHideBalance()
  const [menuAberto, setMenuAberto] = useState(false)
  const [recolhido, setRecolhido] = useState(() => { try { return localStorage.getItem(CHAVE_MENU) === "trilho" } catch { return false } })
  const [menuUsuario, setMenuUsuario] = useState(false)
  const [erroConta, setErroConta] = useState<string | null>(null)
  const [trocando, setTrocando] = useState(false)
  const usuarioRef = useRef<HTMLDivElement>(null)
  const [painelNotif, setPainelNotif] = useState(false)
  const sinoRef = useRef<HTMLSpanElement>(null)
  // Fecha menus ao mudar de página ou de seção da página.
  useEffect(() => { setMenuAberto(false); setMenuUsuario(false); setPainelNotif(false); setErroConta(null) }, [pathname, search])
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

  const iniciais = iniciaisDe(usuario?.nome ?? "?")
  const minhaFoto = urlFoto(usuario?.id, usuario?.fotoEm)
  const outrasContas = contas.filter((c) => c.id !== usuario?.id)
  // Trocar de conta: o servidor reaponta a sessão; a chave do conteúdo leva o id, nada fica da conta anterior.
  const trocarPara = async (id: string) => {
    setTrocando(true); setErroConta(null)
    try { await trocarConta(id); setMenuUsuario(false); navigate(INICIO) }
    catch (e) { setErroConta(e instanceof Error ? e.message : "Não deu pra trocar de conta.") }
    setTrocando(false)
  }
  const sairAgora = () => void sair().then(() => navigate("/entrar"))
  const irPara = (para: string) => { setMenuUsuario(false); navigate(para, { state: { voltarPara: pathname } }) }
  const acaoPrincipal = () => navigate(ACAO_PRINCIPAL.para, { state: { voltarPara: pathname === ACAO_PRINCIPAL.para ? raiz ?? INICIO : pathname } })
  const Item = ({ para, rotulo, icone: Icone, exato }: ItemMenu) => (
    <NavLink to={para} end={exato} title={recolhido ? rotulo : undefined} className={({ isActive }) => `${styles.item} ${isActive ? styles.itemAtivo : ""}`}>
      <Icone size={18} strokeWidth={2} aria-hidden="true" />
      <span className={styles.itemRotulo}>{rotulo}</span>
    </NavLink>
  )
  const Atalho = ({ para, rotulo, icone: Icone, exato }: ItemMenu) => (
    <NavLink to={para} end={exato} className={({ isActive }) => `${styles.atalho} ${isActive ? styles.atalhoAtivo : ""}`}>
      <Icone size={22} strokeWidth={2} aria-hidden="true" />
      <span>{rotulo}</span>
    </NavLink>
  )

  return (
    <div className={`v2 ${styles.raiz}`} data-menu={recolhido ? "trilho" : undefined}>
      {menuAberto && <button type="button" className={styles.veu} aria-label="Fechar menu" onClick={() => setMenuAberto(false)} />}
      <aside className={styles.lateral} data-aberto={menuAberto ? "true" : undefined} data-nao-imprime>
        <div className={styles.marca}>
          <span className={styles.logo}><img src={LOGO} width={34} height={34} alt="" />{NOME_DO_APP}</span>
          <button type="button" className={styles.recolher} aria-label={recolhido ? "Expandir menu" : "Recolher menu"} title={recolhido ? "Expandir menu" : "Recolher menu"}
            onClick={() => { setRecolhido((r) => !r); setMenuUsuario(false) }}>
            <span className={styles.logoMini}><img src={LOGO} width={34} height={34} alt={NOME_DO_APP} /></span>
            <span className={styles.recolherIcone}>{recolhido ? <PanelLeftOpen size={18} strokeWidth={2} /> : <PanelLeftClose size={18} strokeWidth={2} />}</span>
          </button>
          <button type="button" className={styles.fecharMenu} aria-label="Fechar menu" onClick={() => setMenuAberto(false)}><PanelLeftClose size={18} strokeWidth={2} /></button>
        </div>
        <nav className={styles.nav} aria-label="Principal">
          {PRINCIPAL.map((i) => <Item key={i.para} {...i} />)}
          {GRUPO.itens.length > 0 && <span className={styles.grupo}><span className={styles.itemRotulo}>{GRUPO.rotulo}</span></span>}
          {GRUPO.itens.map((i) => <Item key={i.para} {...i} />)}
        </nav>
        <div className={styles.rodape}>
          <div className={styles.usuario} ref={usuarioRef}>
            <div className={styles.usuarioLinha}>
              <button type="button" className={styles.usuarioBotao} aria-label={usuario?.nome ?? "Conta"} title={recolhido ? usuario?.nome : undefined}
                aria-haspopup="menu" aria-expanded={menuUsuario} onClick={() => setMenuUsuario((v) => !v)}>
                <Avatar className={styles.avatar} foto={minhaFoto} texto={iniciais} />
                <span className={`${styles.usuarioTexto} ${styles.itemRotulo}`}>
                  <span className={styles.usuarioNome} title={usuario?.nome}>{primeiroEUltimo(usuario?.nome)}</span>
                  <span className={styles.usuarioPlano}>{usuario?.email}</span>
                </span>
                <ChevronsUpDown size={15} strokeWidth={2} className={`${styles.usuarioSeta} ${styles.itemRotulo}`} aria-hidden="true" />
              </button>
            </div>
            {menuUsuario && (
              <div className={styles.menuUsuario} role="menu" aria-label="Conta">
                <button type="button" role="menuitem" className={`${styles.menuItem} ${styles.menuConta}`} onClick={() => irPara(INICIO)}>
                  <Avatar className={styles.avatar} foto={minhaFoto} texto={iniciais} />
                  <span className={styles.menuContaTexto}>
                    <span className={styles.usuarioNome}>{usuario?.nome}</span>
                    <span className={styles.usuarioPlano}>{usuario?.email}</span>
                  </span>
                </button>
                <span className={styles.menuGrupo}>Contas</span>
                {outrasContas.map((c) => (
                  <button key={c.id} type="button" role="menuitem" className={styles.menuItem} disabled={trocando} onClick={() => void trocarPara(c.id)}>
                    <span className={styles.espacoAvatar} aria-hidden="true">{iniciaisDe(c.nome)}</span>
                    <span className={styles.menuItemTexto}>
                      <span className={styles.menuItemNome}>{c.nome}</span>
                      <span className={styles.menuItemDetalhe}>{c.email}</span>
                    </span>
                  </button>
                ))}
                <button type="button" role="menuitem" className={styles.menuItem} onClick={() => irPara("/entrar?adicionar")}>
                  <span className={styles.espacoIcone} aria-hidden="true"><Plus size={14} strokeWidth={2.5} /></span>
                  <span className={styles.menuItemNome}>Adicionar conta</span>
                </button>
                {erroConta && <span className={styles.menuErro} role="alert">{erroConta}</span>}
                <span className={styles.menuSeparador} aria-hidden="true" />
                <button type="button" role="menuitem" className={styles.menuItem}
                  onClick={() => { setMenuUsuario(false); navigate("/configuracoes", { state: { voltarPara: pathname === "/configuracoes" ? voltarPara : pathname } }) }}>
                  <Settings size={16} strokeWidth={2} aria-hidden="true" /> Configurações
                </button>
                <span className={styles.menuSeparador} aria-hidden="true" />
                <button type="button" role="menuitem" className={styles.menuItem} onClick={sairAgora}>
                  <LogOut size={16} strokeWidth={2} aria-hidden="true" /> Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className={styles.corpo}>
        <header className={styles.topo} data-nao-imprime>
          <button type="button" className={styles.abrirMenu} aria-label="Abrir menu" onClick={() => setMenuAberto(true)}><PanelLeftOpen size={18} strokeWidth={2} /></button>
          {emTelaInterna && (
            <Botao variante="texto" soIcone aria-label="Voltar" className={styles.voltar} onClick={voltar}
              icone={<ArrowLeft size={18} strokeWidth={2.25} />} />
          )}
          <h1 className={styles.tituloPagina}>{secao?.rotulo ?? NOME_DO_APP}</h1>
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
            <Botao variante="primario" compactoNoCelular className={styles.novaTopo} onClick={acaoPrincipal}
              icone={<Plus size={16} strokeWidth={2.5} aria-hidden="true" />}>{ACAO_PRINCIPAL.rotulo}</Botao>
          </div>
        </header>
        <main className={styles.conteudo} key={`${usuario?.id ?? ""}:${pathname}`}>
          {usuario && <AvisoDeFuso usuarioId={usuario.id} fusoDaConta={usuario.fusoHorario} aoMudar={recarregar} />}
          <Outlet />
        </main>
        <nav className={styles.atalhos} aria-label="Atalhos" data-nao-imprime>
          <Atalho {...ATALHOS[0]} />
          <Atalho {...ATALHOS[1]} />
          <button type="button" className={styles.atalhoNova} aria-label={ACAO_PRINCIPAL.rotulo} onClick={acaoPrincipal}>
            <span className={styles.atalhoNovaBola}><Plus size={24} strokeWidth={2.5} aria-hidden="true" /></span>
          </button>
          <Atalho {...ATALHOS[2]} />
          <button type="button" className={styles.atalho} aria-expanded={menuAberto} onClick={() => setMenuAberto(true)}>
            <IconeMenu size={22} strokeWidth={2} aria-hidden="true" />
            <span>Menu</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
