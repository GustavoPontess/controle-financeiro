import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import Menu from "@mui/material/Menu";
import MuiMenuItem from "@mui/material/MenuItem";
import LogoutIcon from "@mui/icons-material/Logout";

import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";

import MenuItem from "./MenuItem";
import { useAuth } from "../../hooks/useAuth";
import styles from "./Sidebar.module.css";

type SidebarProps = {
  open: boolean;
  drawerWidth: number;
};

export default function Sidebar({ open, drawerWidth }: SidebarProps) {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleLogout = () => {
    setAnchorEl(null);
    logout();
    navigate("/auth/login");
  };

  const initials = currentUser?.nome
    ? currentUser.nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={open}
      sx={{
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          background: "#f5f6fa",
          borderRight: 0,
        },
      }}
    >
      <div className={styles.sidebar}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <AccountBalanceIcon sx={{ fontSize: 14 }} />
          </div>
          <div>
            <div className={styles.title}>FinanceControl</div>
            <div className={styles.subtitle}>Gestão Financeira</div>
          </div>
        </div>

        <div className={styles.nav}>
          <div className={styles.sectionTitle}>Principal</div>
          <List>
            <MenuItem
              to="/transactions"
              label="Transações"
              icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 18 }} />}
            />
            <MenuItem
              to="/bancos"
              label="Bancos"
              icon={<AccountBalanceIcon sx={{ fontSize: 18 }} />}
            />
            <MenuItem
              to="/credit-cards"
              label="Cartões de Crédito"
              icon={<CreditCardOutlinedIcon sx={{ fontSize: 18 }} />}
            />
            <MenuItem
              to="/import"
              label="Importar Excel"
              icon={<UploadFileOutlinedIcon sx={{ fontSize: 18 }} />}
              disabled
            />
          </List>

          <div className={styles.sectionTitle}>Gerenciamento</div>
          <List>
            <MenuItem
              to="/categories"
              label="Categorias"
              icon={<CategoryOutlinedIcon sx={{ fontSize: 18 }} />}
            />
          </List>

          <div className={styles.sectionTitle}>Configurações</div>
          <List>
            <MenuItem
              to="/settings"
              label="Configurações"
              icon={<SettingsOutlinedIcon sx={{ fontSize: 18 }} />}
              disabled
            />
          </List>
        </div>

        {currentUser && (
          <div className={styles.userSection}>
            <div
              className={styles.userInfo}
              onClick={(e) => setAnchorEl(e.currentTarget)}
            >
              <div className={styles.avatar}>{initials}</div>
              <div style={{ minWidth: 0 }}>
                <div className={styles.userName}>{currentUser.nome}</div>
                <div className={styles.userEmail}>{currentUser.email}</div>
              </div>
            </div>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              anchorOrigin={{ vertical: "top", horizontal: "right" }}
              transformOrigin={{ vertical: "bottom", horizontal: "left" }}
            >
              <MuiMenuItem onClick={handleLogout} sx={{ color: "#ef4444", fontSize: 13 }}>
                <LogoutIcon sx={{ fontSize: 16, mr: 1 }} />
                Sair
              </MuiMenuItem>
            </Menu>
          </div>
        )}
      </div>
    </Drawer>
  );
}
