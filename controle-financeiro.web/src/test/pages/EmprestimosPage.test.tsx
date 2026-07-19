import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import EmprestimosPage from "../../pages/Emprestimos/EmprestimosPage"
import { StatusVinculoEmprestimo, type Emprestimo, type EmprestimoConvitePendente } from "../../types/Emprestimo"

vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ notify: vi.fn() }),
}))

const listEmprestimosPage = vi.fn()
const getEmprestimoStats = vi.fn()
const createEmprestimo = vi.fn()
const registrarPagamento = vi.fn()
const quitarEmprestimo = vi.fn()
const deleteEmprestimo = vi.fn()
const vincularEmprestimo = vi.fn()
const listConvitesPendentesEmprestimo = vi.fn()
const aceitarVinculoEmprestimoPorId = vi.fn()
const recusarVinculoEmprestimoPorId = vi.fn()
vi.mock("../../services/emprestimoService", () => ({
  listEmprestimosPage: (...a: unknown[]) => listEmprestimosPage(...a),
  getEmprestimoStats: (...a: unknown[]) => getEmprestimoStats(...a),
  getEmprestimos: () => Promise.resolve([]),
  createEmprestimo: (...a: unknown[]) => createEmprestimo(...a),
  registrarPagamento: (...a: unknown[]) => registrarPagamento(...a),
  quitarEmprestimo: (...a: unknown[]) => quitarEmprestimo(...a),
  deleteEmprestimo: (...a: unknown[]) => deleteEmprestimo(...a),
  vincularEmprestimo: (...a: unknown[]) => vincularEmprestimo(...a),
  listConvitesPendentesEmprestimo: (...a: unknown[]) => listConvitesPendentesEmprestimo(...a),
  aceitarVinculoEmprestimoPorId: (...a: unknown[]) => aceitarVinculoEmprestimoPorId(...a),
  recusarVinculoEmprestimoPorId: (...a: unknown[]) => recusarVinculoEmprestimoPorId(...a),
}))
const paged = <T,>(items: T[]) => ({
  items, total: items.length, page: 1, pageSize: 100, totalPages: 1,
})

const emp = {
  id: "e1", descricao: "Viagem", pessoa: "João", valorTotal: 1000, valorPago: 200,
  valorRestante: 800, percentualPago: 20, tipo: 1, quitado: false, vencido: false,
  dataInicio: "2026-04-01T00:00:00Z", dataVencimento: "2026-08-01T00:00:00Z",
  statusVinculo: StatusVinculoEmprestimo.SemVinculo, souCredor: true,
} as unknown as Emprestimo

const empVinculadoComoDevedor = {
  ...emp, id: "e2", descricao: "Aluguel", statusVinculo: StatusVinculoEmprestimo.Vinculado,
  souCredor: false, contraparteNome: "Gustavo",
} as unknown as Emprestimo

function renderPage() {
  return render(<PontesThemeProvider><EmprestimosPage /></PontesThemeProvider>)
}

describe("EmprestimosPage (#152)", () => {
  beforeEach(() => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([emp]))
    getEmprestimoStats.mockReset().mockResolvedValue({
      totalAReceber: 800, totalAPagar: 0, ativos: 1, qtdTotal: 1,
    })
    listConvitesPendentesEmprestimo.mockReset().mockResolvedValue([])
    createEmprestimo.mockReset().mockResolvedValue(undefined)
    registrarPagamento.mockReset().mockResolvedValue(undefined)
    quitarEmprestimo.mockReset().mockResolvedValue(undefined)
    deleteEmprestimo.mockReset().mockResolvedValue(undefined)
    vincularEmprestimo.mockReset()
    aceitarVinculoEmprestimoPorId.mockReset().mockResolvedValue(undefined)
    recusarVinculoEmprestimoPorId.mockReset().mockResolvedValue(undefined)
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

  it("envia idempotencyKey ao criar", async () => {
    renderPage()
    await screen.findByText("Viagem")
    fireEvent.click(screen.getByText("Novo Empréstimo"))
    await screen.findByText("Novo empréstimo")
    fireEvent.change(screen.getByPlaceholderText("Ex: Empréstimo para viagem"), { target: { value: "Teste" } })
    fireEvent.change(screen.getByPlaceholderText("Nome da pessoa"), { target: { value: "Fulano" } })
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "10000" } })
    fireEvent.click(screen.getByText("Criar empréstimo"))
    await screen.findByText("Viagem")
    expect(createEmprestimo).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    )
    const key = createEmprestimo.mock.calls[0][0].idempotencyKey
    expect(key.length).toBeGreaterThan(10)
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

  it("esconde pagamento/quitar quando não sou credor (devedor vinculado)", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([empVinculadoComoDevedor]))
    renderPage()
    await screen.findByText("Aluguel")
    expect(screen.queryByLabelText("Registrar pagamento")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Marcar como quitado")).not.toBeInTheDocument()
    expect(screen.getByText("Vinculado")).toBeInTheDocument()
    expect(screen.getByText("Gustavo")).toBeInTheDocument() // contraparteNome, não o texto livre
  })

  it("mostra pagamento/quitar quando sou credor", async () => {
    renderPage()
    await screen.findByText("Viagem")
    expect(screen.getByLabelText("Registrar pagamento")).toBeInTheDocument()
    expect(screen.getByLabelText("Marcar como quitado")).toBeInTheDocument()
  })

  it("abre modal de vincular e mostra o link retornado", async () => {
    vincularEmprestimo.mockResolvedValue({ linkConvite: "/convite/emprestimo/abc123" })
    renderPage()
    await screen.findByText("Viagem")
    fireEvent.click(screen.getByLabelText("Vincular a uma pessoa"))
    await screen.findByText("Vincular empréstimo")
    fireEvent.change(screen.getByPlaceholderText("nome@exemplo.com"), { target: { value: "fulano@teste.com" } })
    fireEvent.click(screen.getByText("Gerar convite"))
    expect(await screen.findByText("Copiar link")).toBeInTheDocument()
    expect(vincularEmprestimo).toHaveBeenCalledWith("e1", "fulano@teste.com")
  })

  it("valida e-mail vazio no vincular", async () => {
    renderPage()
    await screen.findByText("Viagem")
    fireEvent.click(screen.getByLabelText("Vincular a uma pessoa"))
    await screen.findByText("Vincular empréstimo")
    fireEvent.click(screen.getByText("Gerar convite"))
    expect(await screen.findByText("Informe um e-mail válido")).toBeInTheDocument()
    expect(vincularEmprestimo).not.toHaveBeenCalled()
  })

  it("não mostra botão de vincular pra quem já está vinculado", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([empVinculadoComoDevedor]))
    renderPage()
    await screen.findByText("Aluguel")
    expect(screen.queryByLabelText("Vincular a uma pessoa")).not.toBeInTheDocument()
  })

  it("lista convites pendentes e aceita", async () => {
    const pendente: EmprestimoConvitePendente = {
      emprestimoId: "p1", descricao: "Conta de luz", valorTotal: 300,
      credorOuDevedorNome: "Maria", tipoDescricao: "Peguei emprestado",
    }
    listConvitesPendentesEmprestimo.mockResolvedValue([pendente])
    renderPage()
    expect(await screen.findByText("1 convite de empréstimo pendente")).toBeInTheDocument()
    expect(screen.getByText(/Conta de luz/)).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText("Aceitar convite"))
    await screen.findByText("Viagem")
    expect(aceitarVinculoEmprestimoPorId).toHaveBeenCalledWith("p1")
  })

  it("recusa convite pendente", async () => {
    const pendente: EmprestimoConvitePendente = {
      emprestimoId: "p1", descricao: "Conta de luz", valorTotal: 300,
      credorOuDevedorNome: "Maria", tipoDescricao: "Peguei emprestado",
    }
    listConvitesPendentesEmprestimo.mockResolvedValue([pendente])
    renderPage()
    await screen.findByText(/Conta de luz/)
    fireEvent.click(screen.getByLabelText("Recusar convite"))
    await screen.findByText("Viagem")
    expect(recusarVinculoEmprestimoPorId).toHaveBeenCalledWith("p1")
  })
})
