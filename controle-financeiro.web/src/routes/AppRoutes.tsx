import { BrowserRouter, Routes, Route } from "react-router-dom"

import DefaultLayout from "../layouts/Default/DefaultLayout"

import PeoplePage from "../pages/People/PeoplePage"
import CategoriesPage from "../pages/Categories/CategoriesPage"
import TransactionsPage from "../pages/Transactions/TransactionsPage"
import ReportsPage from "../pages/Reports/ReportsPage"
import BancosPage from "../pages/Bancos/BancosPage"
import CreditCardsPage from "../pages/CreditCards/CreditCardsPage"

export default function AppRoutes() {

  return (

    <BrowserRouter>

      <Routes>

        <Route element={<DefaultLayout />}>

          <Route path="/" element={<PeoplePage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/bancos" element={<BancosPage />} />
          <Route path="/credit-cards" element={<CreditCardsPage />} />

        </Route>

      </Routes>

    </BrowserRouter>

  )

}