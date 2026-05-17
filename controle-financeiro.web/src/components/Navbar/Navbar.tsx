import { useLocation } from "react-router-dom"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined"
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined"
import SidebarToggleIcon from "./SidebarToggleIcon"
import HamburgerIcon from "./HamburgerIcon"
import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded"
import CustomButton from "../CustomButton"
import { useThemeContext } from "../../contexts/ThemeContext"
import styles from "./Navbar.module.css"

type Props = {
  toggleDrawer: () => void
  sidebarOpen: boolean
  openTransaction: () => void
  canCreateTransaction: boolean
}

export default function Navbar({ toggleDrawer, sidebarOpen, openTransaction, canCreateTransaction }: Props) {
  const location = useLocation()
  const { mode, toggleMode } = useThemeContext()

  const getTitle = () => {
    switch (location.pathname) {
      case "/": return "Pessoas"
      case "/categories": return "Categorias"
      case "/transactions": return "Transações"
      case "/reports": return "Relatórios"
      case "/bancos": return "Bancos"
      case "/credit-cards": return "Cartões de Crédito"
      case "/settings": return "Configurações"
      default: return "Controle Financeiro"
    }
  }

  return (
    <div className={styles.navbar}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <IconButton size="small" onClick={toggleDrawer} sx={{ color: "var(--text-primary)" }}>
          {sidebarOpen ? (
            <SidebarToggleIcon sx={{ fontSize: 16, color: "var(--text-primary)", transition: "all 0.2s ease" }} />
          ) : (
            <HamburgerIcon sx={{ fontSize: 16, color: "var(--text-primary)", transition: "all 0.2s ease" }} />
          )}
        </IconButton>
        <div className={styles.title}>{getTitle()}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Tooltip title={mode === 'dark' ? 'Modo claro' : 'Modo escuro'}>
          <IconButton size="small" onClick={toggleMode} sx={{ color: "var(--text-primary)" }}>
            {mode === 'dark'
              ? <LightModeOutlinedIcon sx={{ fontSize: 16 }} />
              : <DarkModeOutlinedIcon sx={{ fontSize: 16 }} />
            }
          </IconButton>
        </Tooltip>

        <Tooltip title={canCreateTransaction ? "" : "Cadastre pelo menos uma categoria antes de adicionar transações"}>
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
    </div>
  )
}
