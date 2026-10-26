import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
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
    expect(screen.getByText("Pontes · finanças pessoais e familiares")).toBeInTheDocument()
  })
})
