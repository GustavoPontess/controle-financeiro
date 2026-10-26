import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

vi.mock("../../auth/useAuth", () => ({
  useAuth: () => ({ autenticado: false, carregando: false, entrar: vi.fn(), verificarMfa: vi.fn(), reativar: vi.fn(), adicionarConta: vi.fn() }),
}))
vi.mock("../../services/rosterService", () => ({ default: { listar: vi.fn().mockResolvedValue([]), remover: vi.fn() } }))
vi.mock("../../api/cliente", async (orig) => ({
  ...(await orig<typeof import("../../api/cliente")>()),
  api: { get: vi.fn().mockResolvedValue({ data: [] }), post: vi.fn() },
}))
import Entrar from "../../telas/Entrar"

describe("Entrar (beta fechado)", () => {
  it("Pedir acesso abre o cadastro do app (o admin aprova em /admin); sem cadastro livre", async () => {
    render(<MemoryRouter initialEntries={["/entrar"]}><Routes><Route path="/entrar" element={<Entrar />} /></Routes></MemoryRouter>)
    expect(await screen.findByRole("link", { name: "Pedir acesso" })).toHaveAttribute("href", "/cadastro")
    expect(screen.queryByRole("link", { name: /Criar conta/ })).not.toBeInTheDocument()
    expect(screen.getByText("Pontes · o dinheiro da casa")).toBeInTheDocument()
  })

  it("submit vazio bloqueia e mostra o erro embaixo de cada campo (visual do rascunho: .com-erro + .erro)", async () => {
    render(<MemoryRouter initialEntries={["/entrar"]}><Routes><Route path="/entrar" element={<Entrar />} /></Routes></MemoryRouter>)
    await userEvent.click(await screen.findByRole("button", { name: /Entrar/ }))
    expect(screen.getByText("Informe o e-mail")).toHaveClass("erro")
    expect(screen.getByText("Informe a senha")).toHaveClass("erro")
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByLabelText("E-mail").closest("label")).toHaveClass("campo", "com-erro")
  })

  it("Esqueci a senha abre o pedido do link e volta ao login", async () => {
    render(<MemoryRouter initialEntries={["/entrar"]}><Routes><Route path="/entrar" element={<Entrar />} /></Routes></MemoryRouter>)
    await userEvent.click(await screen.findByRole("button", { name: "Esqueci a senha" }))
    expect(screen.getByRole("heading", { name: "Recuperar senha" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Voltar ao login/ }))
    expect(screen.getByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument()
  })

  it("DEV: a barra de estados abre cada passo direto pelo endereço, sem login nem API", async () => {
    render(<MemoryRouter initialEntries={["/entrar#duas-etapas"]}><Routes><Route path="/entrar" element={<Entrar />} /></Routes></MemoryRouter>)
    expect(await screen.findByRole("heading", { name: "Verificação em duas etapas" })).toBeInTheDocument()
    const painel = await screen.findByRole("region", { name: /Painel de dev/ })
    const seletor = screen.getByRole("combobox", { name: "Estado da tela" })
    expect(seletor).toHaveValue("/entrar#duas-etapas")
    await userEvent.selectOptions(seletor, "/entrar#reativar")
    expect(await screen.findByRole("heading", { name: "Reativar conta" })).toBeInTheDocument()
    expect(screen.getByText(/Faltam 23 dias/)).toBeInTheDocument()
    expect(painel).toBeInTheDocument()
  })
})
