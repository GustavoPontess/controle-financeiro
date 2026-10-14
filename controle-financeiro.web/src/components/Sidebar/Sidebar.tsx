/**
 * Sidebar — navegação lateral do shell interno (#118). 100% biblioteca Pontes.
 * Cor via var(--pontes-*) (Sidebar.module.css). Estados via data-open (CSS).
 */

import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import {
  LayoutDashboard, Receipt, CreditCard, BarChart3, Repeat,
  Handshake, Upload, Landmark, Tags, Users, Target, Gauge,
  Settings, LogOut, Plus, Scale, PanelLeftClose, PanelLeftOpen,
} from "lucide-react"
import { PontesPopover, PontesLogo, PontesLogoMark, PontesSidebarItem, PontesSidebarSection, type PontesPopoverItem } from "@/components/pontes"
import AddAccountDialog from "../AddAccountDialog/AddAccountDialog"
import { useAuth } from "../../hooks/useAuth"
import styles from "./Sidebar.module.css"

export type SidebarNavItem = { to: string; label: string; icon: React.ReactNode }
export type SidebarNavGroup = { section: string; items: SidebarNavItem[] }

type SidebarProps = {
  open: boolean
  drawerWidth: number
  railWidth: number
  /** Grupos de navegação. Default = menu do usuário. O painel admin passa o seu próprio. */
  nav?: SidebarNavGroup[]
  /** Destino do clique no logo. Default = /dashboard. */
  homePath?: string
  /** Recolher/expandir (só no computador). Com isso, o botão mora ao lado da logo; no trilho o "P" é o botão. */
  onToggle?: () => void
}

const NAV: SidebarNavGroup[] = [
  {
    section: "Principal",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} strokeWidth={2} /> },
      { to: "/transactions", label: "Transações", icon: <Receipt size={18} strokeWidth={2} /> },
      { to: "/credit-cards", label: "Cartões de Crédito", icon: <CreditCard size={18} strokeWidth={2} /> },
      { to: "/assinaturas", label: "Contas Fixas", icon: <Repeat size={18} strokeWidth={2} /> },
      { to: "/reports", label: "Relatórios", icon: <BarChart3 size={18} strokeWidth={2} /> },
      { to: "/reconciliacao", label: "Reconciliação", icon: <Scale size={18} strokeWidth={2} /> },
      { to: "/emprestimos", label: "Empréstimos", icon: <Handshake size={18} strokeWidth={2} /> },
      { to: "/importacao", label: "Importar Extrato", icon: <Upload size={18} strokeWidth={2} /> },
    ],
  },
  {
    section: "Gerenciamento",
    items: [
      { to: "/accounts", label: "Bancos", icon: <Landmark size={18} strokeWidth={2} /> },
      { to: "/categories", label: "Categorias", icon: <Tags size={18} strokeWidth={2} /> },
      { to: "/familias", label: "Famílias", icon: <Users size={18} strokeWidth={2} /> },
      { to: "/metas", label: "Metas", icon: <Target size={18} strokeWidth={2} /> },
      { to: "/limites", label: "Limites", icon: <Gauge size={18} strokeWidth={2} /> },
    ],
  },
]

function getInitials(nome: string) {
  return nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
}

export default function Sidebar({ open, drawerWidth, railWidth, nav, homePath = "/dashboard", onToggle }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, savedAccounts, logout, switchAccount } = useAuth()
  const [addAccountOpen, setAddAccountOpen] = useState(false)

  const groups = nav ?? NAV
  const width = open ? drawerWidth : railWidth
  const initials = currentUser?.nome ? getInitials(currentUser.nome) : "?"
  const otherAccounts = savedAccounts.filter((a) => a.id !== currentUser?.id)

  // Só navega pra login DEPOIS que o servidor confirmou a revogação (logout-all). Se falhar,
  // não afirma "saiu" — mantém a sessão e avisa (senão a conta seguiria acessível no servidor).
  const sair = () => {
    logout()
      .then(() => navigate("/auth/login"))
      .catch(() => window.dispatchEvent(new CustomEvent("apiError", {
        detail: { message: "Não foi possível sair agora. Tente de novo." },
      })))
  }

  // Menu do avatar: configurações, trocar de conta, adicionar conta, sair.
  const userItems: PontesPopoverItem[] = [
    { key: "config", icon: <Settings size={16} strokeWidth={2} />, label: "Configurações", onClick: () => navigate("/settings") },
    ...otherAccounts.map((a): PontesPopoverItem => ({
      key: `acc-${a.id}`,
      icon: <span className={styles.miniAvatar}>{getInitials(a.nome)}</span>,
      label: a.nome,
      onClick: () => {
        // switchAccount pode rejeitar (sessão daquela conta expirou) — surfa no toast global.
        switchAccount(a.id).catch((e) =>
          window.dispatchEvent(new CustomEvent("apiError", {
            detail: { message: (e as Error)?.message ?? "Não foi possível trocar de conta." },
          }))
        )
      },
    })),
    { key: "add-account", icon: <Plus size={16} strokeWidth={2.5} />, label: "Adicionar conta", onClick: () => setAddAccountOpen(true) },
    { key: "logout", icon: <LogOut size={16} strokeWidth={2} />, label: "Sair", onClick: sair },
  ]

  return (
    <aside className={styles.aside} data-open={open ? "true" : "false"} style={{ width }}>
      {/* Marca + recolher na mesma linha de 64px. No trilho, o "P" É o botão de expandir (vira a
          seta no hover) — igual ao v2; nada muda de altura ao alternar. */}
      <div className={styles.logoWrap}>
        {open ? (
          <>
            <div className={styles.logoFull}>
              <PontesLogo color="var(--pontes-primary)" size={28} onClick={() => navigate(homePath)} />
            </div>
            {onToggle && (
              <button type="button" className={styles.toggle} aria-label="Recolher menu" title="Recolher menu" onClick={onToggle}>
                <PanelLeftClose size={18} strokeWidth={2} />
              </button>
            )}
          </>
        ) : onToggle ? (
          <button type="button" className={styles.toggleMark} aria-label="Expandir menu" title="Expandir menu" onClick={onToggle}>
            <span className={styles.logoMark}><PontesLogoMark color="var(--pontes-primary)" size={28} /></span>
            <span className={styles.toggleIcone}><PanelLeftOpen size={18} strokeWidth={2} /></span>
          </button>
        ) : (
          <div className={styles.logoMark}>
            <PontesLogoMark color="var(--pontes-primary)" size={28} onClick={() => navigate(homePath)} />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {groups.map((group) => (
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

      {/* Rodapé: avatar (menu com configurações, contas e sair) */}
      {currentUser && (
        <div className={styles.userWrap}>
          {/* Avatar + nome abrem o menu (trocar/adicionar conta, sair); o botão de sair à direita é
              atalho direto e fica FORA do gatilho — some no trilho (lá o menu do avatar resolve). */}
          <div className={styles.userRow}>
            <PontesPopover
              align="left" minWidth={240} direction="up" closeOnMouseLeave
              header={
                <>
                  <span className={styles.menuNome}>{currentUser.nome}</span>
                  <span className={styles.menuEmail}>{currentUser.email}</span>
                </>
              }
              trigger={
                <div className={styles.userTrigger}>
                  <span className={styles.avatar}>{initials}</span>
                  <span className={styles.userInfo}>
                    <span className={styles.userText}>
                      <span className={styles.userName}>{currentUser.nome.trim().split(/\s+/)[0]}</span>
                      <span className={styles.userPlan}>Plano gratuito</span>
                    </span>
                  </span>
                </div>
              }
              items={userItems}
            />
            <button type="button" className={styles.sair} aria-label="Sair" title="Sair" onClick={sair}>
              <LogOut size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      <AddAccountDialog open={addAccountOpen} onClose={() => setAddAccountOpen(false)} />
    </aside>
  )
}
