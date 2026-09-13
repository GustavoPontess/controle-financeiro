import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { PontesThemeProvider } from "../../components/pontes"
import LoginPage from "../../pages/Auth/LoginPage"

const { navigateMock, loginMock, reativarMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  loginMock: vi.fn(),
  reativarMock: vi.fn(),
}))

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return { ...actual, useNavigate: () => navigateMock }
})
vi.mock("../../hooks/useAuth", () => ({ useAuth: () => ({ login: loginMock, verificarMfaLogin: vi.fn() }) }))
vi.mock("@/services/minhaContaService", () => ({ default: { reativarConta: reativarMock } }))

function renderLogin() {
  return render(
    <PontesThemeProvider>
      <MemoryRouter><LoginPage /></MemoryRouter>
    </PontesThemeProvider>
  )
}

describe("LoginPage — reativação de conta na carência", () => {
  beforeEach(() => vi.clearAllMocks())

  it("login numa conta marcada mostra a tela de reativar; reativar chama o serviço e loga de novo", async () => {
    loginMock
      .mockResolvedValueOnce({ mfaRequerido: false, contaMarcadaExclusao: true, diasRestantes: 20 })
      .mockResolvedValueOnce({ mfaRequerido: false, contaMarcadaExclusao: false })
    reativarMock.mockResolvedValueOnce({ mensagem: "ok" })

    renderLogin()
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: "titular@t.com" } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "SenhaBemForte2026!" } })
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }))

    // Vira a tela de reativação, com os dias restantes.
    await waitFor(() => expect(screen.getByRole("button", { name: /reativar conta/i })).toBeInTheDocument())
    expect(screen.getByText(/faltam 20 dia/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /reativar conta/i }))

    await waitFor(() => expect(reativarMock).toHaveBeenCalledWith("titular@t.com", "SenhaBemForte2026!"))
    // Após reativar, loga de novo e entra.
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/"))
  })
})
