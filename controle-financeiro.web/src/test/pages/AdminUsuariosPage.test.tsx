import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import AdminUsuariosPage from "../../pages/Admin/AdminUsuariosPage"
import { StatusUsuario } from "../../types/Admin"

const { notify, mockService, useAuthMock } = vi.hoisted(() => ({
  notify: vi.fn(),
  mockService: { usuarios: vi.fn(), bloquear: vi.fn(), reativar: vi.fn(), forcarReset: vi.fn() },
  useAuthMock: vi.fn(),
}))

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return { ...actual, useOutletContext: () => ({ notify }) }
})
vi.mock("../../services/adminService", () => ({ default: mockService }))
vi.mock("../../hooks/useAuth", () => ({ useAuth: useAuthMock }))

const ativo = { id: "u1", email: "ativo@t.com", nome: "Ativo User", status: StatusUsuario.Ativo, criadoEm: "2026-09-01T10:00:00Z", ultimoAcessoEm: "2026-09-09T10:00:00Z" }
const bloqueado = { id: "u2", email: "block@t.com", nome: "Blocked User", status: StatusUsuario.Bloqueado, criadoEm: "2026-09-01T10:00:00Z" }

function renderPage() {
  return render(
    <PontesThemeProvider>
      <AdminUsuariosPage />
    </PontesThemeProvider>
  )
}

describe("AdminUsuariosPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ currentUser: { id: "admin", nome: "Adm", isAdmin: true } })
  })

  it("lista usuários com badge de situação", async () => {
    mockService.usuarios.mockResolvedValueOnce([ativo, bloqueado])
    renderPage()
    await waitFor(() => expect(screen.getByText("Ativo User")).toBeInTheDocument())
    expect(screen.getByText("Bloqueado")).toBeInTheDocument()
  })

  it("bloquear pede confirmação e só então chama o serviço", async () => {
    mockService.usuarios.mockResolvedValueOnce([ativo])
    mockService.bloquear.mockResolvedValueOnce({ ...ativo, status: StatusUsuario.Bloqueado })
    renderPage()
    await waitFor(() => expect(screen.getByText("Ativo User")).toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: /bloquear/i }))
    expect(mockService.bloquear).not.toHaveBeenCalled()

    const confirmar = screen.getAllByRole("button", { name: /bloquear/i }).at(-1)!
    fireEvent.click(confirmar)
    await waitFor(() => expect(mockService.bloquear).toHaveBeenCalledWith("u1"))
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))
  })

  it("reativar chama o serviço direto", async () => {
    mockService.usuarios.mockResolvedValueOnce([bloqueado])
    mockService.reativar.mockResolvedValueOnce({ ...bloqueado, status: StatusUsuario.Ativo })
    renderPage()
    await waitFor(() => expect(screen.getByText("Blocked User")).toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: /reativar/i }))
    await waitFor(() => expect(mockService.reativar).toHaveBeenCalledWith("u2"))
  })

  it("não mostra 'Bloquear' na própria linha do admin", async () => {
    const adminRow = { ...ativo, id: "admin", nome: "Adm", email: "adm@t.com" }
    mockService.usuarios.mockResolvedValueOnce([adminRow])
    renderPage()
    await waitFor(() => expect(screen.getByText("Adm")).toBeInTheDocument())
    // Forçar reset aparece, Bloquear não (é a própria conta).
    expect(screen.getByRole("button", { name: /forçar reset/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /bloquear/i })).not.toBeInTheDocument()
  })
})
