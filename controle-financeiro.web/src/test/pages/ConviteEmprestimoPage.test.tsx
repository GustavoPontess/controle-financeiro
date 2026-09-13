import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import ConviteEmprestimoPage from "../../pages/Convite/ConviteEmprestimoPage"

const mockNavigate = vi.fn()
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useParams: () => ({ token: "tok123" }),
  useNavigate: () => mockNavigate,
}))

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: { isAuthenticated: false, isLoading: false },
}))
vi.mock("../../hooks/useAuth", () => ({ useAuth: () => mockAuth }))

const obterConvitePorToken = vi.fn()
const aceitarVinculoEmprestimo = vi.fn()
const recusarVinculoEmprestimo = vi.fn()
vi.mock("../../services/emprestimoService", () => ({
  obterConvitePorToken: (...a: unknown[]) => obterConvitePorToken(...a),
  aceitarVinculoEmprestimo: (...a: unknown[]) => aceitarVinculoEmprestimo(...a),
  recusarVinculoEmprestimo: (...a: unknown[]) => recusarVinculoEmprestimo(...a),
}))

function renderPage() {
  return render(<PontesThemeProvider><ConviteEmprestimoPage /></PontesThemeProvider>)
}

describe("ConviteEmprestimoPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    obterConvitePorToken.mockReset()
    aceitarVinculoEmprestimo.mockReset().mockResolvedValue(undefined)
    recusarVinculoEmprestimo.mockReset().mockResolvedValue(undefined)
  })

  it("deslogado: mostra pitch + CTAs, sem chamar API", async () => {
    mockAuth.isAuthenticated = false
    mockAuth.isLoading = false
    renderPage()
    expect(await screen.findByText(/Alguém registrou um empréstimo com você/)).toBeInTheDocument()
    expect(screen.getByText("Criar conta")).toBeInTheDocument()
    expect(screen.getByText("Já tenho conta")).toBeInTheDocument()
    expect(obterConvitePorToken).not.toHaveBeenCalled()
  })

  it("deslogado: CTA leva pro cadastro/login", async () => {
    mockAuth.isAuthenticated = false
    mockAuth.isLoading = false
    renderPage()
    await screen.findByText("Criar conta")
    fireEvent.click(screen.getByText("Criar conta"))
    expect(mockNavigate).toHaveBeenCalledWith("/auth/register")
    fireEvent.click(screen.getByText("Já tenho conta"))
    expect(mockNavigate).toHaveBeenCalledWith("/auth/login")
  })

  it("logado: mostra detalhes do convite e aceita", async () => {
    mockAuth.isAuthenticated = true
    mockAuth.isLoading = false
    obterConvitePorToken.mockResolvedValue({
      emprestimoId: "e1", descricao: "Ajuda com aluguel", valorTotal: 500,
      credorOuDevedorNome: "Gustavo", tipoDescricao: "Peguei emprestado",
    })
    renderPage()
    expect(await screen.findByText(/Ajuda com aluguel/)).toBeInTheDocument()
    expect(screen.getByText(/Gustavo/)).toBeInTheDocument()

    fireEvent.click(screen.getByText("Aceitar"))
    expect(await screen.findByText(/Vínculo aceito/)).toBeInTheDocument()
    expect(aceitarVinculoEmprestimo).toHaveBeenCalledWith("tok123")
  })

  it("logado: recusa o convite", async () => {
    mockAuth.isAuthenticated = true
    mockAuth.isLoading = false
    obterConvitePorToken.mockResolvedValue({
      emprestimoId: "e1", descricao: "Ajuda com aluguel", valorTotal: 500,
      credorOuDevedorNome: "Gustavo", tipoDescricao: "Peguei emprestado",
    })
    renderPage()
    await screen.findByText(/Ajuda com aluguel/)
    fireEvent.click(screen.getByText("Recusar"))
    expect(await screen.findByText(/Convite recusado/)).toBeInTheDocument()
    expect(recusarVinculoEmprestimo).toHaveBeenCalledWith("tok123")
  })

  it("logado: erro do backend (e-mail errado) aparece na tela", async () => {
    mockAuth.isAuthenticated = true
    mockAuth.isLoading = false
    obterConvitePorToken.mockRejectedValue({
      response: { data: { message: "Este convite não é para o seu e-mail." } },
    })
    renderPage()
    expect(await screen.findByText("Este convite não é para o seu e-mail.")).toBeInTheDocument()
  })
})
