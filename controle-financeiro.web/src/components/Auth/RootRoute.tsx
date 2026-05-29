/**
 * RootRoute — decide o que renderizar em `/`:
 * - Não autenticado → HomePage (landing pública)
 * - Autenticado     → redirect pra `/dashboard`
 *
 * Issue #75 — `/` vira root público com fallback Dashboard quando autenticado.
 */

import { Navigate } from "react-router-dom"
import { PontesLoadingDots } from "@/components/pontes"
import { useAuth } from "../../hooks/useAuth"
import HomePage from "../../pages/Site/HomePage"
import SiteLayout from "../../pages/Site/SiteLayout"

export default function RootRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <PontesLoadingDots />
      </div>
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
