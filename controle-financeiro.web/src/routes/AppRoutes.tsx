import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"

import DefaultLayout from "../layouts/Default/DefaultLayout"
import ProtectedRoute from "../components/Auth/ProtectedRoute"
import RootRoute from "../components/Auth/RootRoute"

import LoginPage from "../pages/Auth/LoginPage"
import RegisterPage from "../pages/Auth/RegisterPage"

import CategoriesPage from "../pages/Categories/CategoriesPage"
import TransactionsPage from "../pages/Transactions/TransactionsPage"
import CreditCardsPage from "../pages/CreditCards/CreditCardsPage"
import SettingsPage from "../pages/Settings/SettingsPage"
import DashboardPage from "../pages/Dashboard/DashboardPage"
import ReportsPage from "../pages/Reports/ReportsPage"
import TransferenciasPage from "../pages/Transferencias/TransferenciasPage"
import RecorrentesPage from "../pages/Recorrentes/RecorrentesPage"
import ParcelamentosPage from "../pages/Parcelamentos"
import ParcelamentoDetalhePage from "../pages/Parcelamentos/[id]"
import EmprestimosPage from "../pages/Emprestimos/EmprestimosPage"
import AccountsPage from "../pages/Accounts/AccountsPage"
import FamiliasPage from "../pages/Familia/FamiliasPage"
import ImportacaoPage from "../pages/Importacao/ImportacaoPage"
import OnboardingPage from "../pages/Onboarding/OnboardingPage"
import HomePage from "../pages/Site/HomePage"
import SiteLayout from "../pages/Site/SiteLayout"
import LogoConcepts from "../pages/Site/LogoConcepts"
import DesignSystemPage from "../pages/DesignSystem/DesignSystemPage"

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root: RootRoute decide ANTES de montar o site (logado → dashboard
            sem flash; deslogado → SiteLayout + Home via children). */}
        <Route path="/" element={<RootRoute />} />

        {/* Site público — shell compartilhado (navbar + footer + control bar dev) */}
        <Route element={<SiteLayout />}>
          <Route path="/site" element={<HomePage />} />
        </Route>

        {/* Auth Routes */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />

        {/* Páginas públicas com chrome próprio */}
        <Route path="/logo-concepts" element={<LogoConcepts />} />
        <Route path="/design-system" element={<DesignSystemPage />} />

        {/* Onboarding — protegido, em tela cheia (sem o layout padrão) */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />

        {/* Protected Routes */}
        <Route
          element={
            <ProtectedRoute>
              <DefaultLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/credit-cards" element={<CreditCardsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/transferencias" element={<TransferenciasPage />} />
          <Route path="/assinaturas" element={<RecorrentesPage />} />
          <Route path="/parcelamentos" element={<ParcelamentosPage />} />
          <Route path="/parcelamentos/:id" element={<ParcelamentoDetalhePage />} />
          <Route path="/emprestimos" element={<EmprestimosPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/familias" element={<FamiliasPage />} />
          <Route path="/importacao" element={<ImportacaoPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback — qualquer rota inexistente vai pra root (que decide HomePage ou Dashboard) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}