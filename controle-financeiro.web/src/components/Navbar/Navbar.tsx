/**
 * Navbar — barra superior do shell interno (#118). 100% biblioteca Pontes.
 *
 * Toggle do sidebar, título da rota atual, busca/command palette (Ctrl+K),
 * sino de notificações e ação "Nova transação". Cor + fonte do usePontesTheme.
 */

import { useLocation, useNavigate } from "react-router-dom"
import { PanelLeftClose, PanelLeftOpen, Search, Plus } from "lucide-react"
import { PontesButton, PontesIconButton, usePontesTheme } from "@/components/pontes"
import NotificationBell from "../Notificacoes/NotificationBell"

type Props = {
  toggleDrawer: () => void
  sidebarOpen: boolean
  openTransaction: () => void
  canCreateTransaction: boolean
  openCommandPalette: () => void
}

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/transactions": "Transações",
  "/credit-cards": "Cartões de Crédito",
  "/reports": "Relatórios",
  "/transferencias": "Transferências",
  "/assinaturas": "Assinaturas",
  "/parcelamentos": "Parcelamentos",
  "/emprestimos": "Empréstimos",
  "/importacao": "Importar Extrato",
  "/accounts": "Contas",
  "/categories": "Categorias",
  "/familias": "Famílias",
  "/settings": "Configurações",
}

function resolveTitle(path: string): string {
  if (TITLES[path]) return TITLES[path]
  const k = Object.keys(TITLES).find((key) => path.startsWith(key + "/"))
  return k ? TITLES[k] : "Pontes"
}

export default function Navbar({ toggleDrawer, sidebarOpen, openTransaction, canCreateTransaction, openCommandPalette }: Props) {
  const { palette: p, font } = usePontesTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const title = resolveTitle(location.pathname)
  const isDashboard = location.pathname === "/dashboard"

  return (
    <header style={{
      height: 64, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 16, padding: "0 24px", background: p.surface, borderBottom: `1px solid ${p.border}`,
      fontFamily: font, position: "sticky", top: 0, zIndex: 1000,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <PontesIconButton p={p} font={font} variant="ghost" size={40} onClick={toggleDrawer} aria-label={sidebarOpen ? "Recolher menu" : "Expandir menu"}>
          {sidebarOpen ? <PanelLeftClose size={18} strokeWidth={2} /> : <PanelLeftOpen size={18} strokeWidth={2} />}
        </PontesIconButton>
        <div style={{ minWidth: 0 }}>
          {!isDashboard && (
            <div style={{ fontSize: 11, color: p.textMuted, fontWeight: 500, marginBottom: 1 }}>
              <span onClick={() => navigate("/dashboard")} style={{ cursor: "pointer" }}>Início</span>
              <span style={{ opacity: 0.5 }}> / </span>
              <span style={{ color: p.text }}>{title}</span>
            </div>
          )}
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: p.text, margin: 0, lineHeight: 1.35, fontFamily: "'Fraunces', serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</h1>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Busca / command palette */}
        <button
          onClick={openCommandPalette}
          className="pontes-clickable" data-pontes-variant="ghost"
          style={{
            display: "flex", alignItems: "center", gap: 10, height: 40, padding: "0 12px",
            border: `1px solid ${p.border}`, borderRadius: 10, cursor: "pointer",
            background: p.bg, color: p.textMuted, fontFamily: font, fontSize: 13, minWidth: 200,
          }}
          aria-label="Buscar"
        >
          <Search size={16} strokeWidth={2} />
          <span style={{ flex: 1, textAlign: "left" }}>Buscar telas…</span>
          <kbd style={{ fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 6, border: `1px solid ${p.border}`, background: p.surface, color: p.textMuted }}>Ctrl K</kbd>
        </button>

        <NotificationBell />

        <PontesButton
          p={p} font={font} variant="accent" size="md"
          onClick={openTransaction}
          disabled={!canCreateTransaction}
          iconStart={<Plus size={16} strokeWidth={2.5} />}
          title={canCreateTransaction ? undefined : "Cadastre pelo menos uma categoria antes de adicionar transações"}
        >
          Nova transação
        </PontesButton>
      </div>
    </header>
  )
}
