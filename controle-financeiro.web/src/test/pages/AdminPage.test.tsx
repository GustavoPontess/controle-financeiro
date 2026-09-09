import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import AdminPage from "../../pages/Admin/AdminPage"
import { StatusUsuario } from "../../types/Admin"

// vi.mock é içado pro topo — variáveis usadas na factory precisam vir de vi.hoisted.
const { notify, mockService } = vi.hoisted(() => ({
  notify: vi.fn(),
  mockService: {
    me: vi.fn(),
    pendentes: vi.fn(),
    metricas: vi.fn(),
    aprovar: vi.fn(),
    recusar: vi.fn(),
  },
}))

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return { ...actual, useOutletContext: () => ({ notify }) }
})

vi.mock("../../services/adminService", () => ({ default: mockService }))

const metricasZero = {
  total: 0, pendentes: 0, ativos: 0, recusados: 0, bloqueados: 0,
  marcadosParaExclusao: 0, cadastrosUltimos7Dias: 0, ativosUltimos7Dias: 0,
}

function renderAdmin() {
  return render(
    <PontesThemeProvider>
      <AdminPage />
    </PontesThemeProvider>
  )
}

describe("AdminPage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("mostra 'Sem acesso' pra não-admin", async () => {
    mockService.me.mockResolvedValueOnce({ id: "1", email: "u@t.com", nome: "U", isAdmin: false })
    renderAdmin()
    await waitFor(() => expect(screen.getByText(/sem acesso/i)).toBeInTheDocument())
    expect(mockService.pendentes).not.toHaveBeenCalled()
  })

  it("mostra 'Sem acesso' quando o backend nega (403)", async () => {
    mockService.me.mockRejectedValueOnce(new Error("403"))
    renderAdmin()
    await waitFor(() => expect(screen.getByText(/sem acesso/i)).toBeInTheDocument())
  })

  it("lista pendentes e aprova um cadastro", async () => {
    mockService.me.mockResolvedValueOnce({ id: "1", email: "adm@t.com", nome: "Adm", isAdmin: true })
    mockService.pendentes.mockResolvedValueOnce([
      { id: "p1", email: "novo@t.com", nome: "Novo User", status: StatusUsuario.AguardandoAprovacao, criadoEm: "2026-09-09T12:00:00Z" },
    ])
    mockService.metricas.mockResolvedValue(metricasZero)
    mockService.aprovar.mockResolvedValueOnce({})
    renderAdmin()

    await waitFor(() => expect(screen.getByText("Novo User")).toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: /aprovar/i }))

    await waitFor(() => expect(mockService.aprovar).toHaveBeenCalledWith("p1"))
    // Some da lista e notifica sucesso.
    await waitFor(() => expect(screen.queryByText("Novo User")).not.toBeInTheDocument())
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))
  })

  it("recusar pede confirmação antes de chamar o serviço", async () => {
    mockService.me.mockResolvedValueOnce({ id: "1", email: "adm@t.com", nome: "Adm", isAdmin: true })
    mockService.pendentes.mockResolvedValueOnce([
      { id: "p1", email: "novo@t.com", nome: "Novo User", status: StatusUsuario.AguardandoAprovacao, criadoEm: "2026-09-09T12:00:00Z" },
    ])
    mockService.metricas.mockResolvedValue(metricasZero)
    mockService.recusar.mockResolvedValueOnce({})
    renderAdmin()

    await waitFor(() => expect(screen.getByText("Novo User")).toBeInTheDocument())

    // Clicar em "Recusar" abre o diálogo, mas ainda NÃO chama o serviço.
    fireEvent.click(screen.getByRole("button", { name: /recusar/i }))
    expect(mockService.recusar).not.toHaveBeenCalled()

    // Confirmar no diálogo dispara a recusa.
    const confirmar = screen.getAllByRole("button", { name: /recusar/i }).at(-1)!
    fireEvent.click(confirmar)
    await waitFor(() => expect(mockService.recusar).toHaveBeenCalledWith("p1"))
  })
})
