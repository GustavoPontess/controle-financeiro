import { useLocation } from "react-router-dom"

import IconButton from "@mui/material/IconButton"
import MenuIcon from "@mui/icons-material/Menu"
import Button from "@mui/material/Button"
import Tooltip from "@mui/material/Tooltip"

import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded"

import styles from "./Navbar.module.css"

type Props = {
  toggleDrawer: () => void
  openTransaction: () => void
  canCreateTransaction: boolean
}

export default function Navbar({
  toggleDrawer,
  openTransaction,
  canCreateTransaction
}: Props) {

  const location = useLocation()

  const getTitle = () => {

    switch (location.pathname) {
      case "/":
        return "Pessoas"
      case "/categories":
        return "Categorias"
      case "/transactions":
        return "Transações"
      case "/reports":
        return "Relatórios"
      default:
        return "Controle Financeiro"
    }

  }

  return (

    <div className={styles.navbar}>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

        <IconButton onClick={toggleDrawer}>
          <MenuIcon />
        </IconButton>

        <div className={styles.title}>
          {getTitle()}
        </div>

      </div>

      <Tooltip
        title={
          canCreateTransaction
            ? ""
            : "Cadastre pelo menos uma pessoa e uma categoria"
        }
      >

        <span>

          <Button
            variant="contained"
            startIcon={<AddCircleOutlineRoundedIcon />}
            onClick={openTransaction}
            disabled={!canCreateTransaction}
            sx={{
              backgroundColor: "#111827",
              "&:hover": {
                backgroundColor: "#1f2937"
              },
              borderRadius: "10px"
            }}
          >
            Nova Transação
          </Button>

        </span>

      </Tooltip>

    </div>

  )

}