import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { PontesThemeProvider } from "../../components/pontes"
import ExcluirContaSection from "../../pages/Settings/ExcluirContaSection"

const { navigateMock, logoutMock, mockService } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  logoutMock: vi.fn(),
  mockService: {
    enviarCodigoExclusao: vi.fn(),
    excluirConta: vi.fn(),
    exportarMeusDados: vi.fn(),
    reativarConta: vi.fn(),
  },
}))

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return { ...actual, useNavigate: () => navigateMock }
})
vi.mock("@/services/minhaContaService", () => ({ default: mockService }))
vi.mock("../../hooks/useAuth", () => ({ useAuth: () => ({ logout: logoutMock }) }))

function renderSection() {
  return render(
    <PontesThemeProvider>
      <MemoryRouter><ExcluirContaSection /></MemoryRouter>
    </PontesThemeProvider>
  )
}

describe("ExcluirContaSection", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fluxo sem MFA: senha → código por e-mail → exclui, desloga e navega pro login", async () => {
    mockService.enviarCodigoExclusao.mockResolvedValueOnce("email")
    mockService.excluirConta.mockResolvedValueOnce(undefined)
    renderSection()

    fireEvent.click(screen.getByRole("button", { name: /excluir minha conta/i }))
    fireEvent.change(screen.getByLabelText(/senha atual/i), { target: { value: "SenhaBemForte2026!" } })
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }))

    await waitFor(() => expect(mockService.enviarCodigoExclusao).toHaveBeenCalledWith("SenhaBemForte2026!"))
    // método e-mail → mostra a instrução do e-mail
    await waitFor(() => expect(screen.getByText(/enviamos um código para o seu e-mail/i)).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText(/código de verificação/i), { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: /excluir de vez/i }))

    await waitFor(() => expect(mockService.excluirConta).toHaveBeenCalledWith("SenhaBemForte2026!", "123456"))
    expect(logoutMock).toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledWith("/auth/login", expect.objectContaining({ replace: true }))
  })

  it("baixar meus dados chama o export e gera o download", async () => {
    mockService.exportarMeusDados.mockResolvedValueOnce({ perfil: { email: "x@t.com" } })
    URL.createObjectURL = vi.fn(() => "blob:x")
    URL.revokeObjectURL = vi.fn()
    renderSection()

    fireEvent.click(screen.getByRole("button", { name: /baixar meus dados/i }))
    await waitFor(() => expect(mockService.exportarMeusDados).toHaveBeenCalled())
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it("código vazio bloqueia a exclusão", async () => {
    mockService.enviarCodigoExclusao.mockResolvedValueOnce("email")
    renderSection()
    fireEvent.click(screen.getByRole("button", { name: /excluir minha conta/i }))
    fireEvent.change(screen.getByLabelText(/senha atual/i), { target: { value: "x" } })
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }))
    await waitFor(() => expect(screen.getByLabelText(/código de verificação/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: /excluir de vez/i }))
    await waitFor(() => expect(screen.getByText(/informe o código/i)).toBeInTheDocument())
    expect(mockService.excluirConta).not.toHaveBeenCalled()
  })
})
