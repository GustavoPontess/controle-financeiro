import { useLocation } from "react-router-dom"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import SidebarToggleIcon from "./SidebarToggleIcon"
import HamburgerIcon from "./HamburgerIcon"
import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded"
import CustomButton from "../CustomButton"
import styles from "./Navbar.module.css"

type Props = {
  toggleDrawer: () => void
  sidebarOpen: boolean
  openTransaction: () => void
  canCreateTransaction: boolean
}

export default function Navbar({ toggleDrawer, sidebarOpen, openTransaction, canCreateTransaction }: Props) {
  const location = useLocation()

  const getTitle = () => {
    switch (location.pathname) {
      case "/": return "Pessoas"
      case "/categories": return "Categorias"
      case "/transactions": return "Transações"
      case "/reports": return "Relatórios"
      default: return "Controle Financeiro"
    }
  }

  return (
    <div className={styles.navbar}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <IconButton size="small" onClick={toggleDrawer} sx={{ color: "#111827" }}>
          {sidebarOpen ? (
            <SidebarToggleIcon sx={{ fontSize: 16, color: "#111827", transition: "all 0.2s ease" }} />
          ) : (
            <HamburgerIcon sx={{ fontSize: 16, color: "#111827", transition: "all 0.2s ease" }} />
          )}
        </IconButton>
        <div className={styles.title}>{getTitle()}</div>
      </div>

      <Tooltip title={canCreateTransaction ? "" : "Cadastre pelo menos uma pessoa e uma categoria"}>
        <span>
          <CustomButton
            size="small"
            startIcon={<AddCircleOutlineRoundedIcon sx={{ fontSize: 14 }} />}
            onClick={openTransaction}
            disabled={!canCreateTransaction}
          >
            Nova Transação
          </CustomButton>
        </span>
      </Tooltip>
    </div>
  )
}
