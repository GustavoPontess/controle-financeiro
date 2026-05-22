import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { PontesThemeProvider } from "../../components/pontes"
import Sidebar from "../../components/Sidebar/Sidebar"
import Navbar from "../../components/Navbar/Navbar"

// Mocks de dependências externas do shell.
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: { id: "u1", nome: "Gabriel Dev", email: "dev@controle.test" },
    savedAccounts: [],
    logout: vi.fn(),
    switchAccount: vi.fn(),
    accountKey: "u1",
  }),
}))
vi.mock("../../components/Notificacoes/NotificationBell", () => ({ default: () => <div data-testid="bell" /> }))
vi.mock("../../components/AddAccountDialog/AddAccountDialog", () => ({ default: () => null }))

function withProviders(ui: React.ReactNode, path = "/dashboard") {
  return render(
    <PontesThemeProvider>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </PontesThemeProvider>
  )
}

describe("Shell interno (#118)", () => {
  it("Sidebar mostra a marca Pontes, não o nome legado FinanceControl", () => {
    withProviders(<Sidebar open drawerWidth={248} railWidth={72} />)
    expect(screen.queryByText("FinanceControl")).not.toBeInTheDocument()
  })

  it("Sidebar lista os itens de navegação", () => {
    withProviders(<Sidebar open drawerWidth={248} railWidth={72} />)
    for (const item of ["Dashboard", "Transações", "Cartões de Crédito", "Contas", "Categorias", "Famílias"]) {
      expect(screen.getByText(item)).toBeInTheDocument()
    }
  })

  it("Sidebar mostra o card de usuário", () => {
    withProviders(<Sidebar open drawerWidth={248} railWidth={72} />)
    expect(screen.getByText("Gabriel Dev")).toBeInTheDocument()
    expect(screen.getByText("Plano Free")).toBeInTheDocument()
  })

  it("Navbar mostra o título da rota atual", () => {
    withProviders(
      <Navbar toggleDrawer={() => {}} sidebarOpen openTransaction={() => {}} canCreateTransaction openCommandPalette={() => {}} />,
      "/transactions"
    )
    expect(screen.getByRole("heading", { name: "Transações" })).toBeInTheDocument()
  })

  it("Navbar abre o command palette pelo botão de busca", () => {
    const openCmd = vi.fn()
    withProviders(
      <Navbar toggleDrawer={() => {}} sidebarOpen openTransaction={() => {}} canCreateTransaction openCommandPalette={openCmd} />
    )
    fireEvent.click(screen.getByLabelText("Buscar"))
    expect(openCmd).toHaveBeenCalledOnce()
  })

  it("Navbar desabilita Nova transação sem categorias", () => {
    withProviders(
      <Navbar toggleDrawer={() => {}} sidebarOpen openTransaction={() => {}} canCreateTransaction={false} openCommandPalette={() => {}} />
    )
    expect(screen.getByRole("button", { name: /Nova transação/i })).toBeDisabled()
  })
})
