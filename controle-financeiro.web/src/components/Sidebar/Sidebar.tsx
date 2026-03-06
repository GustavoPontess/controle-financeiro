import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";


import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import PeopleOutlineOutlinedIcon from "@mui/icons-material/PeopleOutlineOutlined";
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

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
            <AccountBalanceIcon sx={{ fontSize: 18 }} />
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
            icon={<HomeOutlinedIcon sx={{ fontSize: 18 }} />}
          />

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
          />
        </List>
      </div>
    </Drawer>
  );
}
