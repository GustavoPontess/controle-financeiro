import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

vi.mock("../../services/contaService", () => ({ getContas: vi.fn(async () => [{ id: "k2", nome: "Nubank", tipo: 1, tipoDescricao: "", saldoAtual: 0, isCarteira: false }]) }))
vi.mock("../../services/cartaoCreditoService", () => ({ getCartoes: vi.fn(async () => []) }))
vi.mock("../../services/categoryService", () => ({ getCategories: vi.fn(async () => [{ id: "cat1", descricao: "Saúde", finalidade: 1, isPadrao: true }]) }))
vi.mock("../../services/subcategoryService", () => ({ getSubcategories: vi.fn(async () => []) }))
vi.mock("../../services/recorrenteService", () => ({ createRecorrente: vi.fn(), updateRecorrente: vi.fn() }))
import NovaContaFixa from "../../telas/NovaContaFixa"

const renderizar = () => render(
  <MemoryRouter initialEntries={["/contas-fixas/nova"]}>
    <Routes>
      <Route path="/contas-fixas/nova" element={<NovaContaFixa />} />
      <Route path="/contas-fixas" element={<p>lista de contas fixas</p>} />
    </Routes>
  </MemoryRouter>,
)

describe("NovaContaFixa", () => {
  it("abre o formulário próprio da conta fixa e Cancelar volta pra lista", async () => {
    renderizar()
    expect(await screen.findByRole("heading", { name: "Nova conta fixa" })).toBeInTheDocument()
    expect(await screen.findByRole("combobox", { name: "Como paga" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(await screen.findByText("lista de contas fixas")).toBeInTheDocument()
  })
})
