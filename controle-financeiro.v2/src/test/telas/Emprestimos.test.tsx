import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import type { Emprestimo, ProximosEmprestimos } from "../../types/Emprestimo"

const emp = (extra: Partial<Emprestimo>): Emprestimo => ({
  id: "e1", descricao: "Conserto do carro", pessoa: "João", valorTotal: 1800, valorPago: 0, valorRestante: 1800, percentualPago: 0,
  valorPendente: 0, valorRecusado: 0, tipo: 1, tipoDescricao: "Emprestei", dataInicio: "2026-09-20T12:00:00Z", quitado: false,
  vencido: false, statusVinculo: 0, origem: 1, souCredor: true, formaPagamento: 2, quantidadeParcelas: 6, arquivado: false, ...extra,
})
let itens: Emprestimo[] = []
const proximos: ProximosEmprestimos = {
  resposta: { tom: "alerta", texto: "Nos próximos 30 dias você devolve R$ 600,00, e o saldo nas contas hoje é R$ 380,00: faltam R$ 220,00.", acoes: [] },
  devolver: [{ emprestimoId: "e3", quem: "Ana", descricao: "Notebook", data: "2099-11-15", valor: 600, venceu: false, parcela: null, deParcelas: null }],
  voltar: [{ emprestimoId: "e1", quem: "João", descricao: "Conserto", data: "2099-10-25", valor: 300, venceu: false, parcela: 1, deParcelas: 6 }],
  saldoNasContas: 380,
}
vi.mock("../../services/emprestimoService", () => ({
  listEmprestimosPage: vi.fn(async () => ({ items: itens, total: itens.length })),
  getEmprestimoStats: vi.fn(async () => ({ totalAReceber: 2200, totalAPagar: 600, ativos: 3, qtdTotal: 3, totalAReceberVencido: 400, totalAPagarVencido: 0 })),
  getProximosEmprestimos: vi.fn(async () => proximos),
  listSolicitacoesPagamentoPendentes: vi.fn(async () => [{
    id: "s1", emprestimoId: "e3", valor: 100, statusAprovacao: 1, statusAprovacaoDescricao: "Pendente", solicitadoPor: "u2", solicitadoPorNome: "Ana",
    criadoEm: "2026-10-18T12:00:00Z", comprovanteData: "2026-10-18", registradoPeloCredor: false,
  }]),
  listConvitesPendentesEmprestimo: vi.fn(async () => [{ emprestimoId: "e9", descricao: "Ingresso", valorTotal: 250, credorOuDevedorNome: "Pedro", tipoDescricao: "Emprestei" }]),
  listParcelasEmprestimo: vi.fn(async () => [
    { id: "p1", emprestimoId: "e1", numero: 1, quantidadeTotal: 2, dataVencimento: "2026-10-25T12:00:00Z", valor: 900, status: 2, statusDescricao: "Paga", valorPago: 900, atrasada: false },
    { id: "p2", emprestimoId: "e1", numero: 2, quantidadeTotal: 2, dataVencimento: "2026-11-25T12:00:00Z", valor: 900, status: 1, statusDescricao: "Pendente", valorPago: 0, atrasada: false },
  ]),
  rejeitarPagamentoEmprestimo: vi.fn(async () => {}),
  aceitarVinculoEmprestimoPorId: vi.fn(async () => {}),
  recusarVinculoEmprestimoPorId: vi.fn(async () => {}),
  quitarEmprestimo: vi.fn(async () => {}),
  deleteEmprestimo: vi.fn(async () => {}),
  arquivarEmprestimo: vi.fn(async () => {}),
  createEmprestimo: vi.fn(async () => emp({ id: "novo" })),
}))
vi.mock("../../services/contaService", () => ({ getContas: vi.fn(async () => [{ id: "k1", nome: "Nubank", tipo: 1, tipoDescricao: "", saldoAtual: 500, isCarteira: false }]) }))
vi.mock("../../services/categoryService", () => ({ getCategories: vi.fn(async () => [{ id: "c1", descricao: "Empréstimos", finalidade: 3, isPadrao: false }]) }))
vi.mock("../../services/bancoService", () => ({ getBancos: vi.fn(async () => []) }))
import { aceitarVinculoEmprestimoPorId, createEmprestimo, rejeitarPagamentoEmprestimo } from "../../services/emprestimoService"
import Emprestimos from "../../telas/Emprestimos"
import EmprestimoFormulario from "../../telas/EmprestimoFormulario"

const Onde = () => <p>em {useLocation().pathname}</p>
const renderizar = (inicio = "/emprestimos") => render(
  <MemoryRouter initialEntries={[inicio]}>
    <Routes>
      <Route path="/emprestimos" element={<Emprestimos />} />
      <Route path="/emprestimos/novo" element={<EmprestimoFormulario />} />
      <Route path="*" element={<Onde />} />
    </Routes>
  </MemoryRouter>,
)

describe("Empréstimos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    itens = [
      emp({}),
      emp({ id: "e2", pessoa: "Marina", descricao: "Passagem", valorTotal: 400, valorRestante: 400, formaPagamento: 1, quantidadeParcelas: undefined, vencido: true }),
      emp({ id: "e3", pessoa: "Ana", descricao: "Notebook", tipo: 2, valorTotal: 600, valorRestante: 600, formaPagamento: 1, quantidadeParcelas: undefined, souCredor: true, valorPendente: 100 }),
    ]
  })

  it("números, a resposta dos 30 dias com os dois lados, e a lista em Você emprestou / Você pegou com o que falta", async () => {
    renderizar()
    expect(await screen.findByText(/você devolve R\$\s600,00, e o saldo nas contas hoje é R\$\s380,00/)).toBeInTheDocument()
    expect(screen.getByText("Você devolve")).toBeInTheDocument()
    expect(screen.getByText("Volta pra você")).toBeInTheDocument()
    expect(screen.getByText("Emprestei · falta voltar").nextSibling).toHaveTextContent("2.200,00")
    const emprestou = screen.getByRole("list", { name: "Você emprestou" })
    expect(within(emprestou).getAllByRole("button").map((b) => b.textContent)).toEqual([
      expect.stringContaining("João"), expect.stringContaining("Marina"),
    ])
    const pegou = screen.getByRole("list", { name: "Você pegou" })
    expect(within(pegou).getByRole("button")).toHaveTextContent(/Ana.*R\$\s100,00 pra você confirmar/)
    // Sem palavra de cobrança na tela.
    expect(document.body.textContent).not.toMatch(/deve|dívida|cobrar|a receber|a pagar/i)
  })

  it("a ficha mostra o que falta, as parcelas (voltou / vence) e as ações", async () => {
    renderizar()
    await userEvent.click(await screen.findByRole("button", { name: /João/ }))
    expect(await screen.findByText("Falta voltar")).toBeInTheDocument()
    const parcelas = await screen.findByRole("list", { name: "Parcelas" })
    expect(within(parcelas).getAllByRole("listitem").map((li) => li.textContent?.replace(/ /g, " "))).toEqual([
      "1 de 2voltouR$ 900,00", "2 de 2vence 25/11R$ 900,00",
    ])
    expect(screen.getByRole("button", { name: "Registrar o que voltou" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Convidar João" })).toBeInTheDocument()
  })

  it("Pra responder: não recebi recusa o pagamento; aceitar o convite chama o servidor", async () => {
    renderizar()
    expect(await screen.findByText(/Ana registrou que passou/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Não recebi" }))
    expect(rejeitarPagamentoEmprestimo).toHaveBeenCalledWith("s1")
    await userEvent.click(screen.getByRole("button", { name: "Aceitar" }))
    expect(aceitarVinculoEmprestimoPorId).toHaveBeenCalledWith("e9")
  })

  it("novo: vazio bloqueia com erro em cada campo; preenchido manda juros com vírgula como número", async () => {
    renderizar("/emprestimos/novo")
    await userEvent.click(await screen.findByRole("button", { name: "Adicionar" }))
    expect(screen.getByText("Diga pra quem emprestou.")).toBeInTheDocument()
    expect(screen.getByText("Diga quanto.")).toBeInTheDocument()
    expect(createEmprestimo).not.toHaveBeenCalled()

    await userEvent.type(screen.getByPlaceholderText("João"), "Bruno")
    await userEvent.type(screen.getByPlaceholderText("0,00"), "25000")
    await userEvent.type(screen.getAllByPlaceholderText("0")[0], "2,5,9")
    expect(screen.getAllByPlaceholderText("0")[0]).toHaveValue("2,59")
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }))
    expect(createEmprestimo).toHaveBeenCalledWith(expect.objectContaining({ pessoa: "Bruno", valorTotal: 250, tipo: 1, taxaJuroMensal: 2.59 }))
    expect(await screen.findByRole("radio", { name: "Em andamento" })).toBeInTheDocument() // voltou pra lista
  })
})
