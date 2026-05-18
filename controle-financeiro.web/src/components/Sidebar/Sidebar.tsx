import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import Menu from "@mui/material/Menu";
import MuiMenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";
import Fade from "@mui/material/Fade";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import SettingsIcon from "@mui/icons-material/Settings";
import HelpIcon from "@mui/icons-material/Help";
import PaletteIcon from "@mui/icons-material/Palette";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CheckIcon from "@mui/icons-material/Check";
import AddIcon from "@mui/icons-material/Add";
import Divider from "@mui/material/Divider";

import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
import RepeatOutlinedIcon from "@mui/icons-material/RepeatOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";

import MenuItem from "./MenuItem";
import AddAccountDialog from "../AddAccountDialog/AddAccountDialog";
import { useAuth } from "../../hooks/useAuth";
import styles from "./Sidebar.module.css";

type SidebarProps = {
  open: boolean;
  drawerWidth: number;
};

function Avatar({ initials, size = 30 }: { initials: string; size?: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        bgcolor: "#111827",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </Box>
  );
}

function getInitials(nome: string) {
  return nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export default function Sidebar({ open, drawerWidth }: SidebarProps) {
  const navigate = useNavigate();
  const { currentUser, savedAccounts, logout, switchAccount } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [accountAnchorEl, setAccountAnchorEl] = useState<null | HTMLElement>(null);
  const [addAccountOpen, setAddAccountOpen] = useState(false);

  const isOverTrigger = useRef(false);
  const isOverSubmenu = useRef(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleLogout = () => {
    closeAll();
    logout();
    navigate("/auth/login");
  };

  const closeAll = () => {
    setAnchorEl(null);
    setAccountAnchorEl(null);
  };

  const scheduleCloseSubmenu = () => {
    clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => {
      if (!isOverTrigger.current && !isOverSubmenu.current) {
        setAccountAnchorEl(null);
      }
    }, 300);
  };

  const handleTriggerMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    isOverTrigger.current = true;
    clearTimeout(hoverTimeout.current);
    setAccountAnchorEl(e.currentTarget);
  };

  const handleTriggerMouseLeave = () => {
    isOverTrigger.current = false;
    scheduleCloseSubmenu();
  };

  const handleSubmenuMouseEnter = () => {
    isOverSubmenu.current = true;
    clearTimeout(hoverTimeout.current);
  };

  const handleSubmenuMouseLeave = () => {
    isOverSubmenu.current = false;
    scheduleCloseSubmenu();
  };

  const handleSwitchAccount = async (accountId: string) => {
    closeAll();
    await switchAccount(accountId);
  };

  const otherAccounts = savedAccounts.filter(a => a.id !== currentUser?.id);
  const initials = currentUser?.nome ? getInitials(currentUser.nome) : "?";

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
              to="/dashboard"
              label="Dashboard"
              icon={<DashboardOutlinedIcon sx={{ fontSize: 18 }} />}
            />
            <MenuItem
              to="/transactions"
              label="Transações"
              icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 18 }} />}
            />
            <MenuItem
              to="/credit-cards"
              label="Cartões de Crédito"
              icon={<CreditCardOutlinedIcon sx={{ fontSize: 18 }} />}
            />
            <MenuItem
              to="/reports"
              label="Relatórios"
              icon={<BarChartOutlinedIcon sx={{ fontSize: 18 }} />}
            />
            <MenuItem
              to="/transferencias"
              label="Transferências"
              icon={<SwapHorizOutlinedIcon sx={{ fontSize: 18 }} />}
            />
            <MenuItem
              to="/assinaturas"
              label="Assinaturas"
              icon={<RepeatOutlinedIcon sx={{ fontSize: 18 }} />}
            />
            <MenuItem
              to="/parcelamentos"
              label="Parcelamentos"
              icon={<CheckIcon sx={{ fontSize: 18 }} />}
            />
            <MenuItem
              to="/emprestimos"
              label="Empréstimos"
              icon={<HandshakeOutlinedIcon sx={{ fontSize: 18 }} />}
            />
            <MenuItem
              to="/importacao"
              label="Importar Extrato"
              icon={<UploadFileOutlinedIcon sx={{ fontSize: 18 }} />}
            />
          </List>

          <div className={styles.sectionTitle}>Gerenciamento</div>
          <List>
            <MenuItem
              to="/accounts"
              label="Contas"
              icon={<AccountBalanceOutlinedIcon sx={{ fontSize: 18 }} />}
            />
            <MenuItem
              to="/categories"
              label="Categorias"
              icon={<CategoryOutlinedIcon sx={{ fontSize: 18 }} />}
            />
            <MenuItem
              to="/familias"
              label="Famílias"
              icon={<GroupsOutlinedIcon sx={{ fontSize: 18 }} />}
            />
          </List>
        </div>

        {currentUser && (
          <div className={styles.userSection}>
            {/* Sidebar trigger */}
            <div
              className={styles.userInfo}
              onClick={(e) => setAnchorEl(e.currentTarget)}
            >
              <div className={styles.avatar}>{initials}</div>
              <div style={{ minWidth: 0 }}>
                <div className={styles.userName}>{currentUser.nome}</div>
                <div className={styles.userEmail}>Plano Free</div>
              </div>
            </div>

            {/* Main menu */}
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={closeAll}
              anchorOrigin={{ vertical: "top", horizontal: "center" }}
              transformOrigin={{ vertical: "bottom", horizontal: "center" }}
              PaperProps={{
                sx: {
                  minWidth: "240px",
                  borderRadius: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  mb: 1,
                },
              }}
            >
              {/* User card — hover opens accounts Popper */}
              <MuiMenuItem
                onMouseEnter={handleTriggerMouseEnter}
                onMouseLeave={handleTriggerMouseLeave}
                sx={{ py: 1, px: 1.5, borderRadius: "8px", mx: 0.5, mt: 0.5 }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%" }}>
                  <Avatar initials={initials} size={34} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontSize={13} fontWeight={600} color="#111827" noWrap>
                      {currentUser.nome}
                    </Typography>
                    <Typography fontSize={11} color="#6b7280" noWrap>
                      Plano Free
                    </Typography>
                  </Box>
                  <ChevronRightIcon sx={{ fontSize: 14, color: "#9ca3af", flexShrink: 0 }} />
                </Box>
              </MuiMenuItem>

              <Divider sx={{ my: 0.5 }} />

              {/* Upgrade de plano */}
              <MuiMenuItem onClick={closeAll} sx={{ fontSize: 13, py: 0.8, px: 1.5 }}>
                <TrendingUpIcon sx={{ fontSize: 16, mr: 1.5, color: "#6b7280" }} />
                Upgrade de plano
              </MuiMenuItem>

              <MuiMenuItem onClick={closeAll} sx={{ fontSize: 13, py: 0.8, px: 1.5 }}>
                <PaletteIcon sx={{ fontSize: 16, mr: 1.5, color: "#6b7280" }} />
                Personalização
              </MuiMenuItem>
              <MuiMenuItem onClick={closeAll} sx={{ fontSize: 13, py: 0.8, px: 1.5 }}>
                <PersonIcon sx={{ fontSize: 16, mr: 1.5, color: "#6b7280" }} />
                Perfil
              </MuiMenuItem>
              <MuiMenuItem
                onClick={() => { closeAll(); navigate("/settings"); }}
                sx={{ fontSize: 13, py: 0.8, px: 1.5 }}
              >
                <SettingsIcon sx={{ fontSize: 16, mr: 1.5, color: "#6b7280" }} />
                Configurações
              </MuiMenuItem>
              <MuiMenuItem onClick={closeAll} sx={{ fontSize: 13, py: 0.8, px: 1.5 }}>
                <HelpIcon sx={{ fontSize: 16, mr: 1.5, color: "#6b7280" }} />
                Ajuda
              </MuiMenuItem>
              <Divider sx={{ my: 0.5 }} />
              <MuiMenuItem
                onClick={handleLogout}
                sx={{ color: "#ef4444", fontSize: 13, py: 0.8, px: 1.5, mb: 0.5 }}
              >
                <LogoutIcon sx={{ fontSize: 16, mr: 1.5 }} />
                Sair
              </MuiMenuItem>
            </Menu>

            {/* Accounts cascade — Popper (no backdrop, no flicker) */}
            <Popper
              open={Boolean(accountAnchorEl)}
              anchorEl={accountAnchorEl}
              placement="right-start"
              transition
              style={{ zIndex: 1302 }}
            >
              {({ TransitionProps }) => (
                <Fade {...TransitionProps} timeout={120}>
                  <Paper
                    onMouseEnter={handleSubmenuMouseEnter}
                    onMouseLeave={handleSubmenuMouseLeave}
                    elevation={3}
                    sx={{
                      minWidth: "220px",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      ml: 0.5,
                      overflow: "hidden",
                    }}
                  >
                    {/* Email identifier */}
                    <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid #f3f4f6" }}>
                      <Typography fontSize={12} color="#6b7280" noWrap>
                        {currentUser.email}
                      </Typography>
                    </Box>

                    <MenuList dense sx={{ py: 0.5 }}>
                      {/* Current account */}
                      <MuiMenuItem sx={{ py: 1, px: 1.5, cursor: "default", "&:hover": { bgcolor: "transparent" } }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%" }}>
                          <Avatar initials={initials} size={28} />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography fontSize={13} fontWeight={600} color="#111827" noWrap>
                              {currentUser.nome}
                            </Typography>
                          </Box>
                          <CheckIcon sx={{ fontSize: 14, color: "#6b7280", flexShrink: 0 }} />
                        </Box>
                      </MuiMenuItem>

                      {/* Other connected accounts */}
                      {otherAccounts.map(account => (
                        <MuiMenuItem
                          key={account.id}
                          onClick={() => handleSwitchAccount(account.id)}
                          sx={{ py: 1, px: 1.5 }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%" }}>
                            <Avatar initials={getInitials(account.nome)} size={28} />
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography fontSize={13} fontWeight={500} color="#111827" noWrap>
                                {account.nome}
                              </Typography>
                              <Typography fontSize={11} color="#9ca3af" noWrap>
                                {account.email}
                              </Typography>
                            </Box>
                          </Box>
                        </MuiMenuItem>
                      ))}

                      <Divider sx={{ my: 0.5 }} />

                      {/* Add account */}
                      <MuiMenuItem
                        onClick={() => { closeAll(); setAddAccountOpen(true); }}
                        sx={{ fontSize: 13, color: "#374151", py: 0.8, px: 1.5 }}
                      >
                        <AddIcon sx={{ fontSize: 16, mr: 1.5, color: "#6b7280" }} />
                        Adicionar conta
                      </MuiMenuItem>
                    </MenuList>
                  </Paper>
                </Fade>
              )}
            </Popper>
          </div>
        )}
      </div>

      <AddAccountDialog
        open={addAccountOpen}
        onClose={() => setAddAccountOpen(false)}
      />
    </Drawer>
  );
}
