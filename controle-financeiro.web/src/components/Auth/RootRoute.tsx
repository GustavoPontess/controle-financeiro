/**
 * RootRoute — decide o que renderizar em `/`:
 * - Não autenticado → HomePage (landing pública)
 * - Autenticado     → redirect pra `/dashboard`
 *
 * Issue #75 — `/` vira root público com fallback Dashboard quando autenticado.
 */

import { Box, CircularProgress } from "@mui/material"
import { Navigate } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"
import HomePage from "../../pages/Site/HomePage"
import SiteLayout from "../../pages/Site/SiteLayout"

export default function RootRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    )
  }

  // Logado → redirect ANTES de montar o site (sem flash do shell).
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  // Deslogado → site completo (layout + Home) via children.
  return (
    <SiteLayout>
      <HomePage />
    </SiteLayout>
  )
}
