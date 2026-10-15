import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ usuario: { id: "u1", nome: "Ana Teste", email: "ana@teste.com" } }) }))
vi.mock("../../services/mfaService", () => ({ default: { status: vi.fn(async () => ({ ativo: false, ativadoEm: null, backupCodesRestantes: 0, mostrarConvite: false })) } }))
vi.mock("../../services/sessaoService", () => ({ default: { listar: vi.fn(async () => []) } }))
vi.mock("../../services/dispositivoService", () => ({ default: { listar: vi.fn(async () => []) } }))
vi.mock("../../api/cliente", async (orig) => ({ ...(await orig<typeof import("../../api/cliente")>()), api: { post: vi.fn(async () => ({})) } }))
import { api } from "../../api/cliente"
import Configuracoes from "../../telas/Configuracoes"

const renderizar = (rota = "/configuracoes") => render(
  <MemoryRouter initialEntries={[rota]}>
    <Routes><Route path="/configuracoes" element={<Configuracoes />} /></Routes>
  </MemoryRouter>,
)

describe("Configuracoes — separada por assunto", () => {
  beforeEach(() => vi.mocked(api.post).mockClear())

  it("abre em Segurança e login e troca de seção pelo menu", async () => {
    renderizar()
    expect(screen.getByRole("heading", { level: 2, name: "Segurança e login" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Segurança e login" })).toHaveAttribute("aria-current", "page")
    expect(await screen.findByText("Verificação em duas etapas")).toBeInTheDocument()
    expect(screen.getByText("Sessões ativas")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("link", { name: "Perfil" }))
    expect(screen.getByRole("heading", { level: 2, name: "Perfil" })).toBeInTheDocument()
    expect(screen.getByText("ana@teste.com")).toBeInTheDocument()
    expect(screen.queryByText("Sessões ativas")).not.toBeInTheDocument()
  })

  it("?s= abre direto a seção; seção que não existe cai na primeira", () => {
    renderizar("/configuracoes?s=aparencia")
    expect(screen.getByRole("radiogroup", { name: "Tema" })).toBeInTheDocument()
  })

  it("trocar senha: valida antes de enviar e manda 'sair dos outros' marcado", async () => {
    renderizar()
    await userEvent.click(screen.getByRole("button", { name: "Trocar senha" }))
    await userEvent.click(screen.getByRole("button", { name: "Trocar senha" }))
    expect(screen.getByText("Digite a senha atual.")).toBeInTheDocument()
    expect(screen.getByText("Crie a senha nova.")).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText("Senha atual"), "senha antiga qualquer")
    await userEvent.type(screen.getByLabelText("Senha nova"), "uma frase nova e longa")
    await userEvent.type(screen.getByLabelText("Confirmar senha nova"), "uma frase nova e longa")
    expect(screen.getByRole("checkbox", { name: "Sair dos outros aparelhos" })).toBeChecked()
    await userEvent.click(screen.getByRole("button", { name: "Trocar senha" }))
    expect(api.post).toHaveBeenCalledWith("/auth/change-password",
      { senhaAtual: "senha antiga qualquer", novaSenha: "uma frase nova e longa", encerrarOutrasSessoes: true }, expect.anything())
    expect(await screen.findByText(/Senha trocada/)).toBeInTheDocument()
  })
})
