import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"

import DefaultLayout from "../layouts/Default/DefaultLayout"
import ProtectedRoute from "../components/Auth/ProtectedRoute"

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
import EmprestimosPage from "../pages/Emprestimos/EmprestimosPage"
import AccountsPage from "../pages/Accounts/AccountsPage"
import DesignSystemShowcase from "../pages/DesignSystem/DesignSystemShowcase"

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />

        {/* Protected Routes */}
        <Route
          element={
            <ProtectedRoute>
              <DefaultLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/credit-cards" element={<CreditCardsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/transferencias" element={<TransferenciasPage />} />
          <Route path="/assinaturas" element={<RecorrentesPage />} />
          <Route path="/emprestimos" element={<EmprestimosPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/design-system" element={<DesignSystemShowcase />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}