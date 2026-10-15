import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

vi.mock("../../services/contaService", () => ({ getContas: vi.fn(async () => [{ id: "k2", nome: "Nubank", tipo: 1, tipoDescricao: "", saldoAtual: 0, isCarteira: false }]) }))
vi.mock("../../services/cartaoCreditoService", () => ({ getCartoes: vi.fn(async () => []) }))
vi.mock("../../services/categoryService", () => ({ getCategories: vi.fn(async () => [{ id: "cat1", descricao: "Saúde", finalidade: 1, isPadrao: true }]) }))
vi.mock("../../services/recorrenteService", () => ({ createRecorrente: vi.fn(), updateRecorrente: vi.fn() }))
vi.mock("../../services/transactionService", () => ({
  getTransaction: vi.fn(),
  updateTransaction: vi.fn(async () => ({ tipo: "contaFixa", id: "r-nova" })),
}))
import { getTransaction, updateTransaction } from "../../services/transactionService"
import NovaContaFixa from "../../telas/NovaContaFixa"

const ACADEMIA = { id: "t1", descricao: "Academia", valor: 120, tipo: 1, categoriaId: "cat1", contaId: "k2", contaNome: "Nubank", meioPagamento: 4, statusTransacao: 1, data: "2026-10-03" }

const renderizar = (rota: string, state?: unknown) => render(
  <MemoryRouter initialEntries={[{ pathname: rota, state }]}>
    <Routes>
      <Route path="/contas-fixas/nova" element={<NovaContaFixa />} />
      <Route path="/transacoes/:id/conta-fixa" element={<NovaContaFixa deTransacao />} />
      <Route path="/contas-fixas/:id" element={<p>página da conta fixa</p>} />
    </Routes>
  </MemoryRouter>,
)

describe("NovaContaFixa", () => {
  beforeEach(() => { vi.mocked(getTransaction).mockReset(); vi.mocked(updateTransaction).mockClear() })

  it("vindo da Nova transação, começa com o rascunho", async () => {
    renderizar("/contas-fixas/nova", { rascunho: { descricao: "Netflix", valor: "55,90", tipo: 1 } })
    expect(await screen.findByRole("heading", { name: "Nova conta fixa" })).toBeInTheDocument()
    expect(await screen.findByDisplayValue("Netflix")).toBeInTheDocument()
  })

  it("transformar: carrega o lançamento, troca pelo servidor e abre a conta fixa nova", async () => {
    vi.mocked(getTransaction).mockResolvedValue(ACADEMIA as never)
    renderizar("/transacoes/t1/conta-fixa")
    expect(await screen.findByDisplayValue("Academia")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Transformar em conta fixa" }))
    expect(updateTransaction).toHaveBeenCalledWith("t1", expect.objectContaining({ contaFixa: { frequencia: 2, dataFim: null } }), expect.any(String))
    expect(await screen.findByText("página da conta fixa")).toBeInTheDocument()
  })

  it("ocorrência de conta fixa (ou parcela) não vira conta fixa", async () => {
    vi.mocked(getTransaction).mockResolvedValue({ ...ACADEMIA, recorrenteOrigemId: "r1" } as never)
    renderizar("/transacoes/t1/conta-fixa")
    expect(await screen.findByRole("alert")).toHaveTextContent("Este lançamento não vira conta fixa.")
    expect(screen.queryByRole("button", { name: "Transformar em conta fixa" })).not.toBeInTheDocument()
  })
})
