/**
 * Navbar — barra superior do shell interno (#118). 100% biblioteca Pontes.
 * Cor via var(--pontes-*) (Navbar.module.css).
 */

import { useLocation, useNavigate } from "react-router-dom"
import { PanelLeftClose, PanelLeftOpen, Search, Plus, Eye, EyeOff } from "lucide-react"
import { PontesButton, PontesIconButton, useHideBalance } from "@/components/pontes"
import NotificationBell from "../Notificacoes/NotificationBell"
import styles from "./Navbar.module.css"

type Props = {
  toggleDrawer: () => void
  sidebarOpen: boolean
  /** Ações financeiras (Nova transação + ocultar valores). Omitir no painel admin. */
  showFinance?: boolean
  openTransaction?: () => void
  canCreateTransaction?: boolean
  openCommandPalette?: () => void
  /** Título da tela. Se omitido, resolve pelo mapa de rotas do usuário. Telas fora desse mapa
   *  (ex.: painel admin) passam o título aqui — assim NENHUMA rota de admin fica no bundle comum. */
  title?: string
  /** Rótulo do "Início" no breadcrumb + destino. Default = Início/dashboard. */
  homeLabel?: string
  homePath?: string
  /** Nome do item numa tela de detalhe (ex.: "Fone Teste") — vira o último nível do caminho:
   *  "Início / Parcelamentos / Fone Teste", com "Parcelamentos" clicável de volta à lista. */
  detalhe?: string
  /** Sino de notificações. Se omitido, usa o financeiro (só quando `showFinance`). O painel admin
   *  injeta o SEU próprio sino aqui — assim o stream do admin não se mistura com o do usuário, e o
   *  componente do sino admin não entra no bundle comum. */
  notifications?: React.ReactNode
  /** Botão de mascarar/revelar dados sensíveis (olhinho). O painel admin injeta o seu aqui. */
  sensitiveToggle?: React.ReactNode
}

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/transactions": "Transações",
  "/credit-cards": "Cartões de Crédito",
  "/credit-cards/parcelamentos": "Parcelamentos",
  "/reports": "Relatórios",
  "/transferencias": "Transferências",
  "/assinaturas": "Contas Fixas",
  "/emprestimos": "Empréstimos",
  "/importacao": "Importar Extrato",
  "/accounts": "Bancos",
  "/categories": "Categorias",
  "/familias": "Famílias",
  "/settings": "Configurações",
}

// Seção que mora dentro de outra (Parcelamentos é parte de Cartões): o caminho mostra as duas.
const PAI: Record<string, string> = { "/credit-cards/parcelamentos": "/credit-cards" }

// Seção da rota: título e path da lista. Vale o prefixo MAIS LONGO — "/credit-cards/parcelamentos/abc"
// é Parcelamentos, não Cartões.
function resolveSecao(path: string): { title: string; path: string | null } {
  const k = Object.keys(TITLES)
    .filter((key) => path === key || path.startsWith(key + "/"))
    .sort((a, b) => b.length - a.length)[0]
  return k ? { title: TITLES[k], path: k } : { title: "Pontes", path: null }
}

type Crumb = { label: string; to?: string }

export default function Navbar({
  toggleDrawer, sidebarOpen, showFinance = true,
  openTransaction, canCreateTransaction, openCommandPalette,
  title: titleProp, homeLabel = "Início", homePath = "/dashboard", notifications, sensitiveToggle, detalhe,
}: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const secao = resolveSecao(location.pathname)
  const title = titleProp ?? secao.title
  const isHome = location.pathname === homePath
  // Início / [seção-pai] / seção / [detalhe]. Todo nível é link, menos o último (onde você está).
  const crumbs: Crumb[] = [{ label: homeLabel, to: homePath }]
  if (titleProp) crumbs.push({ label: titleProp })
  else {
    const pai = secao.path ? PAI[secao.path] : undefined
    if (pai) crumbs.push({ label: TITLES[pai], to: pai })
    if (detalhe && secao.path) crumbs.push({ label: title, to: secao.path }, { label: detalhe })
    else crumbs.push({ label: title })
  }
  const [hideBalance, toggleBalance] = useHideBalance()

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <PontesIconButton variant="ghost" size={40} onClick={toggleDrawer} aria-label={sidebarOpen ? "Recolher menu" : "Expandir menu"}>
          {sidebarOpen ? <PanelLeftClose size={18} strokeWidth={2} /> : <PanelLeftOpen size={18} strokeWidth={2} />}
        </PontesIconButton>
        <div className={styles.titleBox}>
          {!isHome && (
            <div className={styles.crumb}>
              {crumbs.map((c, i) => {
                const ultimo = i === crumbs.length - 1
                return (
                  <span key={`${i}-${c.label}`}>
                    {i > 0 && <span className={styles.crumbSep}> / </span>}
                    {ultimo || !c.to
                      ? <span className={styles.crumbCur}>{c.label}</span>
                      : <span onClick={() => navigate(c.to!)} className={styles.crumbHome}>{c.label}</span>}
                  </span>
                )
              })}
            </div>
          )}
          <h1 className={styles.title}>{title}</h1>
        </div>
      </div>

      <div className={styles.right}>
        {openCommandPalette && (
          <button onClick={openCommandPalette} className={styles.search} aria-label="Buscar">
            <Search size={16} strokeWidth={2} />
            <span className={styles.searchText}>Buscar telas…</span>
            <kbd className={styles.kbd}>Ctrl K</kbd>
          </button>
        )}

        {showFinance && (
          <PontesIconButton
            variant="ghost" size={40}
            onClick={toggleBalance}
            aria-label={hideBalance ? "Mostrar valores" : "Ocultar valores"}
            title={hideBalance ? "Mostrar valores" : "Ocultar valores"}
          >
            {hideBalance ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
          </PontesIconButton>
        )}

        {/* Olho de mascarar dado sensível (injetado pelo painel admin). */}
        {sensitiveToggle}

        {/* Sino: o painel admin injeta o seu (stream próprio). Sem injeção, usa o financeiro — e só
            quando showFinance (o sino do usuário puxa notificacaoService e navega pra finanças). */}
        {notifications ?? (showFinance ? <NotificationBell /> : null)}

        {showFinance && (
          <PontesButton
            variant="accent" size="md"
            onClick={openTransaction}
            disabled={!canCreateTransaction}
            iconStart={<Plus size={16} strokeWidth={2.5} />}
            title={canCreateTransaction ? undefined : "Cadastre pelo menos uma categoria antes de adicionar transações"}
          >
            Nova transação
          </PontesButton>
        )}
      </div>
    </header>
  )
}
