import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import EmprestimosPage from "../../pages/Emprestimos/EmprestimosPage"
import type { Emprestimo } from "../../types/Emprestimo"

vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ notify: vi.fn() }),
}))

const listEmprestimosPage = vi.fn()
const createEmprestimo = vi.fn()
const registrarPagamento = vi.fn()
const quitarEmprestimo = vi.fn()
const deleteEmprestimo = vi.fn()
vi.mock("../../services/emprestimoService", () => ({
  listEmprestimosPage: (...a: unknown[]) => listEmprestimosPage(...a),
  getEmprestimos: () => Promise.resolve([]),
  createEmprestimo: (...a: unknown[]) => createEmprestimo(...a),
  registrarPagamento: (...a: unknown[]) => registrarPagamento(...a),
  quitarEmprestimo: (...a: unknown[]) => quitarEmprestimo(...a),
  deleteEmprestimo: (...a: unknown[]) => deleteEmprestimo(...a),
}))
const paged = <T,>(items: T[]) => ({
  items, total: items.length, page: 1, pageSize: 100, totalPages: 1,
})

const emp = {
  id: "e1", descricao: "Viagem", pessoa: "João", valorTotal: 1000, valorPago: 200,
  valorRestante: 800, percentualPago: 20, tipo: 1, quitado: false, vencido: false,
  dataInicio: "2026-04-01T00:00:00Z", dataVencimento: "2026-08-01T00:00:00Z",
} as unknown as Emprestimo

function renderPage() {
  return render(<PontesThemeProvider><EmprestimosPage /></PontesThemeProvider>)
}

describe("EmprestimosPage (#152)", () => {
  beforeEach(() => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([emp]))
    createEmprestimo.mockReset().mockResolvedValue(undefined)
    registrarPagamento.mockReset().mockResolvedValue(undefined)
    quitarEmprestimo.mockReset().mockResolvedValue(undefined)
    deleteEmprestimo.mockReset().mockResolvedValue(undefined)
  })

  it("lista empréstimos + stats", async () => {
    renderPage()
    expect(await screen.findByText("Viagem")).toBeInTheDocument()
    expect(screen.getByText("A receber")).toBeInTheDocument()
    expect(screen.getAllByText(/R\$\s?800,00/).length).toBeGreaterThan(0)
  })

  it("empty state sem empréstimos", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([]))
    renderPage()
    expect(await screen.findByText("Nenhum empréstimo cadastrado")).toBeInTheDocument()
  })

  it("valida submit vazio do form Novo empréstimo", async () => {
    renderPage()
    await screen.findByText("Viagem")
    fireEvent.click(screen.getByText("Novo Empréstimo"))
    await screen.findByText("Novo empréstimo")
    fireEvent.click(screen.getByText("Criar empréstimo"))
    expect(await screen.findByText("Informe a descrição")).toBeInTheDocument()
    expect(screen.getByText(/Informe pra quem emprestou|Informe de quem pegou/)).toBeInTheDocument()
    expect(screen.getByText("Informe o valor")).toBeInTheDocument()
    expect(createEmprestimo).not.toHaveBeenCalled()
  })

  it("valida pagamento sem valor", async () => {
    renderPage()
    await screen.findByText("Viagem")
    fireEvent.click(screen.getByLabelText("Registrar pagamento"))
    await screen.findByText("Registrar pagamento")
    fireEvent.click(screen.getByText("Confirmar"))
    expect(await screen.findByText("Informe um valor maior que zero")).toBeInTheDocument()
    expect(registrarPagamento).not.toHaveBeenCalled()
  })
})
