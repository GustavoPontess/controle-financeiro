/**
 * Sidebar — navegação lateral do shell interno (#118). 100% biblioteca Pontes.
 * Cor via var(--pontes-*) (Sidebar.module.css). Estados via data-open (CSS).
 */

import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import {
  LayoutDashboard, Receipt, CreditCard, BarChart3, ArrowLeftRight, Repeat,
  CalendarClock, Handshake, Upload, Landmark, Tags, Users, Target, Gauge,
  Palette, User, Settings, HelpCircle, LogOut, Plus, ChevronRight,
} from "lucide-react"
import { PontesPopover, PontesLogo, PontesLogoMark, PontesSidebarItem, PontesSidebarSection, type PontesPopoverItem } from "@/components/pontes"
import AddAccountDialog from "../AddAccountDialog/AddAccountDialog"
import { useAuth } from "../../hooks/useAuth"
import styles from "./Sidebar.module.css"

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
      { to: "/metas", label: "Metas", icon: <Target size={19} strokeWidth={2} /> },
      { to: "/limites", label: "Limites", icon: <Gauge size={19} strokeWidth={2} /> },
    ],
  },
]

function getInitials(nome: string) {
  return nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
}

export default function Sidebar({ open, drawerWidth, railWidth }: SidebarProps) {
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
      icon: <span className={styles.miniAvatar}>{getInitials(a.nome)}</span>,
      label: a.nome,
      divider: true,
      onClick: () => void switchAccount(a.id),
    })),
    { key: "add-account", icon: <Plus size={16} strokeWidth={2.5} />, label: "Adicionar conta", divider: otherAccounts.length === 0, onClick: () => setAddAccountOpen(true) },
    { key: "logout", icon: <LogOut size={16} strokeWidth={2} />, label: "Sair", danger: true, divider: true, onClick: () => { logout(); navigate("/auth/login") } },
  ]

  return (
    <aside className={styles.aside} data-open={open ? "true" : "false"} style={{ width }}>
      {/* Logo — wordmark e mark "P" na MESMA coluna, cross-fade. */}
      <div className={styles.logoWrap}>
        <div className={styles.logoFull}>
          <PontesLogo color="var(--pontes-primary)" size={30} onClick={() => navigate("/dashboard")} />
        </div>
        <div className={styles.logoMark}>
          <PontesLogoMark color="var(--pontes-primary)" size={32} onClick={() => navigate("/dashboard")} />
        </div>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {NAV.map((group) => (
          <div key={group.section} className={styles.group}>
            <PontesSidebarSection label={group.section} collapsed={!open} />
            {group.items.map((item) => (
              <PontesSidebarItem
                key={item.to}
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
        <div className={styles.userWrap}>
          <PontesPopover
            align="left" minWidth={230} direction="up" fullWidth
            trigger={
              <div className={styles.userTrigger}>
                <span className={styles.avatar}>{initials}</span>
                <span className={styles.userInfo}>
                  <span className={styles.userText}>
                    <span className={styles.userName}>{currentUser.nome}</span>
                    <span className={styles.userPlan}>Plano Free</span>
                  </span>
                  <ChevronRight size={15} strokeWidth={2} color="var(--pontes-text-muted)" style={{ flexShrink: 0 }} />
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
