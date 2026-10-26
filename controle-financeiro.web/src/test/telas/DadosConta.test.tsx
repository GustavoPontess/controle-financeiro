import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"

const sair = vi.fn(async () => {})
vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ usuario: { id: "u1", nome: "Ana Teste", email: "ana@teste.com" }, sair }) }))
vi.mock("../../services/minhaContaService", () => ({ default: {
  exportarMeusDados: vi.fn(async () => ({ perfil: { email: "ana@teste.com" } })),
  enviarCodigoExclusao: vi.fn(async () => "email"),
  excluirConta: vi.fn(async () => {}),
} }))
import contaService from "../../services/minhaContaService"
import DadosConta from "../../telas/DadosConta"

const Entrar = () => { const { state } = useLocation(); return <p>entrar {JSON.stringify(state)}</p> }
const renderizar = () => render(
  <MemoryRouter initialEntries={["/configuracoes?s=privacidade"]}>
    <Routes>
      <Route path="/configuracoes" element={<DadosConta />} />
      <Route path="/entrar" element={<Entrar />} />
    </Routes>
  </MemoryRouter>,
)

describe("Dados e privacidade (Configurações)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.URL.createObjectURL = vi.fn(() => "blob:dados")
    globalThis.URL.revokeObjectURL = vi.fn()
    HTMLAnchorElement.prototype.click = vi.fn()
  })

  it("baixar meus dados pede a exportação e entrega um arquivo JSON", async () => {
    renderizar()
    await userEvent.click(screen.getByRole("button", { name: /Baixar meus dados/ }))
    expect(contaService.exportarMeusDados).toHaveBeenCalled()
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled()
  })

  it("excluir a conta: senha atual, depois o código; vazio bloqueia; no fim sai e vai pro login com o aviso", async () => {
    renderizar()
    await userEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }))
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }))
    expect(screen.getByText("Digite a senha atual.")).toBeInTheDocument()
    expect(contaService.enviarCodigoExclusao).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText("Senha atual"), "frase-comprida-de-teste")
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }))
    expect(contaService.enviarCodigoExclusao).toHaveBeenCalledWith("frase-comprida-de-teste")
    expect(await screen.findByText("Mandamos um código pro seu e-mail.")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Excluir de vez" }))
    expect(screen.getByText("Digite o código.")).toBeInTheDocument()
    expect(contaService.excluirConta).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText("Código"), "123456")
    await userEvent.click(screen.getByRole("button", { name: "Excluir de vez" }))
    expect(contaService.excluirConta).toHaveBeenCalledWith("frase-comprida-de-teste", "123456")
    expect(await screen.findByText(/entrar/)).toHaveTextContent('"contaExcluida":true')
    expect(sair).toHaveBeenCalled()
  })

  it("cancelar no meio volta pro começo sem chamar o servidor", async () => {
    renderizar()
    await userEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }))
    await userEvent.type(screen.getByLabelText("Senha atual"), "x")
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(screen.getByRole("button", { name: "Excluir minha conta" })).toBeInTheDocument()
    expect(contaService.enviarCodigoExclusao).not.toHaveBeenCalled()
  })
})
