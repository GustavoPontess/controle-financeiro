import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";

import Navbar from "../../components/Navbar/Navbar";
import Sidebar from "../../components/Sidebar/Sidebar";

import NewTransactionDialog from "../../components/transactions/NewTransactionDialog/NewTransactionDialog";

import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

import { getCategories } from "../../services/categoryService";

import styles from "./DefaultLayout.module.css";

const drawerWidth = 240;

type Notification = {
  open: boolean;
  message: string;
  severity: "success" | "error";
};

export default function DefaultLayout() {
  const [open, setOpen] = useState(true);
  const [openTransaction, setOpenTransaction] = useState(false);

  const [canCreateTransaction, setCanCreateTransaction] = useState(false);

  const [notification, setNotification] = useState<Notification>({
    open: false,
    message: "",
    severity: "success",
  });

  const toggleDrawer = () => {
    setOpen(!open);
  };

  const checkRequirements = async () => {
    const categories = await getCategories();
    setCanCreateTransaction(categories.length > 0);
  };

  useEffect(() => {
    const loadRequirements = async () => {
      const categories = await getCategories();
      setCanCreateTransaction(categories.length > 0);
    };

    loadRequirements();
  }, []);
  return (
    <div className={styles.layout}>
      <Sidebar open={open} drawerWidth={drawerWidth} />

      <div
        className={styles.container}
        style={{ marginLeft: open ? drawerWidth : 0 }}
      >
        <Navbar
          toggleDrawer={toggleDrawer}
          sidebarOpen={open}
          openTransaction={() => setOpenTransaction(true)}
          canCreateTransaction={canCreateTransaction}
        />

        <main className={styles.content}>
          <Outlet
            context={{
              notify: setNotification,
              refreshTransactionRequirements: checkRequirements,
            }}
          />
        </main>
      </div>

      <NewTransactionDialog
        open={openTransaction}
        onClose={() => setOpenTransaction(false)}
        notify={setNotification}
      />

      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        onClose={(_event, reason) => {
          if (reason === "clickaway") return;
          setNotification((prev) => ({ ...prev, open: false }));
        }}
      >
        <Alert
          severity={notification.severity}
          variant="filled"
          onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
          sx={{ width: "100%" }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
