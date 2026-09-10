import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { PontesThemeProvider } from "../../components/pontes"
import AdminRoute from "../../components/Auth/AdminRoute"

// O gate agora lê isAdmin do usuário logado (useAuth), sem tocar no adminService.
const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))
vi.mock("../../hooks/useAuth", () => ({ useAuth: useAuthMock }))

function renderAt() {
  return render(
    <PontesThemeProvider>
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/" element={<div>HOME PUBLICA</div>} />
          <Route path="/admin" element={<AdminRoute><div>CONTEUDO ADMIN</div></AdminRoute>} />
        </Routes>
      </MemoryRouter>
    </PontesThemeProvider>
  )
}

describe("AdminRoute", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renderiza o conteúdo admin quando currentUser.isAdmin é true", () => {
    useAuthMock.mockReturnValue({ currentUser: { id: "1", nome: "Adm", isAdmin: true }, isLoading: false })
    renderAt()
    expect(screen.getByText("CONTEUDO ADMIN")).toBeInTheDocument()
  })

  it("redireciona pra / (genérico) e NÃO monta o admin quando não é admin", () => {
    useAuthMock.mockReturnValue({ currentUser: { id: "1", nome: "U", isAdmin: false }, isLoading: false })
    renderAt()
    expect(screen.getByText("HOME PUBLICA")).toBeInTheDocument()
    expect(screen.queryByText("CONTEUDO ADMIN")).not.toBeInTheDocument()
    // Sem mensagem "sem acesso"/"restrito" — não confirma que a área existe.
    expect(screen.queryByText(/sem acesso|restrito/i)).not.toBeInTheDocument()
  })

  it("redireciona quando não há usuário (deslogado/sem flag)", () => {
    useAuthMock.mockReturnValue({ currentUser: null, isLoading: false })
    renderAt()
    expect(screen.getByText("HOME PUBLICA")).toBeInTheDocument()
    expect(screen.queryByText("CONTEUDO ADMIN")).not.toBeInTheDocument()
  })
})
