import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider, setMaskData } from "../../components/pontes"
import AdminAuditoriaPage from "../../pages/Admin/AdminAuditoriaPage"
import { AcaoAdmin } from "../../types/Admin"

const { mockService } = vi.hoisted(() => ({ mockService: { auditoria: vi.fn() } }))
vi.mock("../../services/adminService", () => ({ default: mockService }))

type Log = { id: string; adminEmail: string; acao: AcaoAdmin; alvoDescricao?: string; detalhe?: string; criadoEm: string }
// Envelope paginado (server-side) — antes o backend capava em 200 fixos; agora pagina tudo.
const paged = (items: Log[], total = items.length) => ({ items, total, page: 1, pageSize: 25, totalPages: 1 })

function renderPage() {
  return render(
    <PontesThemeProvider>
      <AdminAuditoriaPage />
    </PontesThemeProvider>
  )
}

describe("AdminAuditoriaPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setMaskData(false) // revela e-mails: este teste checa e-mail real (mascaramento coberto no pontes.test)
  })

  it("lista as ações com rótulo legível", async () => {
    mockService.auditoria.mockResolvedValue(paged([
      { id: "1", adminEmail: "chefe@t.com", acao: AcaoAdmin.BloquearUsuario, alvoDescricao: "alvo@t.com", criadoEm: "2026-09-10T12:00:00Z" },
    ]))
    renderPage()
    await waitFor(() => expect(screen.getByText("Bloqueou usuário")).toBeInTheDocument())
    expect(screen.getByText("chefe@t.com")).toBeInTheDocument()
    expect(screen.getByText("alvo@t.com")).toBeInTheDocument()
  })

  it("mostra vazio quando não há registros", async () => {
    mockService.auditoria.mockResolvedValue(paged([]))
    renderPage()
    await waitFor(() => expect(screen.getByText(/nenhuma ação registrada/i)).toBeInTheDocument())
  })

  it("busca é server-side: manda o termo pro serviço", async () => {
    mockService.auditoria.mockResolvedValue(paged([
      { id: "1", adminEmail: "chefe@t.com", acao: AcaoAdmin.BloquearUsuario, alvoDescricao: "alvo@t.com", criadoEm: "2026-09-10T12:00:00Z" },
    ]))
    renderPage()
    await waitFor(() => expect(screen.getByText("chefe@t.com")).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText("Admin ou alvo"), { target: { value: "chefe" } })
    await waitFor(() =>
      expect(mockService.auditoria).toHaveBeenCalledWith("chefe", 1, expect.any(Number))
    )
  })
})
