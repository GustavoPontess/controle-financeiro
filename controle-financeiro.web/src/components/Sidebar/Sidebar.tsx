import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";

import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PeopleOutlineOutlinedIcon from "@mui/icons-material/PeopleOutlineOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";

import MenuItem from "./MenuItem";
import styles from "./Sidebar.module.css";

type SidebarProps = {
  open: boolean;
  drawerWidth: number;
};

export default function Sidebar({ open, drawerWidth }: SidebarProps) {
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
            to="/"
            label="Pessoas"
            icon={<PeopleOutlineOutlinedIcon sx={{ fontSize: 18 }} />}
          />
          <MenuItem
            to="/categories"
            label="Categorias"
            icon={<CategoryOutlinedIcon sx={{ fontSize: 18 }} />}
          />
          <MenuItem
            to="/reports"
            label="Relatórios"
            icon={<AssessmentOutlinedIcon sx={{ fontSize: 18 }} />}
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
    </Drawer>
  );
}
