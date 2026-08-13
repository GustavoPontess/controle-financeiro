import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import EmprestimosPage from "../../pages/Emprestimos/EmprestimosPage"
import {
  StatusVinculoEmprestimo, StatusAprovacaoPagamentoEmprestimo,
  type Emprestimo, type EmprestimoConvitePendente, type EmprestimoPagamentoSolicitacao,
} from "../../types/Emprestimo"

vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ notify: vi.fn() }),
}))

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: { id: "me-1", nome: "Gustavo" } }),
}))

const listEmprestimosPage = vi.fn()
const getEmprestimoStats = vi.fn()
const createEmprestimo = vi.fn()
const quitarEmprestimo = vi.fn()
const deleteEmprestimo = vi.fn()
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
vi.mock("../../services/emprestimoService", () => ({
  listEmprestimosPage: (...a: unknown[]) => listEmprestimosPage(...a),
  getEmprestimoStats: (...a: unknown[]) => getEmprestimoStats(...a),
  getEmprestimos: () => Promise.resolve([]),
  createEmprestimo: (...a: unknown[]) => createEmprestimo(...a),
  quitarEmprestimo: (...a: unknown[]) => quitarEmprestimo(...a),
  deleteEmprestimo: (...a: unknown[]) => deleteEmprestimo(...a),
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
}))
const getContas = vi.fn()
const getCategories = vi.fn()
vi.mock("../../services/contaService", () => ({
  getContas: (...a: unknown[]) => getContas(...a),
}))
vi.mock("../../services/categoryService", () => ({
  getCategories: (...a: unknown[]) => getCategories(...a),
}))
const listTransactionsPage = vi.fn()
vi.mock("../../services/transactionService", () => ({
  listTransactionsPage: (...a: unknown[]) => listTransactionsPage(...a),
}))
const paged = <T,>(items: T[]) => ({
  items, total: items.length, page: 1, pageSize: 100, totalPages: 1,
})

const emp = {
  id: "e1", descricao: "Viagem", pessoa: "João", valorTotal: 1000, valorPago: 200,
  valorRestante: 800, percentualPago: 20, valorPendente: 0, valorRecusado: 0,
  tipo: 1, quitado: false, vencido: false,
  dataInicio: "2026-04-01T00:00:00Z", dataVencimento: "2026-08-01T00:00:00Z",
  statusVinculo: StatusVinculoEmprestimo.SemVinculo, souCredor: true,
} as unknown as Emprestimo

const empVinculadoComoDevedor = {
  ...emp, id: "e2", descricao: "Aluguel", statusVinculo: StatusVinculoEmprestimo.Vinculado,
  souCredor: false, contraparteNome: "Gustavo",
} as unknown as Emprestimo

const empParcelado = {
  ...emp, id: "e3", descricao: "Carro", formaPagamento: 2, quantidadeParcelas: 3,
} as unknown as Emprestimo

const empParceladoDevedor = {
  ...empVinculadoComoDevedor, id: "e4", descricao: "Financiamento", formaPagamento: 2, quantidadeParcelas: 2,
} as unknown as Emprestimo

const empVinculadoComoCredor = {
  ...emp, id: "e5", descricao: "Casa", statusVinculo: StatusVinculoEmprestimo.Vinculado,
  souCredor: true, contraparteNome: "Ana",
} as unknown as Emprestimo

function renderPage() {
  return render(<PontesThemeProvider><EmprestimosPage /></PontesThemeProvider>)
}

describe("EmprestimosPage (#152)", () => {
  beforeEach(() => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([emp]))
    getEmprestimoStats.mockReset().mockResolvedValue({
      totalAReceber: 800, totalAPagar: 0, ativos: 1, qtdTotal: 1, totalAReceberVencido: 0,
    })
    listConvitesPendentesEmprestimo.mockReset().mockResolvedValue([])
    createEmprestimo.mockReset().mockResolvedValue(undefined)
    quitarEmprestimo.mockReset().mockResolvedValue(undefined)
    deleteEmprestimo.mockReset().mockResolvedValue(undefined)
    vincularEmprestimo.mockReset()
    aceitarVinculoEmprestimoPorId.mockReset().mockResolvedValue(undefined)
    recusarVinculoEmprestimoPorId.mockReset().mockResolvedValue(undefined)
    getContas.mockReset().mockResolvedValue([])
    getCategories.mockReset().mockResolvedValue([])
    listTransactionsPage.mockReset().mockResolvedValue(paged([]))
    solicitarPagamentoEmprestimo.mockReset().mockResolvedValue([])
    listSolicitacoesPagamento.mockReset().mockResolvedValue([])
    aprovarPagamentoEmprestimo.mockReset()
    rejeitarPagamentoEmprestimo.mockReset()
    reenviarPagamentoEmprestimo.mockReset()
    listParcelasEmprestimo.mockReset().mockResolvedValue([])
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
    fireEvent.click(screen.getByText("Ainda não — é só o combinado, nada pra lançar agora"))
    fireEvent.click(screen.getByText("Criar empréstimo"))
    await screen.findByText("Viagem")
    expect(createEmprestimo).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    )
    const key = createEmprestimo.mock.calls[0][0].idempotencyKey
    expect(key.length).toBeGreaterThan(10)
  })

  it("registrar pagamento sem escolher opção bloqueia (credor)", async () => {
    renderPage()
    await screen.findByText("Viagem")
    fireEvent.click(screen.getByLabelText("Registrar pagamento"))
    await screen.findByText("Como registrar esse recebimento?")
    fireEvent.click(screen.getByText("Confirmar recebimento"))
    expect(await screen.findByText("Escolha uma opção")).toBeInTheDocument()
    expect(solicitarPagamentoEmprestimo).not.toHaveBeenCalled()
  })

  it("devedor vinculado vê Registrar pagamento (unificado) mas não Marcar como quitado", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([empVinculadoComoDevedor]))
    renderPage()
    await screen.findByText("Aluguel")
    expect(screen.getByLabelText("Registrar pagamento")).toBeInTheDocument()
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

  it("devedor vinculado bloqueia registrar pagamento sem escolher opção", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([empVinculadoComoDevedor]))
    renderPage()
    await screen.findByText("Aluguel")
    fireEvent.click(screen.getByLabelText("Registrar pagamento"))
    await screen.findByText("Como comprovar esse pagamento?")

    fireEvent.click(screen.getByText("Enviar pra aprovação"))
    expect(await screen.findByText("Escolha uma opção")).toBeInTheDocument()
    expect(solicitarPagamentoEmprestimo).not.toHaveBeenCalled()
  })

  it("devedor escolhe 'lançar agora' e valida conta faltando", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([empVinculadoComoDevedor]))
    renderPage()
    await screen.findByText("Aluguel")
    fireEvent.click(screen.getByLabelText("Registrar pagamento"))
    await screen.findByText("Como comprovar esse pagamento?")

    fireEvent.click(screen.getByText("Ainda não lancei — lançar agora"))
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "5000" } })
    fireEvent.click(screen.getByText("Enviar pra aprovação"))
    expect(await screen.findByText("Escolha a conta")).toBeInTheDocument()
    expect(solicitarPagamentoEmprestimo).not.toHaveBeenCalled()
  })

  it("registrar pagamento de parcelado cobrindo várias parcelas — mensagem reflete a quantidade", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([empParceladoDevedor]))
    solicitarPagamentoEmprestimo.mockResolvedValue([
      { id: "s1", emprestimoId: "e4", valor: 100, statusAprovacao: 1, statusAprovacaoDescricao: "Pendente", solicitadoPor: "u1", solicitadoPorNome: "Eu", criadoEm: "2026-08-12T00:00:00Z", comprovanteData: "2026-08-12T00:00:00Z", registradoPeloCredor: false, parcelaId: "pa1" },
      { id: "s2", emprestimoId: "e4", valor: 100, statusAprovacao: 1, statusAprovacaoDescricao: "Pendente", solicitadoPor: "u1", solicitadoPorNome: "Eu", criadoEm: "2026-08-12T00:00:00Z", comprovanteData: "2026-08-12T00:00:00Z", registradoPeloCredor: false, parcelaId: "pa2" },
    ] satisfies EmprestimoPagamentoSolicitacao[])
    getContas.mockResolvedValue([{ id: "c1", nome: "Carteira" }])
    getCategories.mockResolvedValue([{ id: "cat1", descricao: "Outros", finalidade: 1 }])
    renderPage()
    await screen.findByText("Financiamento")
    fireEvent.click(screen.getByLabelText("Registrar pagamento"))
    await screen.findByText("Como comprovar esse pagamento?")

    fireEvent.click(screen.getByText("Ainda não lancei — lançar agora"))
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "20000" } })
    fireEvent.click(screen.getAllByText("Selecione")[0]) // conta
    fireEvent.click(await screen.findByText("Carteira"))
    fireEvent.click(screen.getByText("Selecione")) // categoria
    fireEvent.click(await screen.findByText("Outros"))
    fireEvent.click(screen.getByText("Enviar pra aprovação"))

    await waitFor(() => expect(solicitarPagamentoEmprestimo).toHaveBeenCalled())
    const [, payload] = solicitarPagamentoEmprestimo.mock.calls[0]
    expect(payload).not.toHaveProperty("parcelaId")
    expect(payload).toMatchObject({ valor: 200 })
    // modal fecha só depois do sucesso (loadData é chamado em seguida)
    await waitFor(() => expect(screen.queryByText("Como comprovar esse pagamento?")).not.toBeInTheDocument())
  })

  it("credor abre histórico, bloqueia aprovação sem escolher opção e aprova criando entrada", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([empVinculadoComoCredor]))
    const pendente: EmprestimoPagamentoSolicitacao = {
      id: "sol1", emprestimoId: "e5", valor: 150,
      statusAprovacao: StatusAprovacaoPagamentoEmprestimo.Pendente, statusAprovacaoDescricao: "Pendente",
      solicitadoPor: "outro-1", solicitadoPorNome: "Ana", criadoEm: "2026-07-01T00:00:00Z",
      comprovanteData: "2026-07-01T00:00:00Z", registradoPeloCredor: false,
    }
    listSolicitacoesPagamento.mockResolvedValue([pendente])
    aprovarPagamentoEmprestimo.mockResolvedValue(undefined)
    getContas.mockResolvedValue([{ id: "c1", nome: "Carteira" }])
    getCategories.mockResolvedValue([{ id: "cat1", descricao: "Outros", finalidade: 3 }])
    renderPage()
    await screen.findByText("Casa")

    fireEvent.click(screen.getByLabelText("Ver histórico de pagamentos"))
    await screen.findByText("Histórico de pagamentos")

    fireEvent.click(screen.getByLabelText("Aprovar pagamento"))
    await screen.findByText("Aprovar pagamento")

    fireEvent.click(screen.getByText("Confirmar recebimento"))
    expect(await screen.findByText("Escolha uma opção")).toBeInTheDocument()
    expect(aprovarPagamentoEmprestimo).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText("Ainda não registrei — registrar agora"))
    fireEvent.click(screen.getAllByText("Selecione")[0])
    fireEvent.click(await screen.findByText("Carteira"))
    fireEvent.click(screen.getByText("Selecione"))
    fireEvent.click(await screen.findByText("Outros"))
    fireEvent.click(screen.getByText("Confirmar recebimento"))

    expect(aprovarPagamentoEmprestimo).toHaveBeenCalledWith("sol1", {
      contaId: "c1", categoriaId: "cat1", transacaoExistenteId: undefined,
    })
  })

  it("credor rejeita pagamento pendente sem motivo, a partir do histórico", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([empVinculadoComoCredor]))
    const pendente: EmprestimoPagamentoSolicitacao = {
      id: "sol1", emprestimoId: "e5", valor: 150,
      statusAprovacao: StatusAprovacaoPagamentoEmprestimo.Pendente, statusAprovacaoDescricao: "Pendente",
      solicitadoPor: "outro-1", solicitadoPorNome: "Ana", criadoEm: "2026-07-01T00:00:00Z",
      comprovanteData: "2026-07-01T00:00:00Z", registradoPeloCredor: false,
    }
    listSolicitacoesPagamento.mockResolvedValue([pendente])
    rejeitarPagamentoEmprestimo.mockResolvedValue(undefined)
    renderPage()
    await screen.findByText("Casa")

    fireEvent.click(screen.getByLabelText("Ver histórico de pagamentos"))
    await screen.findByText("Histórico de pagamentos")
    fireEvent.click(screen.getByLabelText("Rejeitar pagamento"))
    await screen.findByText("Rejeitar pagamento")
    fireEvent.click(screen.getByText("Rejeitar"))

    expect(rejeitarPagamentoEmprestimo).toHaveBeenCalledWith("sol1", undefined)
  })

  it("credor rejeita pagamento pendente informando motivo, a partir do histórico", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([empVinculadoComoCredor]))
    const pendente: EmprestimoPagamentoSolicitacao = {
      id: "sol1", emprestimoId: "e5", valor: 150,
      statusAprovacao: StatusAprovacaoPagamentoEmprestimo.Pendente, statusAprovacaoDescricao: "Pendente",
      solicitadoPor: "outro-1", solicitadoPorNome: "Ana", criadoEm: "2026-07-01T00:00:00Z",
      comprovanteData: "2026-07-01T00:00:00Z", registradoPeloCredor: false,
    }
    listSolicitacoesPagamento.mockResolvedValue([pendente])
    rejeitarPagamentoEmprestimo.mockResolvedValue(undefined)
    renderPage()
    await screen.findByText("Casa")

    fireEvent.click(screen.getByLabelText("Ver histórico de pagamentos"))
    await screen.findByText("Histórico de pagamentos")
    fireEvent.click(screen.getByLabelText("Rejeitar pagamento"))
    await screen.findByText("Rejeitar pagamento")
    fireEvent.change(screen.getByPlaceholderText("Ex: valor não bate com o combinado"), {
      target: { value: "Valor errado" },
    })
    fireEvent.click(screen.getByText("Rejeitar"))

    expect(rejeitarPagamentoEmprestimo).toHaveBeenCalledWith("sol1", "Valor errado")
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

  // ── Forma de pagamento — parcelas (docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md) ──

  it("valida quantidade de parcelas e vencimento quando parcelado", async () => {
    renderPage()
    await screen.findByText("Viagem")
    fireEvent.click(screen.getByText("Novo Empréstimo"))
    await screen.findByText("Novo empréstimo")

    fireEvent.click(screen.getByRole("button", { name: "À vista" }))
    fireEvent.click(await screen.findByText("Parcelado"))

    fireEvent.click(screen.getByText("Criar empréstimo"))
    expect(await screen.findByText("Entre 2 e 36 parcelas")).toBeInTheDocument()
    expect(screen.getByText("Informe o vencimento da 1ª parcela")).toBeInTheDocument()
    expect(createEmprestimo).not.toHaveBeenCalled()
  })

  it("expande empréstimo parcelado e mostra as parcelas", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([empParcelado]))
    listParcelasEmprestimo.mockResolvedValue([{
      id: "pa1", emprestimoId: "e3", numero: 1, quantidadeTotal: 3,
      dataVencimento: "2026-09-01T00:00:00Z", valor: 100,
      status: 1, statusDescricao: "Pendente", atrasada: false,
    }])
    renderPage()
    await screen.findByText("Carro")
    expect(screen.getByText("Parcelado 3x")).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText("Ver parcelas"))
    expect(await screen.findByText("1/3")).toBeInTheDocument()
    expect(listParcelasEmprestimo).toHaveBeenCalledWith("e3")
  })

  it("parcela com solicitação pendente mostra aprovar/rejeitar direto na linha, sem precisar expandir", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([empParcelado]))
    listParcelasEmprestimo.mockResolvedValue([{
      id: "pa1", emprestimoId: "e3", numero: 1, quantidadeTotal: 3,
      dataVencimento: "2026-09-01T00:00:00Z", valor: 100,
      status: 1, statusDescricao: "Pendente", atrasada: false,
      solicitacaoPendenteId: "sol-1",
    }])
    renderPage()
    await screen.findByText("Carro")

    fireEvent.click(screen.getByLabelText("Ver parcelas"))
    await screen.findByText("1/3")

    fireEvent.click(screen.getByLabelText("Aprovar pagamento"))
    expect(await screen.findByText("Como registrar essa entrada?")).toBeInTheDocument()
  })

  it("parcela com adiantamento parcial mostra quanto já foi pago, sem virar Paga", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([empParcelado]))
    listParcelasEmprestimo.mockResolvedValue([{
      id: "pa1", emprestimoId: "e3", numero: 1, quantidadeTotal: 3,
      dataVencimento: "2026-09-01T00:00:00Z", valor: 100,
      status: 1, statusDescricao: "Pendente", atrasada: false, valorPago: 30,
    }])
    renderPage()
    await screen.findByText("Carro")

    fireEvent.click(screen.getByLabelText("Ver parcelas"))
    expect(await screen.findByText(/R\$\s?30,00 de R\$\s?100,00 pago/)).toBeInTheDocument()
  })

  it("aprovar pela parcela recarrega a lista — badge 'Aguardando aprovação' some (achado: ficava preso)", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([empParcelado]))
    listParcelasEmprestimo
      .mockResolvedValueOnce([{
        id: "pa1", emprestimoId: "e3", numero: 1, quantidadeTotal: 3,
        dataVencimento: "2026-09-01T00:00:00Z", valor: 100,
        status: 1, statusDescricao: "Pendente", atrasada: false,
        solicitacaoPendenteId: "sol-1",
      }])
      .mockResolvedValueOnce([{
        id: "pa1", emprestimoId: "e3", numero: 1, quantidadeTotal: 3,
        dataVencimento: "2026-09-01T00:00:00Z", valor: 100,
        status: 2, statusDescricao: "Paga", atrasada: false,
      }])
    aprovarPagamentoEmprestimo.mockResolvedValue(undefined)
    getContas.mockResolvedValue([{ id: "c1", nome: "Carteira" }])
    getCategories.mockResolvedValue([{ id: "cat1", descricao: "Outros", finalidade: 3 }])
    renderPage()
    await screen.findByText("Carro")

    fireEvent.click(screen.getByLabelText("Ver parcelas"))
    await screen.findByText("Aguardando aprovação")

    fireEvent.click(screen.getByLabelText("Aprovar pagamento"))
    await screen.findByText("Como registrar essa entrada?")
    fireEvent.click(screen.getByText("Ainda não registrei — registrar agora"))
    fireEvent.click(screen.getAllByText("Selecione")[0])
    fireEvent.click(await screen.findByText("Carteira"))
    fireEvent.click(screen.getByText("Selecione"))
    fireEvent.click(await screen.findByText("Outros"))
    fireEvent.click(screen.getByText("Confirmar recebimento"))

    await waitFor(() => expect(listParcelasEmprestimo).toHaveBeenCalledTimes(2))
    expect(await screen.findByText("Paga")).toBeInTheDocument()
    expect(screen.queryByText("Aguardando aprovação")).not.toBeInTheDocument()
  })

  it("clicar na parcela abre o histórico dela inline, embaixo da própria linha (não modal)", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([empParcelado]))
    listParcelasEmprestimo.mockResolvedValue([{
      id: "pa1", emprestimoId: "e3", numero: 1, quantidadeTotal: 3,
      dataVencimento: "2026-09-01T00:00:00Z", valor: 100,
      status: 2, statusDescricao: "Paga", atrasada: false,
    }, {
      id: "pa2", emprestimoId: "e3", numero: 2, quantidadeTotal: 3,
      dataVencimento: "2026-10-01T00:00:00Z", valor: 100,
      status: 1, statusDescricao: "Pendente", atrasada: false,
    }])
    listSolicitacoesPagamento.mockResolvedValue([
      {
        id: "sol-pa1", emprestimoId: "e3", valor: 100, parcelaId: "pa1",
        statusAprovacao: StatusAprovacaoPagamentoEmprestimo.Aprovada, statusAprovacaoDescricao: "Aprovada",
        solicitadoPor: "outro-1", solicitadoPorNome: "Ana", criadoEm: "2026-08-01T00:00:00Z",
        comprovanteData: "2026-08-01T00:00:00Z", registradoPeloCredor: false,
      } satisfies EmprestimoPagamentoSolicitacao,
    ])
    renderPage()
    await screen.findByText("Carro")

    fireEvent.click(screen.getByLabelText("Ver parcelas"))
    await screen.findByText("1/3")
    expect(screen.queryByText("Histórico de pagamentos")).not.toBeInTheDocument()

    fireEvent.click(screen.getByText("1/3"))

    expect(await screen.findByText("Ana", { exact: false })).toBeInTheDocument()
    // não é modal — não tem título "Histórico de pagamentos" nem botão Fechar
    expect(screen.queryByText("Histórico de pagamentos")).not.toBeInTheDocument()
    expect(screen.queryByText("Fechar")).not.toBeInTheDocument()

    // clicar de novo recolhe
    fireEvent.click(screen.getByText("1/3"))
    expect(screen.queryByText("Ana", { exact: false })).not.toBeInTheDocument()
  })

  it("registrar pagamento de parcelado não pede pra escolher parcela — valor aplica em sequência", async () => {
    listEmprestimosPage.mockReset().mockResolvedValue(paged([empParceladoDevedor]))
    renderPage()
    await screen.findByText("Financiamento")

    fireEvent.click(screen.getByLabelText("Registrar pagamento"))
    await screen.findByText("Como comprovar esse pagamento?")
    expect(screen.queryByText("Qual parcela isso quita?")).not.toBeInTheDocument()
    expect(screen.getByText(/cobrir mais de uma parcela/)).toBeInTheDocument()

    fireEvent.click(screen.getByText("Enviar pra aprovação"))
    expect(await screen.findByText("Escolha uma opção")).toBeInTheDocument()
    expect(solicitarPagamentoEmprestimo).not.toHaveBeenCalled()
  })

  it("empréstimo à vista mostra badge 'À vista'", async () => {
    renderPage()
    expect(await screen.findByText("À vista")).toBeInTheDocument()
  })
})
