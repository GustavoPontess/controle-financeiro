import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { Navigate } from "react-router-dom"

vi.mock("../../auth/useAuth", () => ({
  useAuth: () => ({ autenticado: false, carregando: false, entrar: vi.fn(), verificarMfa: vi.fn(), reativar: vi.fn(), adicionarConta: vi.fn() }),
}))
vi.mock("../../services/rosterService", () => ({ default: { listar: vi.fn().mockResolvedValue([]), remover: vi.fn() } }))
vi.mock("../../api/cliente", async (orig) => ({
  ...(await orig<typeof import("../../api/cliente")>()),
  api: { get: vi.fn().mockResolvedValue({ data: [] }), post: vi.fn() },
}))
import Entrar from "../../telas/Entrar"

const renderizar = (rota = "/entrar") => render(
  <MemoryRouter initialEntries={[rota]}>
    <Routes>
      <Route path="/entrar" element={<Entrar />} />
      {/* Igual ao App: o "Entrar" do site aponta pra /login. */}
      <Route path="/login" element={<Navigate to="/entrar" replace />} />
    </Routes>
  </MemoryRouter>,
)

describe("Entrar (Pontes Finanças, beta fechado)", () => {
  it("beta fechado: Pedir acesso abre o cadastro do app (o admin aprova); Conhecer leva pro site", async () => {
    renderizar()
    const pedir = await screen.findByRole("link", { name: "Pedir acesso" })
    expect(pedir).toHaveAttribute("href", "/cadastro")
    expect(screen.getByRole("link", { name: /Conhecer o Pontes Finanças/ })).toHaveAttribute("href", "https://pontesdev.com.br/pontes")
    expect(screen.queryByRole("link", { name: /Criar conta/ })).not.toBeInTheDocument()
  })

  it("selo discreto com link pro site do estúdio", async () => {
    renderizar()
    expect(await screen.findByRole("link", { name: "Pontes Dev" })).toHaveAttribute("href", "https://pontesdev.com.br")
    expect(screen.getByText(/Pontes Finanças · um produto/)).toBeInTheDocument()
  })

  it("/login leva pro login", async () => {
    renderizar("/login")
    expect(await screen.findByRole("link", { name: "Pedir acesso" })).toBeInTheDocument()
  })
})
