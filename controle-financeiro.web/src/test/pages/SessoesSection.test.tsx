import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import SessoesSection from "../../pages/Settings/SessoesSection"

const { mockService } = vi.hoisted(() => ({
  mockService: { listar: vi.fn(), revogar: vi.fn(), revogarOutras: vi.fn() },
}))
vi.mock("../../services/sessaoService", () => ({ default: mockService }))

const atual = {
  id: "s1", criadoEm: "2026-09-16T10:00:00Z", ultimoUsoEm: "2026-09-16T12:00:00Z",
  dispositivo: "Mozilla/5.0 (Windows NT 10.0) Chrome/120", ip: "1.2.3.4", atual: true,
}
const outra = {
  id: "s2", criadoEm: "2026-09-15T10:00:00Z", ultimoUsoEm: null,
  dispositivo: "Mozilla/5.0 (Android 14) Firefox/121", ip: "5.6.7.8", atual: false,
}

function renderSection() {
  return render(<PontesThemeProvider><SessoesSection /></PontesThemeProvider>)
}

describe("SessoesSection", () => {
  beforeEach(() => vi.clearAllMocks())

  it("lista sessões e marca o dispositivo atual", async () => {
    mockService.listar.mockResolvedValue([atual, outra])
    renderSection()
    await waitFor(() => expect(screen.getByText("Chrome · Windows")).toBeInTheDocument())
    expect(screen.getByText("Firefox · Android")).toBeInTheDocument()
    expect(screen.getByText("Este dispositivo")).toBeInTheDocument()
  })

  it("encerrar uma sessão pede confirmação e só então chama o serviço", async () => {
    mockService.listar.mockResolvedValue([atual, outra])
    mockService.revogar.mockResolvedValue({})
    renderSection()
    await waitFor(() => expect(screen.getByText("Firefox · Android")).toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: /^encerrar$/i }))
    expect(mockService.revogar).not.toHaveBeenCalled()

    const confirmar = screen.getAllByRole("button", { name: /^encerrar$/i }).at(-1)!
    fireEvent.click(confirmar)
    await waitFor(() => expect(mockService.revogar).toHaveBeenCalledWith("s2"))
  })

  it("'sair dos outros dispositivos' pede confirmação e chama revogarOutras", async () => {
    mockService.listar.mockResolvedValue([atual, outra])
    mockService.revogarOutras.mockResolvedValue({ encerradas: 1 })
    renderSection()
    await waitFor(() => expect(screen.getByText("Chrome · Windows")).toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: /sair dos outros dispositivos/i }))
    const confirmar = screen.getAllByRole("button", { name: /sair dos outros/i }).at(-1)!
    fireEvent.click(confirmar)
    await waitFor(() => expect(mockService.revogarOutras).toHaveBeenCalled())
  })

  it("não mostra 'sair dos outros' quando só há a sessão atual", async () => {
    mockService.listar.mockResolvedValue([atual])
    renderSection()
    await waitFor(() => expect(screen.getByText("Chrome · Windows")).toBeInTheDocument())
    expect(screen.queryByRole("button", { name: /sair dos outros dispositivos/i })).not.toBeInTheDocument()
  })
})
