import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import EmprestimoDetalhePage from "../../pages/Emprestimos/EmprestimoDetalhePage"
import { StatusVinculoEmprestimo, type Emprestimo } from "../../types/Emprestimo"

// Detalhe: reusa useEmprestimosLogic (por isso mocka toda a carga do hook). useParams devolve o id
// da rota; useNavigate é spy pra checar o "Voltar".
const navigateSpy = vi.hoisted(() => vi.fn())
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useParams: () => ({ id: "e3" }),
  useNavigate: () => navigateSpy,
  useOutletContext: () => ({ notify: vi.fn() }),
}))

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: { id: "me-1", nome: "Gustavo" } }),
}))

const emp = {
  id: "e3", descricao: "Carro", pessoa: "João", valorTotal: 1000, valorPago: 200,
  valorRestante: 800, percentualPago: 20, valorPendente: 0, valorRecusado: 0,
  tipo: 1, quitado: false, vencido: false, formaPagamento: 2, quantidadeParcelas: 3, origem: 1,
  dataInicio: "2026-04-01T00:00:00Z", dataVencimento: "2026-08-01T00:00:00Z",
  statusVinculo: StatusVinculoEmprestimo.SemVinculo, souCredor: true,
} as unknown as Emprestimo

const parcela = {
  id: "pa1", emprestimoId: "e3", numero: 1, quantidadeTotal: 3,
  dataVencimento: "2026-09-01T00:00:00Z", valor: 100,
  status: 1, statusDescricao: "Pendente", atrasada: false, valorPago: 0,
}

const getEmprestimo = vi.fn()
const listParcelasEmprestimo = vi.fn()
const listEmprestimosPage = vi.fn()
const getEmprestimoStats = vi.fn()
const listConvitesPendentesEmprestimo = vi.fn()
const listCandidatosConsolidacao = vi.fn()
const listConsolidacoes = vi.fn()
const listSolicitacoesPagamento = vi.fn()
const noop = vi.fn()
vi.mock("../../services/emprestimoService", () => ({
  getEmprestimo: (...a: unknown[]) => getEmprestimo(...a),
  listParcelasEmprestimo: (...a: unknown[]) => listParcelasEmprestimo(...a),
  listEmprestimosPage: (...a: unknown[]) => listEmprestimosPage(...a),
  getEmprestimoStats: (...a: unknown[]) => getEmprestimoStats(...a),
  getEmprestimos: () => Promise.resolve([]),
  createEmprestimo: (...a: unknown[]) => noop(...a),
  quitarEmprestimo: (...a: unknown[]) => noop(...a),
  deleteEmprestimo: (...a: unknown[]) => noop(...a),
  arquivarEmprestimo: (...a: unknown[]) => noop(...a),
  desarquivarEmprestimo: (...a: unknown[]) => noop(...a),
  vincularEmprestimo: (...a: unknown[]) => noop(...a),
  listConvitesPendentesEmprestimo: (...a: unknown[]) => listConvitesPendentesEmprestimo(...a),
  aceitarVinculoEmprestimoPorId: (...a: unknown[]) => noop(...a),
  recusarVinculoEmprestimoPorId: (...a: unknown[]) => noop(...a),
  solicitarPagamentoEmprestimo: (...a: unknown[]) => noop(...a),
  listSolicitacoesPagamento: (...a: unknown[]) => listSolicitacoesPagamento(...a),
  aprovarPagamentoEmprestimo: (...a: unknown[]) => noop(...a),
  rejeitarPagamentoEmprestimo: (...a: unknown[]) => noop(...a),
  reenviarPagamentoEmprestimo: (...a: unknown[]) => noop(...a),
  listCandidatosConsolidacao: (...a: unknown[]) => listCandidatosConsolidacao(...a),
  proporConsolidacao: (...a: unknown[]) => noop(...a),
  listConsolidacoes: (...a: unknown[]) => listConsolidacoes(...a),
  aceitarConsolidacao: (...a: unknown[]) => noop(...a),
  recusarConsolidacao: (...a: unknown[]) => noop(...a),
  cancelarConsolidacao: (...a: unknown[]) => noop(...a),
}))
vi.mock("../../services/contaService", () => ({ getContas: () => Promise.resolve([]) }))
vi.mock("../../services/categoryService", () => ({ getCategories: () => Promise.resolve([]) }))
vi.mock("../../services/bancoService", () => ({ getBancos: () => Promise.resolve([]) }))
vi.mock("../../services/transactionService", () => ({ listTransactionsPage: () => Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100, totalPages: 1 }) }))

const paged = <T,>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 100, totalPages: 1 })

function renderPage() {
  return render(<PontesThemeProvider><EmprestimoDetalhePage /></PontesThemeProvider>)
}

describe("EmprestimoDetalhePage", () => {
  beforeEach(() => {
    navigateSpy.mockReset()
    getEmprestimo.mockReset().mockResolvedValue(emp)
    listParcelasEmprestimo.mockReset().mockResolvedValue([parcela])
    listEmprestimosPage.mockReset().mockResolvedValue(paged([emp]))
    getEmprestimoStats.mockReset().mockResolvedValue({ totalAReceber: 800, totalAPagar: 0, ativos: 1, qtdTotal: 1, totalAReceberVencido: 0 })
    listConvitesPendentesEmprestimo.mockReset().mockResolvedValue([])
    listCandidatosConsolidacao.mockReset().mockResolvedValue([])
    listConsolidacoes.mockReset().mockResolvedValue([])
    listSolicitacoesPagamento.mockReset().mockResolvedValue([])
  })

  it("mostra header, progresso e stat cards", async () => {
    renderPage()
    expect(await screen.findByText("Carro")).toBeInTheDocument()
    expect(screen.getByText("20%")).toBeInTheDocument()
    expect(screen.getByText("Valor original")).toBeInTheDocument()
    expect(screen.getAllByText("Pago").length).toBeGreaterThan(0)
    expect(screen.getByText("Restante")).toBeInTheDocument()
  })

  it("carrega e mostra as parcelas", async () => {
    renderPage()
    await screen.findByText("Carro")
    expect(await screen.findByText("1/3")).toBeInTheDocument()
    expect(listParcelasEmprestimo).toHaveBeenCalledWith("e3")
  })

  it("credor não-quitado vê 'Registrar pagamento'", async () => {
    renderPage()
    await screen.findByText("Carro")
    expect(screen.getByRole("button", { name: /Registrar pagamento/ })).toBeInTheDocument()
  })

  it("'Voltar' navega pra lista", async () => {
    renderPage()
    await screen.findByText("Carro")
    fireEvent.click(screen.getByRole("button", { name: /Voltar/ }))
    expect(navigateSpy).toHaveBeenCalledWith("/emprestimos")
  })
})
