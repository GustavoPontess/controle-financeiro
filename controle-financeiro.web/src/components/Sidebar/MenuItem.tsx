import { Link, useLocation } from "react-router-dom"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import styles from "./Sidebar.module.css"

type MenuItemProps = {
  to: string
  label: string
  icon: React.ReactNode
  disabled?: boolean
}

export default function MenuItem({ to, label, icon, disabled }: MenuItemProps) {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <ListItemButton
      component={Link}
      to={to}
      className={`${styles.menuItem} ${isActive ? styles.active : ""} ${disabled ? styles.disabled : ""}`}
      sx={{ py: "5px", px: "10px" }}
    >
      <ListItemIcon className={styles.icon} sx={{ color: "var(--text-primary)", minWidth: 28 }}>
        {icon}
      </ListItemIcon>
      <ListItemText
        primary={label}
        slotProps={{
          primary: {
            fontSize: 13,
            fontWeight: isActive ? 600 : 400,
            color: "var(--text-primary)",
            lineHeight: 1.2,
          },
        }}
      />
    </ListItemButton>
  )
}
