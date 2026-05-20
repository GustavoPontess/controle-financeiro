import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import RootRoute from "../../components/Auth/RootRoute"

// Mock pages renderizados pelo RootRoute pra isolar comportamento
vi.mock("../../pages/Site/HomePage", () => ({
  default: () => <div data-testid="home-page">HomePage</div>,
}))

vi.mock("../../pages/Dashboard/DashboardPage", () => ({
  default: () => <div data-testid="dashboard-page">DashboardPage</div>,
}))

// Mock auth controlável
type AuthState = { isAuthenticated: boolean; isLoading: boolean }
let currentAuth: AuthState = { isAuthenticated: false, isLoading: false }

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => currentAuth,
}))

function renderRoot() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/dashboard" element={<div data-testid="dashboard-redirect">Dashboard route</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe("RootRoute (#75)", () => {
  it("mostra HomePage quando deslogado", () => {
    currentAuth = { isAuthenticated: false, isLoading: false }
    renderRoot()
    expect(screen.getByTestId("home-page")).toBeInTheDocument()
  })

  it("redireciona pra /dashboard quando autenticado", () => {
    currentAuth = { isAuthenticated: true, isLoading: false }
    renderRoot()
    expect(screen.getByTestId("dashboard-redirect")).toBeInTheDocument()
  })

  it("mostra spinner enquanto carrega estado de auth", () => {
    currentAuth = { isAuthenticated: false, isLoading: true }
    const { container } = renderRoot()
    expect(container.querySelector(".MuiCircularProgress-root")).toBeTruthy()
    expect(screen.queryByTestId("home-page")).not.toBeInTheDocument()
  })
})
