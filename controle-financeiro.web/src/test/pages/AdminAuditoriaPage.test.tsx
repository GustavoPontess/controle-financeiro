import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import AdminAuditoriaPage from "../../pages/Admin/AdminAuditoriaPage"
import { AcaoAdmin } from "../../types/Admin"

const { mockService } = vi.hoisted(() => ({ mockService: { auditoria: vi.fn() } }))
vi.mock("../../services/adminService", () => ({ default: mockService }))

function renderPage() {
  return render(
    <PontesThemeProvider>
      <AdminAuditoriaPage />
    </PontesThemeProvider>
  )
}

describe("AdminAuditoriaPage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("lista as ações com rótulo legível", async () => {
    mockService.auditoria.mockResolvedValueOnce([
      { id: "1", adminEmail: "chefe@t.com", acao: AcaoAdmin.BloquearUsuario, alvoDescricao: "alvo@t.com", criadoEm: "2026-09-10T12:00:00Z" },
    ])
    renderPage()
    await waitFor(() => expect(screen.getByText("Bloqueou usuário")).toBeInTheDocument())
    expect(screen.getByText("chefe@t.com")).toBeInTheDocument()
    expect(screen.getByText("alvo@t.com")).toBeInTheDocument()
  })

  it("mostra vazio quando não há registros", async () => {
    mockService.auditoria.mockResolvedValueOnce([])
    renderPage()
    await waitFor(() => expect(screen.getByText(/nenhuma ação registrada/i)).toBeInTheDocument())
  })
})
