import { Link, useLocation } from "react-router-dom"

import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"

import styles from "./Sidebar.module.css"

type MenuItemProps = {
  to: string
  label: string
  icon: React.ReactNode
}

export default function MenuItem({ to, label, icon }: MenuItemProps) {

  const location = useLocation()

  const isActive = location.pathname === to

  return (

    <ListItemButton
      component={Link}
      to={to}
      className={`${styles.menuItem} ${isActive ? styles.active : ""}`}
    >

      <ListItemIcon className={styles.icon}>
        {icon}
      </ListItemIcon>

      <ListItemText
        primary={label}
        primaryTypographyProps={{
          fontSize: 14,
          fontWeight: 500
        }}
      />

    </ListItemButton>

  )

}