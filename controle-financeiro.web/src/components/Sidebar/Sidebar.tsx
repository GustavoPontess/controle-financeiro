/**
 * Sidebar — navegação lateral do shell interno (#118). 100% biblioteca Pontes.
 *
 * Expandida (240px) mostra logo + labels; colapsada vira rail de ícones (72px)
 * com tooltip no hover. Estado ativo destacado pela rota atual. Menu de usuário
 * via PontesPopover (perfil, personalização, troca de conta, sair). Cor + fonte
 * do usePontesTheme.
 */

import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import {
  LayoutDashboard, Receipt, CreditCard, BarChart3, ArrowLeftRight, Repeat,
  CalendarClock, Handshake, Upload, Landmark, Tags, Users,
  Palette, User, Settings, HelpCircle, LogOut, Plus, ChevronRight,
} from "lucide-react"
import { PontesPopover, PontesLogo, PontesLogoMark, PontesSidebarItem, PontesSidebarSection, usePontesTheme, type PontesPopoverItem } from "@/components/pontes"
import AddAccountDialog from "../AddAccountDialog/AddAccountDialog"
import { useAuth } from "../../hooks/useAuth"

type SidebarProps = { open: boolean; drawerWidth: number; railWidth: number }

type NavItem = { to: string; label: string; icon: React.ReactNode }

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Principal",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={19} strokeWidth={2} /> },
      { to: "/transactions", label: "Transações", icon: <Receipt size={19} strokeWidth={2} /> },
      { to: "/credit-cards", label: "Cartões de Crédito", icon: <CreditCard size={19} strokeWidth={2} /> },
      { to: "/reports", label: "Relatórios", icon: <BarChart3 size={19} strokeWidth={2} /> },
      { to: "/transferencias", label: "Transferências", icon: <ArrowLeftRight size={19} strokeWidth={2} /> },
      { to: "/assinaturas", label: "Assinaturas", icon: <Repeat size={19} strokeWidth={2} /> },
      { to: "/parcelamentos", label: "Parcelamentos", icon: <CalendarClock size={19} strokeWidth={2} /> },
      { to: "/emprestimos", label: "Empréstimos", icon: <Handshake size={19} strokeWidth={2} /> },
      { to: "/importacao", label: "Importar Extrato", icon: <Upload size={19} strokeWidth={2} /> },
    ],
  },
  {
    section: "Gerenciamento",
    items: [
      { to: "/accounts", label: "Contas", icon: <Landmark size={19} strokeWidth={2} /> },
      { to: "/categories", label: "Categorias", icon: <Tags size={19} strokeWidth={2} /> },
      { to: "/familias", label: "Famílias", icon: <Users size={19} strokeWidth={2} /> },
    ],
  },
]

function getInitials(nome: string) {
  return nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
}

export default function Sidebar({ open, drawerWidth, railWidth }: SidebarProps) {
  const { palette: p, font } = usePontesTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, savedAccounts, logout, switchAccount } = useAuth()
  const [addAccountOpen, setAddAccountOpen] = useState(false)

  const width = open ? drawerWidth : railWidth
  const initials = currentUser?.nome ? getInitials(currentUser.nome) : "?"
  const otherAccounts = savedAccounts.filter((a) => a.id !== currentUser?.id)

  const userItems: PontesPopoverItem[] = [
    { key: "personalizacao", icon: <Palette size={16} strokeWidth={2} />, label: "Personalização", onClick: () => navigate("/settings") },
    { key: "perfil", icon: <User size={16} strokeWidth={2} />, label: "Perfil", onClick: () => navigate("/settings") },
    { key: "config", icon: <Settings size={16} strokeWidth={2} />, label: "Configurações", onClick: () => navigate("/settings") },
    { key: "ajuda", icon: <HelpCircle size={16} strokeWidth={2} />, label: "Ajuda", onClick: () => navigate("/settings") },
    ...otherAccounts.map((a): PontesPopoverItem => ({
      key: `acc-${a.id}`,
      icon: <span style={{ width: 18, height: 18, borderRadius: "50%", background: p.primary, color: p.heroFg, fontSize: 9, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{getInitials(a.nome)}</span>,
      label: a.nome,
      divider: true,
      onClick: () => void switchAccount(a.id),
    })),
    { key: "add-account", icon: <Plus size={16} strokeWidth={2.5} />, label: "Adicionar conta", divider: otherAccounts.length === 0, onClick: () => setAddAccountOpen(true) },
    { key: "logout", icon: <LogOut size={16} strokeWidth={2} />, label: "Sair", danger: true, divider: true, onClick: () => { logout(); navigate("/auth/login") } },
  ]

  return (
    <aside style={{
      width, flexShrink: 0, height: "100%",
      display: "flex", flexDirection: "column", fontFamily: font,
      transition: "width 220ms cubic-bezier(0.4,0,0.2,1)",
      background: "transparent",
    }}>
      {/* Logo — wordmark e mark "P" na MESMA coluna (a dos ícones, ~24px),
          cross-fade sem nenhum deslocamento perceptível. */}
      <div style={{ height: 60, position: "relative", flexShrink: 0 }}>
        <div style={{ position: "absolute", left: 24, top: 0, bottom: 0, display: "flex", alignItems: "center", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 160ms ease" }}>
          <PontesLogo color={p.primary} size={30} onClick={() => navigate("/dashboard")} />
        </div>
        <div style={{ position: "absolute", left: 24, top: 0, bottom: 0, display: "flex", alignItems: "center", opacity: open ? 0 : 1, pointerEvents: open ? "none" : "auto", transition: "opacity 160ms ease" }}>
          <PontesLogoMark color={p.primary} size={32} onClick={() => navigate("/dashboard")} />
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "12px 12px 0" }}>
        {NAV.map((group) => (
          <div key={group.section} style={{ marginBottom: 8 }}>
            <PontesSidebarSection p={p} label={group.section} collapsed={!open} />
            {group.items.map((item) => (
              <PontesSidebarItem
                key={item.to}
                p={p} font={font}
                icon={item.icon}
                label={item.label}
                active={location.pathname === item.to || location.pathname.startsWith(item.to + "/")}
                collapsed={!open}
                onClick={() => navigate(item.to)}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Usuário */}
      {currentUser && (
        <div style={{ padding: "4px 12px 12px", flexShrink: 0 }}>
          <PontesPopover
            p={p} font={font} align="left" minWidth={230} direction="up" fullWidth
            trigger={
              <div className="pontes-clickable" data-pontes-variant="ghost" style={{
                display: "flex", alignItems: "center", gap: open ? 12 : 0, padding: "8px 12px",
                borderRadius: 10, cursor: "pointer", justifyContent: "flex-start",
                transition: "gap 200ms ease",
              }}>
                <span style={{ width: 34, height: 34, borderRadius: "50%", background: p.primary, color: p.heroFg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0, boxShadow: `0 0 0 2px ${p.surface}, 0 0 0 4px ${p.primarySoft}` }}>{initials}</span>
                <span style={{
                  display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0,
                  opacity: open ? 1 : 0, maxWidth: open ? 200 : 0, overflow: "hidden",
                  transition: "opacity 160ms ease, max-width 220ms ease",
                }}>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: p.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentUser.nome}</span>
                    <span style={{ display: "inline-block", marginTop: 3, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", color: p.primary, background: p.primarySoft, padding: "1px 7px", borderRadius: 999, whiteSpace: "nowrap" }}>Plano Free</span>
                  </span>
                  <ChevronRight size={15} strokeWidth={2} color={p.textMuted} style={{ flexShrink: 0 }} />
                </span>
              </div>
            }
            items={userItems}
          />
        </div>
      )}

      <AddAccountDialog open={addAccountOpen} onClose={() => setAddAccountOpen(false)} />
    </aside>
  )
}
