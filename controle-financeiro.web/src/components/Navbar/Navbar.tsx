/**
 * Navbar — barra superior do shell interno (#118). 100% biblioteca Pontes.
 * Cor via var(--pontes-*) (Navbar.module.css).
 */

import { useLocation, useNavigate } from "react-router-dom"
import { PanelLeftClose, PanelLeftOpen, Search, Plus } from "lucide-react"
import { PontesButton, PontesIconButton } from "@/components/pontes"
import NotificationBell from "../Notificacoes/NotificationBell"
import styles from "./Navbar.module.css"

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
  const location = useLocation()
  const navigate = useNavigate()
  const title = resolveTitle(location.pathname)
  const isDashboard = location.pathname === "/dashboard"

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <PontesIconButton variant="ghost" size={40} onClick={toggleDrawer} aria-label={sidebarOpen ? "Recolher menu" : "Expandir menu"}>
          {sidebarOpen ? <PanelLeftClose size={18} strokeWidth={2} /> : <PanelLeftOpen size={18} strokeWidth={2} />}
        </PontesIconButton>
        <div className={styles.titleBox}>
          {!isDashboard && (
            <div className={styles.crumb}>
              <span onClick={() => navigate("/dashboard")} className={styles.crumbHome}>Início</span>
              <span className={styles.crumbSep}> / </span>
              <span className={styles.crumbCur}>{title}</span>
            </div>
          )}
          <h1 className={styles.title}>{title}</h1>
        </div>
      </div>

      <div className={styles.right}>
        <button onClick={openCommandPalette} className={styles.search} aria-label="Buscar">
          <Search size={16} strokeWidth={2} />
          <span className={styles.searchText}>Buscar telas…</span>
          <kbd className={styles.kbd}>Ctrl K</kbd>
        </button>

        <NotificationBell />

        <PontesButton
          variant="accent" size="md"
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
