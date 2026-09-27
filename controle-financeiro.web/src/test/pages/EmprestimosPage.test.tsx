import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import EmprestimosPage from "../../pages/Emprestimos/EmprestimosPage"
import {
  StatusVinculoEmprestimo,
  type Emprestimo, type EmprestimoConvitePendente,
} from "../../types/Emprestimo"

// Tela real = ex-bancada B (promovida 2026-09-13): tabela enxuta (linha navega pro detalhe) +
// kebab slim (só gestão) + wizard de criação.
const navigateSpy = vi.hoisted(() => vi.fn())
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ notify: vi.fn() }),
  useNavigate: () => navigateSpy,
}))

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: { id: "me-1", nome: "Gustavo" } }),
}))

const listEmprestimosPage = vi.fn()
const getEmprestimoStats = vi.fn()
const createEmprestimo = vi.fn()
const quitarEmprestimo = vi.fn()
const deleteEmprestimo = vi.fn()
const arquivarEmprestimo = vi.fn()
const desarquivarEmprestimo = vi.fn()
const vincularEmprestimo = vi.fn()
const listConvitesPendentesEmprestimo = vi.fn()
const aceitarVinculoEmprestimoPorId = vi.fn()
const recusarVinculoEmprestimoPorId = vi.fn()
const solicitarPagamentoEmprestimo = vi.fn()
const listSolicitacoesPagamento = vi.fn()
const aprovarPagamentoEmprestimo = vi.fn()
const rejeitarPagamentoEmprestimo = vi.fn()
const reenviarPagamentoEmprestimo = vi.fn()
const listParcelasEmprestimo = vi.fn()
const listCandidatosConsolidacao = vi.fn()
const proporConsolidacao = vi.fn()
const listConsolidacoes = vi.fn()
const aceitarConsolidacao = vi.fn()
const recusarConsolidacao = vi.fn()
const cancelarConsolidacao = vi.fn()
vi.mock("../../services/emprestimoService", () => ({
  listEmprestimosPage: (...a: unknown[]) => listEmprestimosPage(...a),
  getEmprestimoStats: (...a: unknown[]) => getEmprestimoStats(...a),
  getEmprestimos: () => Promise.resolve([]),
  createEmprestimo: (...a: unknown[]) => createEmprestimo(...a),
  quitarEmprestimo: (...a: unknown[]) => quitarEmprestimo(...a),
  deleteEmprestimo: (...a: unknown[]) => deleteEmprestimo(...a),
  arquivarEmprestimo: (...a: unknown[]) => arquivarEmprestimo(...a),
  desarquivarEmprestimo: (...a: unknown[]) => desarquivarEmprestimo(...a),
  vincularEmprestimo: (...a: unknown[]) => vincularEmprestimo(...a),
  listConvitesPendentesEmprestimo: (...a: unknown[]) => listConvitesPendentesEmprestimo(...a),
  aceitarVinculoEmprestimoPorId: (...a: unknown[]) => aceitarVinculoEmprestimoPorId(...a),
  recusarVinculoEmprestimoPorId: (...a: unknown[]) => recusarVinculoEmprestimoPorId(...a),
  solicitarPagamentoEmprestimo: (...a: unknown[]) => solicitarPagamentoEmprestimo(...a),
  listSolicitacoesPagamento: (...a: unknown[]) => listSolicitacoesPagamento(...a),
  aprovarPagamentoEmprestimo: (...a: unknown[]) => aprovarPagamentoEmprestimo(...a),
  rejeitarPagamentoEmprestimo: (...a: unknown[]) => rejeitarPagamentoEmprestimo(...a),
  reenviarPagamentoEmprestimo: (...a: unknown[]) => reenviarPagamentoEmprestimo(...a),
  listParcelasEmprestimo: (...a: unknown[]) => listParcelasEmprestimo(...a),
  listCandidatosConsolidacao: (...a: unknown[]) => listCandidatosConsolidacao(...a),
  proporConsolidacao: (...a: unknown[]) => proporConsolidacao(...a),
  listConsolidacoes: (...a: unknown[]) => listConsolidacoes(...a),
  aceitarConsolidacao: (...a: unknown[]) => aceitarConsolidacao(...a),
  recusarConsolidacao: (...a: unknown[]) => recusarConsolidacao(...a),
  cancelarConsolidacao: (...a: unknown[]) => cancelarConsolidacao(...a),
}))
const getContas = vi.fn()
const getCategories = vi.fn()
const getBancos = vi.fn()
vi.mock("../../services/contaService", () => ({ getContas: (...a: unknown[]) => getContas(...a) }))
vi.mock("../../services/categoryService", () => ({ getCategories: (...a: unknown[]) => getCategories(...a) }))
vi.mock("../../services/bancoService", () => ({ getBancos: (...a: unknown[]) => getBancos(...a) }))
const listTransactionsPage = vi.fn()
vi.mock("../../services/transactionService", () => ({
  listTransactionsPage: (...a: unknown[]) => listTransactionsPage(...a),
}))
const paged = <T,>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 100, totalPages: 1 })

const emp = {
  id: "e1", descricao: "Viagem", pessoa: "João", valorTotal: 1000, valorPago: 200,
  valorRestante: 800, percentualPago: 20, valorPendente: 0, valorRecusado: 0,
  tipo: 1, quitado: false, vencido: false, formaPagamento: 1, origem: 1,
  dataInicio: "2026-04-01T00:00:00Z", dataVencimento: "2026-08-01T00:00:00Z",
  statusVinculo: StatusVinculoEmprestimo.SemVinculo, souCredor: true,
} as unknown as Emprestimo

const empDevedorVinculado = {
  ...emp, id: "e2", descricao: "Aluguel", statusVinculo: StatusVinculoEmprestimo.Vinculado,
  souCredor: false, contraparteNome: "Gustavo", tipo: 2,
} as unknown as Emprestimo

const empParcelado = {
  ...emp, id: "e3", descricao: "Carro", formaPagamento: 2, quantidadeParcelas: 3,
} as unknown as Emprestimo

const empQuitado = {
  ...emp, id: "e7", descricao: "Fiança", quitado: true, valorRestante: 0, percentualPago: 100,
  arquivado: false,
} as unknown as Emprestimo

const empBancario = {
  ...emp, id: "e8", descricao: "Financiamento carro", tipo: 2, valorRestante: 12000,
  bancoId: "b1", bancoNome: "NU Pagamentos", bancoLogoUrl: undefined, bancoCor: "#820AD1",
} as unknown as Emprestimo

function renderPage() {
  return render(<PontesThemeProvider><EmprestimosPage /></PontesThemeProvider>)
}

// Abre o menu kebab (⋮) de uma linha e devolve foco pro item clicável.
function abrirAcoes() {
  const kebabs = screen.getAllByLabelText("Ações")
  fireEvent.click(kebabs[0])
}

describe("EmprestimosPage (tela real ex-bancada B)", () => {
  beforeEach(() => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([emp]))
    getEmprestimoStats.mockReset().mockResolvedValue({
      totalAReceber: 800, totalAPagar: 0, ativos: 1, qtdTotal: 1, totalAReceberVencido: 0,
    })
    listConvitesPendentesEmprestimo.mockReset().mockResolvedValue([])
    createEmprestimo.mockReset().mockResolvedValue(undefined)
    quitarEmprestimo.mockReset().mockResolvedValue(undefined)
    deleteEmprestimo.mockReset().mockResolvedValue(undefined)
    arquivarEmprestimo.mockReset().mockResolvedValue(undefined)
    desarquivarEmprestimo.mockReset().mockResolvedValue(undefined)
    vincularEmprestimo.mockReset()
    aceitarVinculoEmprestimoPorId.mockReset().mockResolvedValue(undefined)
    recusarVinculoEmprestimoPorId.mockReset().mockResolvedValue(undefined)
    getContas.mockReset().mockResolvedValue([])
    getCategories.mockReset().mockResolvedValue([])
    getBancos.mockReset().mockResolvedValue([{ id: "b1", nome: "NU Pagamentos", ativo: true }])
    listTransactionsPage.mockReset().mockResolvedValue(paged([]))
    solicitarPagamentoEmprestimo.mockReset().mockResolvedValue([])
    listSolicitacoesPagamento.mockReset().mockResolvedValue([])
    aprovarPagamentoEmprestimo.mockReset()
    rejeitarPagamentoEmprestimo.mockReset()
    listCandidatosConsolidacao.mockReset().mockResolvedValue([])
    proporConsolidacao.mockReset()
    listConsolidacoes.mockReset().mockResolvedValue([])
    aceitarConsolidacao.mockReset()
    recusarConsolidacao.mockReset()
    cancelarConsolidacao.mockReset()
    reenviarPagamentoEmprestimo.mockReset()
    listParcelasEmprestimo.mockReset().mockResolvedValue([])
    navigateSpy.mockReset()
  })

  it("lista empréstimos + hero (A receber / A pagar)", async () => {
    renderPage()
    expect(await screen.findByText("Viagem")).toBeInTheDocument()
    expect(screen.getAllByText("A receber").length).toBeGreaterThan(0)
    expect(screen.getAllByText("A pagar").length).toBeGreaterThan(0)
    expect(screen.getAllByText(/R\$\s?800,00/).length).toBeGreaterThan(0)
  })

  it("empty state sem empréstimos", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([]))
    renderPage()
    expect(await screen.findByText("Nenhum empréstimo encontrado.")).toBeInTheDocument()
  })

  it("wizard bloqueia avançar com passo Básico vazio (descrição/pessoa/valor)", async () => {
    renderPage()
    await screen.findByText("Viagem")
    fireEvent.click(screen.getByRole("button", { name: "Novo empréstimo" }))
    await screen.findByText("Com quem é o empréstimo?")
    fireEvent.click(screen.getByText("Continuar"))
    expect(await screen.findByText("Informe a descrição")).toBeInTheDocument()
    expect(screen.getByText(/Informe pra quem emprestou|Informe de quem pegou/)).toBeInTheDocument()
    expect(screen.getByText("Informe o valor")).toBeInTheDocument()
    expect(createEmprestimo).not.toHaveBeenCalled()
  })

  it("modalidade banco: esconde Tipo e Pessoa, exige Banco", async () => {
    renderPage()
    await screen.findByText("Viagem")
    fireEvent.click(screen.getByRole("button", { name: "Novo empréstimo" }))
    await screen.findByText("Com quem é o empréstimo?")

    // pessoa (default): mostra Tipo + Pessoa
    expect(screen.getByText("Tipo")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Nome da pessoa")).toBeInTheDocument()

    fireEvent.click(screen.getByText("Um banco"))
    // banco: some Tipo e Pessoa, aparece Banco
    expect(screen.queryByText("Tipo")).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText("Nome da pessoa")).not.toBeInTheDocument()
    expect(screen.getByText("Banco")).toBeInTheDocument()
  })

  it("cria empréstimo P2P à vista enviando idempotencyKey", async () => {
    renderPage()
    await screen.findByText("Viagem")
    fireEvent.click(screen.getByRole("button", { name: "Novo empréstimo" }))
    await screen.findByText("Com quem é o empréstimo?")
    // passo Básico
    fireEvent.change(screen.getByPlaceholderText("Ex: Empréstimo para viagem"), { target: { value: "Teste" } })
    fireEvent.change(screen.getByPlaceholderText("Nome da pessoa"), { target: { value: "Fulano" } })
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "10000" } })
    fireEvent.click(screen.getByText("Continuar")) // -> Condições
    fireEvent.click(await screen.findByText("Continuar")) // -> Movimentação
    fireEvent.click(await screen.findByText("Ainda não — é só o combinado, nada pra lançar agora"))
    fireEvent.click(screen.getByText("Criar empréstimo"))
    await waitFor(() => expect(createEmprestimo).toHaveBeenCalled())
    expect(createEmprestimo).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: expect.any(String), pessoa: "Fulano" }),
    )
  })

  it("filtro de direção 'A pagar' recarrega server-side com direcao=pagar", async () => {
    renderPage()
    await screen.findByText("Viagem")
    fireEvent.click(screen.getByRole("tab", { name: "A pagar" }))
    await waitFor(() => {
      const ultima = listEmprestimosPage.mock.calls.at(-1)
      expect(ultima?.[4]).toBe("pagar")
    })
  })

  it("toggle 'Arquivados' recarrega server-side com mostrarArquivados=true", async () => {
    renderPage()
    await screen.findByText("Viagem")
    fireEvent.click(screen.getByRole("button", { name: /Arquivados/ }))
    await waitFor(() => {
      const ultima = listEmprestimosPage.mock.calls.at(-1)
      expect(ultima?.[2]).toBe(true)
    })
  })

  it("lista: kebab é slim (só gestão) — ações ricas vão pro detalhe", async () => {
    renderPage()
    await screen.findByText("Viagem")
    abrirAcoes()
    expect(await screen.findByText("Remover")).toBeInTheDocument()
    expect(screen.queryByText("Registrar pagamento")).not.toBeInTheDocument()
    expect(screen.queryByText("Marcar como quitado")).not.toBeInTheDocument()
    expect(screen.queryByText("Vincular a uma pessoa")).not.toBeInTheDocument()
    expect(screen.queryByText(/Ver parcelas|Ver detalhe/)).not.toBeInTheDocument()
  })

  it("clicar na linha navega pro detalhe do empréstimo", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([empParcelado]))
    renderPage()
    await screen.findByText("Carro")
    fireEvent.click(screen.getByText("Carro"))
    expect(navigateSpy).toHaveBeenCalledWith("/emprestimos/e3")
  })

  it("devedor vinculado: badge Vinculado na linha + kebab slim sem quitar", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([empDevedorVinculado]))
    renderPage()
    await screen.findByText("Aluguel")
    expect(screen.getByText("Vinculado")).toBeInTheDocument()
    abrirAcoes()
    expect(await screen.findByText("Remover")).toBeInTheDocument()
    expect(screen.queryByText("Registrar pagamento")).not.toBeInTheDocument()
    expect(screen.queryByText("Marcar como quitado")).not.toBeInTheDocument()
  })

  it("quitado: kebab tem Arquivar e dispara o service", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([empQuitado]))
    renderPage()
    await screen.findByText("Fiança")
    abrirAcoes()
    fireEvent.click(await screen.findByText("Arquivar"))
    await waitFor(() => expect(arquivarEmprestimo).toHaveBeenCalledWith("e7"))
  })

  it("empréstimo bancário mostra o banco na coluna Pessoa", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([empBancario]))
    renderPage()
    await screen.findByText("Financiamento carro")
    expect(screen.getByText("NU Pagamentos")).toBeInTheDocument()
  })

  it("lista convite pendente e aceita", async () => {
    const pendente: EmprestimoConvitePendente = {
      emprestimoId: "p1", descricao: "Conta de luz", valorTotal: 300,
      credorOuDevedorNome: "Maria", tipoDescricao: "Peguei emprestado",
    }
    listConvitesPendentesEmprestimo.mockResolvedValue([pendente])
    renderPage()
    expect(await screen.findByText(/Conta de luz/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("Aceitar"))
    await waitFor(() => expect(aceitarVinculoEmprestimoPorId).toHaveBeenCalledWith("p1"))
  })

  it("candidato a consolidação: botão Consolidar abre o wizard", async () => {
    listCandidatosConsolidacao.mockReset().mockResolvedValue([{
      contraparteUsuarioId: "ana-1", contraparteNome: "Ana",
      itens: [
        { emprestimoOriginalId: "e1", descricao: "Móveis", valorRestanteSnapshot: 500 },
        { emprestimoOriginalId: "e2", descricao: "Aluguel", valorRestanteSnapshot: 300 },
      ],
    }])
    renderPage()
    await screen.findByText("Viagem")
    fireEvent.click(await screen.findByRole("button", { name: "Consolidar" }))
    expect(await screen.findByText("Propor consolidação")).toBeInTheDocument()
  })
})
