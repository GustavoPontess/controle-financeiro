import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"

import DefaultLayout from "../layouts/Default/DefaultLayout"
import ProtectedRoute from "../components/Auth/ProtectedRoute"

import LoginPage from "../pages/Auth/LoginPage"
import RegisterPage from "../pages/Auth/RegisterPage"

import CategoriesPage from "../pages/Categories/CategoriesPage"
import TransactionsPage from "../pages/Transactions/TransactionsPage"
import BancosPage from "../pages/Bancos/BancosPage"
import CreditCardsPage from "../pages/CreditCards/CreditCardsPage"

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
          <Route path="/" element={<TransactionsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/bancos" element={<BancosPage />} />
          <Route path="/credit-cards" element={<CreditCardsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}