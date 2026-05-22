/**
 * DefaultLayout — shell do app logado (#118). 100% biblioteca Pontes.
 *
 * Orquestra Sidebar (rail colapsável) + Navbar + command palette (Ctrl+K) +
 * toasts (PontesToast) + dialogs. Cor + fonte do usePontesTheme.
 */

import { useState, useEffect, useMemo, useCallback } from "react"
import { Outlet, useNavigate, useLocation } from "react-router-dom"
import {
  LayoutDashboard, Receipt, CreditCard, BarChart3, ArrowLeftRight, Repeat,
  CalendarClock, Handshake, Upload, Landmark, Tags, Users, Settings,
} from "lucide-react"
import { useAuth } from "../../hooks/useAuth"
import { PontesToast, PontesCommandPalette, usePontesTheme, type PontesCommandItem } from "@/components/pontes"

import Navbar from "../../components/Navbar/Navbar"
import Sidebar from "../../components/Sidebar/Sidebar"
import NewTransactionDialog from "../../components/transactions/NewTransactionDialog/NewTransactionDialog"
import InstallPrompt from "../../components/Pwa/InstallPrompt"

import { getCategories } from "../../services/categoryService"

const DRAWER_WIDTH = 248
const RAIL_WIDTH = 72

type Notification = { open: boolean; message: string; severity: "success" | "error" }

const COMMANDS: { to: string; label: string; icon: React.ReactNode }[] = [
  { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} strokeWidth={2} /> },
  { to: "/transactions", label: "Transações", icon: <Receipt size={18} strokeWidth={2} /> },
  { to: "/credit-cards", label: "Cartões de Crédito", icon: <CreditCard size={18} strokeWidth={2} /> },
  { to: "/reports", label: "Relatórios", icon: <BarChart3 size={18} strokeWidth={2} /> },
  { to: "/transferencias", label: "Transferências", icon: <ArrowLeftRight size={18} strokeWidth={2} /> },
  { to: "/assinaturas", label: "Assinaturas", icon: <Repeat size={18} strokeWidth={2} /> },
  { to: "/parcelamentos", label: "Parcelamentos", icon: <CalendarClock size={18} strokeWidth={2} /> },
  { to: "/emprestimos", label: "Empréstimos", icon: <Handshake size={18} strokeWidth={2} /> },
  { to: "/importacao", label: "Importar Extrato", icon: <Upload size={18} strokeWidth={2} /> },
  { to: "/accounts", label: "Contas", icon: <Landmark size={18} strokeWidth={2} /> },
  { to: "/categories", label: "Categorias", icon: <Tags size={18} strokeWidth={2} /> },
  { to: "/familias", label: "Famílias", icon: <Users size={18} strokeWidth={2} /> },
  { to: "/settings", label: "Configurações", icon: <Settings size={18} strokeWidth={2} /> },
]

export default function DefaultLayout() {
  const { palette: p, font } = usePontesTheme()
  const { accountKey } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [open, setOpen] = useState(true)
  const [openTransaction, setOpenTransaction] = useState(false)
  const [canCreateTransaction, setCanCreateTransaction] = useState(false)
  const [notification, setNotification] = useState<Notification>({ open: false, message: "", severity: "success" })

  // Command palette (Ctrl/Cmd+K)
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
    <div style={{
      display: "flex", height: "100vh", fontFamily: font,
      background: `
        radial-gradient(40% 28% at 3% 3%, ${p.primary}33, transparent 60%),
        radial-gradient(38% 30% at 17% 97%, ${p.accent}30, transparent 60%),
        ${p.bg}
      `,
      padding: 12, gap: 4, boxSizing: "border-box", overflow: "hidden",
    }}>
      {/* Sidebar transparente — "atrás", no canvas */}
      <Sidebar open={open} drawerWidth={DRAWER_WIDTH} railWidth={RAIL_WIDTH} />

      {/* Conteúdo flutuante — card arredondado por cima do canvas */}
      <div style={{
        flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative",
        background: p.surface, borderRadius: 20, overflow: "hidden",
        boxShadow: "0 18px 50px -24px rgba(11,18,32,0.16), 0 4px 14px -8px rgba(11,18,32,0.08)",
        border: `1px solid ${p.border}`,
      }}>
        {/* Faixa accent — detalhe de marca no topo do card (discreta) */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${p.primary}, ${p.accent})`, opacity: 0.85, zIndex: 1001 }} />
        <Navbar
          toggleDrawer={() => setOpen((o) => !o)}
          sidebarOpen={open}
          openTransaction={() => setOpenTransaction(true)}
          canCreateTransaction={canCreateTransaction}
          openCommandPalette={() => { setCmdQuery(""); setCmdOpen(true) }}
        />

        <main style={{ flex: 1, overflowY: "auto", padding: 28 }}>
          <style>{`@keyframes pontes-page-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }`}</style>
          <div
            key={location.pathname}
            style={{ maxWidth: 1480, margin: "0 auto", animation: "pontes-page-in 320ms cubic-bezier(0.4,0,0.2,1)" }}
          >
            <Outlet key={accountKey} context={{ notify: setNotification, refreshTransactionRequirements: checkRequirements }} />
          </div>
        </main>
      </div>

      <NewTransactionDialog open={openTransaction} onClose={() => setOpenTransaction(false)} notify={setNotification} />
      <InstallPrompt />

      <PontesCommandPalette
        p={p} font={font} open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        query={cmdQuery} onQueryChange={setCmdQuery}
        items={cmdItems}
      />

      {notification.open && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9998 }}>
          <PontesToast
            font={font}
            tone={notification.severity}
            title={notification.severity === "success" ? "Sucesso" : "Erro"}
            description={notification.message}
            onClose={() => setNotification((n) => ({ ...n, open: false }))}
          />
        </div>
      )}
    </div>
  )
}
