import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider, setMaskData } from "../../components/pontes"
import AdminLgpdPage from "../../pages/Admin/AdminLgpdPage"
import { StatusUsuario } from "../../types/Admin"

const { notify, mockService, useAuthMock } = vi.hoisted(() => ({
  notify: vi.fn(),
  mockService: {
    usuarios: vi.fn(),
    exportar: vi.fn(),
    marcarExclusao: vi.fn(),
    cancelarExclusao: vi.fn(),
    purgar: vi.fn(),
  },
  useAuthMock: vi.fn(),
}))

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return { ...actual, useOutletContext: () => ({ notify }) }
})
vi.mock("../../services/adminService", () => ({ default: mockService }))
vi.mock("../../hooks/useAuth", () => ({ useAuth: useAuthMock }))

const ativo = { id: "u1", email: "ativo@t.com", nome: "Ativo User", status: StatusUsuario.Ativo, criadoEm: "2026-09-01T10:00:00Z" }
const emExclusao = { id: "u2", email: "bye@t.com", nome: "Saindo", status: StatusUsuario.MarcadoParaExclusao, criadoEm: "2026-09-01T10:00:00Z", marcadoExclusaoEm: "2026-09-10T10:00:00Z" }

function renderPage() {
  return render(
    <PontesThemeProvider>
      <AdminLgpdPage />
    </PontesThemeProvider>
  )
}

describe("AdminLgpdPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ currentUser: { id: "admin", nome: "Adm", isAdmin: true } })
    setMaskData(false) // revela os e-mails: estes testes checam e-mail real (mascaramento é coberto no pontes.test)
  })

  it("marcar para exclusão pede confirmação e só então chama o serviço", async () => {
    mockService.usuarios.mockResolvedValueOnce([ativo])
    mockService.marcarExclusao.mockResolvedValueOnce({ ...ativo, status: StatusUsuario.MarcadoParaExclusao })
    renderPage()
    await waitFor(() => expect(screen.getByText("Ativo User")).toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: /marcar exclusão/i }))
    expect(mockService.marcarExclusao).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: /^marcar$/i }))
    await waitFor(() => expect(mockService.marcarExclusao).toHaveBeenCalledWith("u1"))
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))
  })

  it("purga só habilita quando o e-mail digitado confere", async () => {
    mockService.usuarios.mockResolvedValueOnce([emExclusao])
    mockService.purgar.mockResolvedValueOnce({})
    renderPage()
    await waitFor(() => expect(screen.getByText("Saindo")).toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: /purgar/i }))
    const confirmar = screen.getByRole("button", { name: /purgar de vez/i })
    expect(confirmar).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText("bye@t.com"), { target: { value: "bye@t.com" } })
    expect(confirmar).not.toBeDisabled()

    fireEvent.click(confirmar)
    await waitFor(() => expect(mockService.purgar).toHaveBeenCalledWith("u2", "bye@t.com"))
  })

  it("não mostra 'Marcar exclusão' nem 'Purgar' na própria linha do admin", async () => {
    const adminMarcado = { ...emExclusao, id: "admin", nome: "Adm", email: "adm@t.com" }
    mockService.usuarios.mockResolvedValueOnce([adminMarcado])
    renderPage()
    await waitFor(() => expect(screen.getByText("Adm")).toBeInTheDocument())

    // Exportar e Cancelar aparecem; Purgar não (própria conta).
    expect(screen.getByRole("button", { name: /exportar/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /purgar/i })).not.toBeInTheDocument()
  })

  it("mascara o e-mail na tabela por padrão (olhinho do admin)", async () => {
    setMaskData(true) // default do painel: mascarado
    mockService.usuarios.mockResolvedValueOnce([ativo])
    renderPage()
    await waitFor(() => expect(screen.getByText("Ativo User")).toBeInTheDocument())
    // e-mail aparece mascarado, nunca em texto puro
    expect(screen.getByText("at•••@t•••.com")).toBeInTheDocument()
    expect(screen.queryByText("ativo@t.com")).not.toBeInTheDocument()
    setMaskData(false)
  })

  it("exportar baixa o JSON e notifica", async () => {
    mockService.usuarios.mockResolvedValueOnce([ativo])
    mockService.exportar.mockResolvedValueOnce({ geradoEm: "x", perfil: { id: "u1", email: "ativo@t.com", nome: "Ativo User" }, contas: [], cartoes: [], transacoes: [], metas: [], orcamentos: [] })
    // jsdom não implementa createObjectURL/click de download — stub pra não quebrar.
    URL.createObjectURL = vi.fn(() => "blob:x")
    URL.revokeObjectURL = vi.fn()
    renderPage()
    await waitFor(() => expect(screen.getByText("Ativo User")).toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: /exportar/i }))
    await waitFor(() => expect(mockService.exportar).toHaveBeenCalledWith("u1"))
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))
  })
})
