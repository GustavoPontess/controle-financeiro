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
import EmprestimosLabA from "../pages/Emprestimos/EmprestimosLabA"
import EmprestimosLabB from "../pages/Emprestimos/EmprestimosLabB"
import EmprestimosLabC from "../pages/Emprestimos/EmprestimosLabC"
import EmprestimosLabD from "../pages/Emprestimos/EmprestimosLabD"
import AccountsPage from "../pages/Accounts/AccountsPage"
import FamiliasPage from "../pages/Familia/FamiliasPage"
import FamiliaDetalhePage from "../pages/Familia/FamiliaDetalhePage"
import MetasPage from "../pages/Metas/MetasPage"
import LimitesPage from "../pages/Limites/LimitesPage"
import ImportacaoPage from "../pages/Importacao/ImportacaoPage"
import OnboardingPage from "../pages/Onboarding/OnboardingPage"
import AdminPage from "../pages/Admin/AdminPage"
import SiteLayout from "../pages/Site/SiteLayout"
import CouplesPage from "../pages/Site/CouplesPage"
import ContadoresPage from "../pages/Site/ContadoresPage"
import RecursosPage from "../pages/Site/RecursosPage"
import SobrePage from "../pages/Site/SobrePage"
import ConviteEmprestimoPage from "../pages/Convite/ConviteEmprestimoPage"
import PrivacidadePage from "../pages/Site/PrivacidadePage"
import TermosDeUsoPage from "../pages/Site/TermosDeUsoPage"
import DesignSystemPage from "../pages/DesignSystem/DesignSystemPage"

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root: RootRoute decide ANTES de montar o site (logado → dashboard
            sem flash; deslogado → SiteLayout + Home via children). */}
        <Route path="/" element={<RootRoute />} />

        {/* Verticais públicas (Casais, Contadores, Recursos, Sobre) sob
            <SiteLayout> — URLs limpas /casais, /contadores, etc. */}
        <Route element={<SiteLayout />}>
          <Route path="/casais" element={<CouplesPage />} />
          <Route path="/contadores" element={<ContadoresPage />} />
          <Route path="/recursos" element={<RecursosPage />} />
          <Route path="/sobre" element={<SobrePage />} />
          <Route path="/convite/emprestimo/:token" element={<ConviteEmprestimoPage />} />
          <Route path="/privacidade" element={<PrivacidadePage />} />
          <Route path="/termos-de-uso" element={<TermosDeUsoPage />} />
        </Route>

        {/* Auth Routes */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />

        {/* Páginas públicas com chrome próprio — só em DEV, não devem ir pro build de produção
            (achado do sweep pré-beta, 2026-08-18: eram públicas sem gate nenhum). */}
        {import.meta.env.DEV && (
          <Route path="/design-system" element={<DesignSystemPage />} />
        )}

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
          {/* Bancada de comparação de layout — nunca vai pro beta/prod, só DEV local. */}
          {import.meta.env.DEV && (
            <>
              <Route path="/emprestimos-lab-a" element={<EmprestimosLabA />} />
              <Route path="/emprestimos-lab-b" element={<EmprestimosLabB />} />
              <Route path="/emprestimos-lab-c" element={<EmprestimosLabC />} />
              <Route path="/emprestimos-lab-d" element={<EmprestimosLabD />} />
            </>
          )}
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/familias" element={<FamiliasPage />} />
          <Route path="/familias/:id" element={<FamiliaDetalhePage />} />
          <Route path="/metas" element={<MetasPage />} />
          <Route path="/limites" element={<LimitesPage />} />
          <Route path="/importacao" element={<ImportacaoPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* Admin — a própria página confirma IsAdmin no backend (GET /admin/me);
              não-admin vê "sem acesso". Endpoints ficam sob a policy IsAdmin. */}
          <Route path="/admin" element={<AdminPage />} />
        </Route>

        {/* Fallback — qualquer rota inexistente vai pra root (que decide HomePage ou Dashboard) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}