import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
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

// Envelope paginado (server-side) — o backend devolve isso, não um array cru.
type Row = typeof ativo | typeof bloqueado
const paged = (items: Row[], total = items.length) => ({ items, total, page: 1, pageSize: 25, totalPages: 1 })

function renderPage() {
  return render(
    <PontesThemeProvider>
      <AdminUsuariosPage />
    </PontesThemeProvider>
  )
}

// Abre o ⋮ da 1ª linha e devolve o menu (as ações agora moram no menu, não soltas na linha).
async function abrirMenu(i = 0) {
  fireEvent.click((await screen.findAllByRole("button", { name: "Ações" }))[i])
  return screen.findByRole("menu")
}

describe("AdminUsuariosPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ currentUser: { id: "admin", nome: "Adm", isAdmin: true } })
  })

  it("lista usuários com badge de situação", async () => {
    mockService.usuarios.mockResolvedValue(paged([ativo, bloqueado]))
    renderPage()
    await waitFor(() => expect(screen.getByText("Ativo User")).toBeInTheDocument())
    expect(screen.getByText("Bloqueado")).toBeInTheDocument()
  })

  it("busca é server-side: manda o termo pro serviço (não filtra em memória)", async () => {
    mockService.usuarios.mockResolvedValue(paged([ativo]))
    renderPage()
    await waitFor(() => expect(screen.getByText("Ativo User")).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText("Buscar por nome ou e-mail…"), { target: { value: "ativo" } })
    // debounce (350ms) → chamada server-side com a busca, página 1
    await waitFor(() =>
      expect(mockService.usuarios).toHaveBeenCalledWith("ativo", 1, expect.any(Number))
    )
  })

  it("bloquear (no ⋮) pede confirmação e só então chama o serviço", async () => {
    mockService.usuarios.mockResolvedValue(paged([ativo]))
    mockService.bloquear.mockResolvedValueOnce({ ...ativo, status: StatusUsuario.Bloqueado })
    renderPage()
    await waitFor(() => expect(screen.getByText("Ativo User")).toBeInTheDocument())

    const menu = await abrirMenu()
    fireEvent.click(within(menu).getByRole("menuitem", { name: /bloquear/i }))
    expect(mockService.bloquear).not.toHaveBeenCalled()

    // Confirma no diálogo.
    fireEvent.click(screen.getByRole("button", { name: "Bloquear" }))
    await waitFor(() => expect(mockService.bloquear).toHaveBeenCalledWith("u1"))
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))
  })

  it("reativar (no ⋮) chama o serviço direto", async () => {
    mockService.usuarios.mockResolvedValue(paged([bloqueado]))
    mockService.reativar.mockResolvedValueOnce({ ...bloqueado, status: StatusUsuario.Ativo })
    renderPage()
    await waitFor(() => expect(screen.getByText("Blocked User")).toBeInTheDocument())

    const menu = await abrirMenu()
    fireEvent.click(within(menu).getByRole("menuitem", { name: /reativar/i }))
    await waitFor(() => expect(mockService.reativar).toHaveBeenCalledWith("u2"))
  })

  it("não mostra 'Bloquear' na própria linha do admin", async () => {
    const adminRow = { ...ativo, id: "admin", nome: "Adm", email: "adm@t.com" }
    mockService.usuarios.mockResolvedValue(paged([adminRow]))
    renderPage()
    await waitFor(() => expect(screen.getByText("Adm")).toBeInTheDocument())
    // Forçar reset aparece no ⋮, Bloquear não (é a própria conta).
    const menu = await abrirMenu()
    expect(within(menu).getByRole("menuitem", { name: /forçar reset/i })).toBeInTheDocument()
    expect(within(menu).queryByRole("menuitem", { name: /bloquear/i })).not.toBeInTheDocument()
  })
})
