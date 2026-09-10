import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { PontesThemeProvider } from "../../components/pontes"
import AdminRoute from "../../components/Auth/AdminRoute"

const { mockService } = vi.hoisted(() => ({
  mockService: { me: vi.fn() },
}))
vi.mock("../../services/adminService", () => ({ default: mockService }))

function renderAt() {
  return render(
    <PontesThemeProvider>
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/" element={<div>HOME PUBLICA</div>} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <div>CONTEUDO ADMIN</div>
              </AdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </PontesThemeProvider>
  )
}

describe("AdminRoute", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renderiza o conteúdo admin quando o backend confirma IsAdmin", async () => {
    mockService.me.mockResolvedValueOnce({ id: "1", email: "adm@t.com", nome: "Adm", isAdmin: true })
    renderAt()
    await waitFor(() => expect(screen.getByText("CONTEUDO ADMIN")).toBeInTheDocument())
  })

  it("redireciona pra / (genérico) e NÃO monta o admin quando não é admin", async () => {
    mockService.me.mockResolvedValueOnce({ id: "1", email: "u@t.com", nome: "U", isAdmin: false })
    renderAt()
    await waitFor(() => expect(screen.getByText("HOME PUBLICA")).toBeInTheDocument())
    // Sem mensagem "sem acesso"/"restrito" — não confirma que a área existe.
    expect(screen.queryByText("CONTEUDO ADMIN")).not.toBeInTheDocument()
    expect(screen.queryByText(/sem acesso|restrito/i)).not.toBeInTheDocument()
  })

  it("redireciona pra / quando o backend nega (403)", async () => {
    mockService.me.mockRejectedValueOnce(new Error("403"))
    renderAt()
    await waitFor(() => expect(screen.getByText("HOME PUBLICA")).toBeInTheDocument())
    expect(screen.queryByText("CONTEUDO ADMIN")).not.toBeInTheDocument()
  })
})
