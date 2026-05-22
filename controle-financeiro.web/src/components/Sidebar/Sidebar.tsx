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
import { PontesPopover, PontesLogo, usePontesTheme, type PontesPopoverItem } from "@/components/pontes"
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
      transition: "width 220ms cubic-bezier(0.4,0,0.2,1)", overflow: "hidden",
      background: "transparent",
    }}>
      {/* Logo */}
      <div style={{ height: 60, display: "flex", alignItems: "center", padding: open ? "0 16px" : 0, justifyContent: open ? "flex-start" : "center", flexShrink: 0 }}>
        {open ? (
          <PontesLogo color={p.primary} size={26} onClick={() => navigate("/dashboard")} />
        ) : (
          <div onClick={() => navigate("/dashboard")} style={{ width: 36, height: 36, borderRadius: 10, background: p.primary, color: p.heroFg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, cursor: "pointer" }}>P</div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "12px 12px 0" }}>
        {NAV.map((group) => (
          <div key={group.section} style={{ marginBottom: 8 }}>
            {open && (
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: p.textMuted, padding: "12px 12px 6px" }}>{group.section}</div>
            )}
            {!open && <div style={{ height: 1, background: p.border, margin: "10px 8px" }} />}
            {group.items.map((item) => {
              const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/")
              return (
                <button
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  title={!open ? item.label : undefined}
                  className="pontes-clickable"
                  data-pontes-variant={active ? "soft" : "ghost"}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: open ? "10px 12px" : "10px 0", marginBottom: 2,
                    justifyContent: open ? "flex-start" : "center",
                    border: "none", borderRadius: 10, cursor: "pointer",
                    background: active ? p.primarySoft : "transparent",
                    color: active ? p.primary : p.text,
                    fontSize: 14, fontWeight: active ? 700 : 500, fontFamily: font,
                    position: "relative",
                    ...(active ? { ["--pontes-hover-bg" as string]: p.primarySoft } : {}),
                  }}
                >
                  {active && open && <span style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, background: p.primary }} />}
                  <span style={{ display: "flex", flexShrink: 0, color: active ? p.primary : p.textMuted }}>{item.icon}</span>
                  {open && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Usuário */}
      {currentUser && (
        <div style={{ padding: "8px 8px 4px", flexShrink: 0 }}>
          <PontesPopover
            p={p} font={font} align="left" minWidth={230}
            trigger={
              <div className="pontes-clickable" data-pontes-variant="ghost" style={{
                display: "flex", alignItems: "center", gap: 10, padding: open ? "8px 10px" : 8,
                borderRadius: 10, cursor: "pointer", justifyContent: open ? "flex-start" : "center",
              }}>
                <span style={{ width: 34, height: 34, borderRadius: "50%", background: p.primary, color: p.heroFg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{initials}</span>
                {open && (
                  <>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: p.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentUser.nome}</span>
                      <span style={{ display: "block", fontSize: 11, color: p.textMuted }}>Plano Free</span>
                    </span>
                    <ChevronRight size={15} strokeWidth={2} color={p.textMuted} />
                  </>
                )}
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
