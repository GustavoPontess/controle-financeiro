import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import AdminPendentesPage from "../../pages/Admin/AdminPendentesPage"
import { StatusUsuario } from "../../types/Admin"

// vi.mock é içado pro topo — variáveis usadas na factory vêm de vi.hoisted.
const { notify, mockService } = vi.hoisted(() => ({
  notify: vi.fn(),
  mockService: {
    pendentes: vi.fn(),
    aprovar: vi.fn(),
    recusar: vi.fn(),
  },
}))

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return { ...actual, useOutletContext: () => ({ notify }) }
})
vi.mock("../../services/adminService", () => ({ default: mockService }))

function renderPage() {
  return render(
    <PontesThemeProvider>
      <AdminPendentesPage />
    </PontesThemeProvider>
  )
}

// O gate de acesso vive no AdminRoute (testado à parte). Esta tela assume que já é admin.
describe("AdminPendentesPage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("lista pendentes e aprova um cadastro", async () => {
    mockService.pendentes.mockResolvedValueOnce([
      { id: "p1", email: "novo@t.com", nome: "Novo User", status: StatusUsuario.AguardandoAprovacao, criadoEm: "2026-09-09T12:00:00Z" },
    ])
    mockService.aprovar.mockResolvedValueOnce({})
    renderPage()

    await waitFor(() => expect(screen.getByText("Novo User")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: /aprovar/i }))

    await waitFor(() => expect(mockService.aprovar).toHaveBeenCalledWith("p1"))
    await waitFor(() => expect(screen.queryByText("Novo User")).not.toBeInTheDocument())
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))
  })

  it("recusar pede confirmação antes de chamar o serviço", async () => {
    mockService.pendentes.mockResolvedValueOnce([
      { id: "p1", email: "novo@t.com", nome: "Novo User", status: StatusUsuario.AguardandoAprovacao, criadoEm: "2026-09-09T12:00:00Z" },
    ])
    mockService.recusar.mockResolvedValueOnce({})
    renderPage()

    await waitFor(() => expect(screen.getByText("Novo User")).toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: /recusar/i }))
    expect(mockService.recusar).not.toHaveBeenCalled()

    const confirmar = screen.getAllByRole("button", { name: /recusar/i }).at(-1)!
    fireEvent.click(confirmar)
    await waitFor(() => expect(mockService.recusar).toHaveBeenCalledWith("p1"))
  })

  it("mostra vazio quando não há pendentes", async () => {
    mockService.pendentes.mockResolvedValueOnce([])
    renderPage()
    await waitFor(() => expect(screen.getByText(/nenhum cadastro pendente/i)).toBeInTheDocument())
  })
})
