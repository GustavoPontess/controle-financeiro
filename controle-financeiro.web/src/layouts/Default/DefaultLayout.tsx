/**
 * DefaultLayout — shell do app logado (#118). 100% biblioteca Pontes.
 *
 * Orquestra Sidebar (rail colapsável) + Navbar + command palette (Ctrl+K) +
 * toasts (PontesToast) + dialogs. Cor + fonte do usePontesTheme.
 */

import { useState, useEffect, useMemo, useCallback } from "react"
import { Outlet, useNavigate, useLocation } from "react-router-dom"
import {
  LayoutDashboard, Receipt, CreditCard, BarChart3, Repeat,
  CalendarClock, Handshake, Upload, Landmark, Tags, Users, Target, Settings,
} from "lucide-react"
import { useAuth } from "../../hooks/useAuth"
import { PontesDrawer, PontesToast, PontesCommandPalette, useHideBalance, type PontesCommandItem } from "@/components/pontes"
import { ATE_TABLET, CELULAR, casa, useMediaQuery } from "../../hooks/useMediaQuery"
import styles from "./DefaultLayout.module.css"
import type { DetalheNoCaminho } from "./useDetalheNoCaminho"

import Navbar from "../../components/Navbar/Navbar"
import Sidebar from "../../components/Sidebar/Sidebar"
import InstallPrompt from "../../components/Pwa/InstallPrompt"

import { getCategories } from "../../services/categoryService"

const DRAWER_WIDTH = 208
const RAIL_WIDTH = 64
// No celular a barra lateral vira gaveta por cima do conteúdo (antes ficava fixa em 208px e sobravam ~150px).
const GAVETA_CELULAR = 264

type Notification = { open: boolean; message: string; severity: "success" | "error" | "warning" }

// "warning" = aviso de regra de negócio (o usuário resolve); "error" = algo quebrou.
const TITULO_TOAST: Record<Notification["severity"], string> = { success: "Sucesso", warning: "Aviso", error: "Erro" }

const COMMANDS: { to: string; label: string; icon: React.ReactNode }[] = [
  { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} strokeWidth={2} /> },
  { to: "/transactions", label: "Transações", icon: <Receipt size={18} strokeWidth={2} /> },
  { to: "/credit-cards", label: "Cartões de Crédito", icon: <CreditCard size={18} strokeWidth={2} /> },
  { to: "/reports", label: "Relatórios", icon: <BarChart3 size={18} strokeWidth={2} /> },
  { to: "/assinaturas", label: "Contas Fixas", icon: <Repeat size={18} strokeWidth={2} /> },
  { to: "/credit-cards/parcelamentos", label: "Parcelamentos", icon: <CalendarClock size={18} strokeWidth={2} /> },
  { to: "/emprestimos", label: "Empréstimos", icon: <Handshake size={18} strokeWidth={2} /> },
  { to: "/importacao", label: "Importar Extrato", icon: <Upload size={18} strokeWidth={2} /> },
  { to: "/accounts", label: "Bancos", icon: <Landmark size={18} strokeWidth={2} /> },
  { to: "/categories", label: "Categorias", icon: <Tags size={18} strokeWidth={2} /> },
  { to: "/familias", label: "Famílias", icon: <Users size={18} strokeWidth={2} /> },
  { to: "/metas", label: "Metas", icon: <Target size={18} strokeWidth={2} /> },
  { to: "/settings", label: "Configurações", icon: <Settings size={18} strokeWidth={2} /> },
]

export default function DefaultLayout() {
  const { accountKey } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Assina o olho global aqui no shell → ao alternar, re-renderiza o Outlet
  // (página atual) inteiro, mascarando/mostrando valores AO VIVO em qualquer tela.
  useHideBalance()

  // Tablet: a barra lateral começa recolhida (trilho) — aberta, o conteúdo ficava com ~540px. Dá pra expandir.
  const [open, setOpen] = useState(() => !casa(ATE_TABLET))
  const celular = useMediaQuery(CELULAR)
  // Aberta = aberta NESTA tela: tocar num item do menu troca a rota e a gaveta fecha sozinha.
  const [gavetaAbertaEm, setGavetaAbertaEm] = useState<string | null>(null)
  const gavetaAberta = gavetaAbertaEm === location.pathname
  const [canCreateTransaction, setCanCreateTransaction] = useState(false)
  const [notification, setNotification] = useState<Notification>({ open: false, message: "", severity: "success" })

  // Command palette (Ctrl/Cmd+K)
  // Nome do item aberto numa tela de detalhe, pro caminho do topo (ver useDetalheNoCaminho).
  const [detalheNoCaminho, setDetalheNoCaminho] = useState<DetalheNoCaminho | null>(null)
  const definirDetalheNoCaminho = useCallback(
    (label: string | null) => setDetalheNoCaminho(label ? { path: location.pathname, label } : null),
    [location.pathname],
  )
  const [cmdOpen, setCmdOpen] = useState(false)
  const [cmdQuery, setCmdQuery] = useState("")

  const checkRequirements = useCallback(async () => {
    const categories = await getCategories()
    setCanCreateTransaction(categories.length > 0)
  }, [])

  useEffect(() => { void checkRequirements() }, [accountKey, checkRequirements])

  // Atalho global de busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setCmdQuery("")
        setCmdOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Nova transação é uma TELA (/transactions/nova), não mais popup. O "Voltar"/salvar leva de volta pra
  // onde a pessoa estava. Botão do topo e evento `openNewTransaction` (disparado por telas) passam aqui.
  const abrirNovaTransacao = useCallback(() => {
    if (!canCreateTransaction) {
      setNotification({ open: true, message: "Cadastre uma categoria antes de criar transações.", severity: "error" })
      return
    }
    navigate("/transactions/nova", { state: { voltarPara: location.pathname + location.search } })
  }, [canCreateTransaction, navigate, location.pathname, location.search])

  useEffect(() => {
    window.addEventListener("openNewTransaction", abrirNovaTransacao)
    return () => window.removeEventListener("openNewTransaction", abrirNovaTransacao)
  }, [abrirNovaTransacao])

  // Rede de segurança: erro de API (disparado pelo interceptor do axios) vira toast de erro —
  // garante que nenhum erro do backend passe silencioso, mesmo se a tela não tratar.
  useEffect(() => {
    const handler = (e: Event) => {
      const message = (e as CustomEvent<{ message?: string }>).detail?.message
        ?? "Não foi possível concluir a ação."
      setNotification({ open: true, message, severity: "error" })
    }
    window.addEventListener("apiError", handler)
    return () => window.removeEventListener("apiError", handler)
  }, [])

  // Auto-hide do toast
  useEffect(() => {
    if (!notification.open) return
    const t = setTimeout(() => setNotification((n) => ({ ...n, open: false })), 4000)
    return () => clearTimeout(t)
  }, [notification.open])

  const cmdItems: PontesCommandItem[] = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase()
    return COMMANDS
      .filter((c) => !q || c.label.toLowerCase().includes(q))
      .map((c) => ({
        key: c.to, icon: c.icon, label: c.label, hint: "Ir",
        onSelect: () => { setCmdOpen(false); navigate(c.to) },
      }))
  }, [cmdQuery, navigate])

  return (
    <div className={styles.shell}>
      {/* Sidebar transparente — "atrás", no canvas. No celular: gaveta por cima, fechada por padrão. */}
      {celular ? (
        <PontesDrawer bare side="left" width={GAVETA_CELULAR} open={gavetaAberta}
          onClose={() => setGavetaAbertaEm(null)} ariaLabel="Menu">
          <Sidebar open drawerWidth={GAVETA_CELULAR} railWidth={RAIL_WIDTH} />
        </PontesDrawer>
      ) : (
        <Sidebar open={open} drawerWidth={DRAWER_WIDTH} railWidth={RAIL_WIDTH} />
      )}

      {/* Conteúdo flutuante — card arredondado por cima do canvas */}
      <div className={styles.card}>
        {/* Faixa accent — detalhe de marca no topo do card (discreta) */}
        <div className={styles.accentStrip} />
        <Navbar
          toggleDrawer={() => (celular ? setGavetaAbertaEm(location.pathname) : setOpen((o) => !o))}
          sidebarOpen={celular ? gavetaAberta : open}
          celular={celular}
          openTransaction={abrirNovaTransacao}
          canCreateTransaction={canCreateTransaction}
          openCommandPalette={() => { setCmdQuery(""); setCmdOpen(true) }}
          detalhe={detalheNoCaminho?.path === location.pathname ? detalheNoCaminho.label : undefined}
        />

        <main className={styles.main}>
          <div key={location.pathname} className={styles.page}>
            <Outlet key={accountKey} context={{
              notify: setNotification, refreshTransactionRequirements: checkRequirements,
              definirDetalheNoCaminho,
            }} />
          </div>
        </main>
      </div>

      <InstallPrompt />

      <PontesCommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        query={cmdQuery} onQueryChange={setCmdQuery}
        items={cmdItems}
      />

      {notification.open && (
        <div className={styles.toastWrap}>
          <PontesToast
            tone={notification.severity}
            title={TITULO_TOAST[notification.severity]}
            description={notification.message}
            onClose={() => setNotification((n) => ({ ...n, open: false }))}
          />
        </div>
      )}
    </div>
  )
}
