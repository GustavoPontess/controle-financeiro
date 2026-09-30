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
    for (const item of ["Dashboard", "Transações", "Cartões de Crédito", "Bancos", "Categorias", "Famílias"]) {
      expect(screen.getByText(item)).toBeInTheDocument()
    }
  })

  it("Sidebar mostra o card de usuário compacto (só o 1º nome + plano Free)", () => {
    withProviders(<Sidebar open drawerWidth={208} railWidth={64} />)
    expect(screen.getByText("Gabriel")).toBeInTheDocument()
    expect(screen.queryByText("Gabriel Dev")).not.toBeInTheDocument()
    expect(screen.getByText("Free")).toBeInTheDocument()
  })

  it("Sidebar não lista mais Transferências nem Demo Transações (o extrato em Transações cobre)", () => {
    withProviders(<Sidebar open drawerWidth={208} railWidth={64} />)
    expect(screen.getByText("Transações")).toBeInTheDocument()
    expect(screen.queryByText("Transferências")).not.toBeInTheDocument()
    expect(screen.queryByText("Demo Transações")).not.toBeInTheDocument()
  })

  it("Navbar mostra o título da rota atual", () => {
    withProviders(
      <Navbar toggleDrawer={() => {}} sidebarOpen openTransaction={() => {}} canCreateTransaction openCommandPalette={() => {}} />,
      "/transactions"
    )
    expect(screen.getByRole("heading", { name: "Transações" })).toBeInTheDocument()
  })

  it("Navbar no detalhe: Início / Cartões de Crédito / Parcelamentos / <item>, níveis de cima clicáveis", () => {
    withProviders(
      <Navbar toggleDrawer={() => {}} sidebarOpen openTransaction={() => {}} canCreateTransaction openCommandPalette={() => {}}
        detalhe="Fone Teste" />,
      "/credit-cards/parcelamentos/abc"
    )
    expect(screen.getByText("Fone Teste")).toBeInTheDocument()
    // Prefixo mais longo vence: é Parcelamentos (dentro de Cartões), não Cartões.
    expect(screen.getByRole("heading", { name: "Parcelamentos" })).toBeInTheDocument()
    expect(screen.getByText("Cartões de Crédito")).toBeInTheDocument()
    // "Parcelamentos" aparece 2x: link no caminho + título da página.
    expect(screen.getAllByText("Parcelamentos")).toHaveLength(2)
  })

  it("Navbar na lista de parcelamentos: caminho com a seção-pai Cartões de Crédito", () => {
    withProviders(
      <Navbar toggleDrawer={() => {}} sidebarOpen openTransaction={() => {}} canCreateTransaction openCommandPalette={() => {}} />,
      "/credit-cards/parcelamentos"
    )
    expect(screen.getByText("Cartões de Crédito")).toBeInTheDocument()
    expect(screen.getAllByText("Parcelamentos")).toHaveLength(2) // caminho (atual) + título
  })

  it("Navbar no detalhe de empréstimo: Início / Empréstimos / <item>", () => {
    withProviders(
      <Navbar toggleDrawer={() => {}} sidebarOpen openTransaction={() => {}} canCreateTransaction openCommandPalette={() => {}}
        detalhe="Empréstimo do João" />,
      "/emprestimos/abc"
    )
    expect(screen.getByText("Empréstimo do João")).toBeInTheDocument()
    expect(screen.getAllByText("Empréstimos")).toHaveLength(2)
    expect(screen.queryByText("Cartões de Crédito")).not.toBeInTheDocument()
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

  it("Navbar mostra o sino FINANCEIRO no app do usuário (showFinance, sem slot)", () => {
    withProviders(
      <Navbar toggleDrawer={() => {}} sidebarOpen openTransaction={() => {}} canCreateTransaction openCommandPalette={() => {}} />
    )
    expect(screen.getByTestId("bell")).toBeInTheDocument()
  })

  it("Navbar usa o sino INJETADO no admin e NÃO o financeiro (streams separados)", () => {
    // Regressão: notificações financeiras vazavam pra tela de admin. O admin injeta o SEU sino;
    // o financeiro (data-testid=bell) não pode aparecer, nem Nova transação.
    withProviders(
      <Navbar
        toggleDrawer={() => {}} sidebarOpen showFinance={false}
        title="Fila de aprovação" homeLabel="Painel Admin" homePath="/admin/pendentes"
        notifications={<div data-testid="admin-bell" />}
      />,
      "/admin/pendentes"
    )
    expect(screen.getByTestId("admin-bell")).toBeInTheDocument()
    expect(screen.queryByTestId("bell")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Nova transação/i })).not.toBeInTheDocument()
  })
})
