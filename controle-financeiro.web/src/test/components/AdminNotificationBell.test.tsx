import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { PontesThemeProvider } from "../../components/pontes"
import AdminNotificationBell from "../../pages/Admin/AdminNotificationBell"
import { TipoNotificacaoAdmin } from "../../types/NotificacaoAdmin"

const { navigateMock, mockService } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  mockService: {
    contagemNotificacoes: vi.fn(),
    notificacoes: vi.fn(),
    marcarNotificacaoLida: vi.fn(),
    marcarTodasNotificacoesLidas: vi.fn(),
  },
}))

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return { ...actual, useNavigate: () => navigateMock }
})
vi.mock("@/services/adminService", () => ({ default: mockService }))

const notif = {
  id: "n1", tipo: TipoNotificacaoAdmin.NovoCadastro, titulo: "Novo cadastro na fila",
  mensagem: "Fulano aguardando.", linkRelativo: "/admin/pendentes", lida: false, criadoEm: new Date().toISOString(),
}

function renderBell() {
  return render(
    <PontesThemeProvider>
      <MemoryRouter><AdminNotificationBell /></MemoryRouter>
    </PontesThemeProvider>
  )
}

describe("AdminNotificationBell", () => {
  beforeEach(() => vi.clearAllMocks())

  it("mostra a contagem de não lidas do stream de admin", async () => {
    mockService.contagemNotificacoes.mockResolvedValueOnce({ naoLidas: 3 })
    renderBell()
    await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument())
    expect(mockService.contagemNotificacoes).toHaveBeenCalled()
  })

  it("abre o painel, lista e ao clicar marca como lida e navega", async () => {
    mockService.contagemNotificacoes.mockResolvedValue({ naoLidas: 1 })
    mockService.notificacoes.mockResolvedValueOnce([notif])
    mockService.marcarNotificacaoLida.mockResolvedValueOnce({})
    renderBell()

    fireEvent.click(screen.getByRole("button", { name: /notificações do admin/i }))
    await waitFor(() => expect(screen.getByText("Novo cadastro na fila")).toBeInTheDocument())

    fireEvent.click(screen.getByText("Novo cadastro na fila"))
    await waitFor(() => expect(mockService.marcarNotificacaoLida).toHaveBeenCalledWith("n1"))
    expect(navigateMock).toHaveBeenCalledWith("/admin/pendentes")
  })
})
