import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

vi.mock("../../services/transactionService", () => ({
  listTransactionsPage: vi.fn(async () => ({ items: [], total: 0 })),
  getTransactionStats: vi.fn(async () => ({ entradasCaixa: 0, saidasCaixa: 0 })),
}))
vi.mock("../../services/contaService", () => ({ getContas: vi.fn(async () => []) }))
vi.mock("../../services/categoryService", () => ({ getCategories: vi.fn(async () => []) }))
import { listTransactionsPage } from "../../services/transactionService"
import Transacoes from "../../telas/Transacoes"
import { dataLocalISO, diaSeguinte } from "../../utils/dateTime"
import { linhaDoLancamento } from "../../dominio/linhaLancamento"

const abrir = (filtros?: object) => render(
  <MemoryRouter initialEntries={[{ pathname: "/transacoes", state: filtros ? { filtros } : null }]}><Transacoes /></MemoryRouter>,
)
const ultimaChamada = () => vi.mocked(listTransactionsPage).mock.calls.at(-1)![2]

describe("Transações: ordem da lista", () => {
  beforeEach(() => vi.clearAllMocks())

  it("sem período, vai até hoje com o mais recente em cima (previsões futuras não empurram hoje pro fim)", async () => {
    abrir()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenCalled())
    expect(ultimaChamada()).toMatchObject({ to: diaSeguinte(dataLocalISO()), ordenacao: undefined })
  })

  it("filtrando os previstos, mostra todos, do mais perto pro mais longe", async () => {
    abrir({ status: "0" })
    await waitFor(() => expect(listTransactionsPage).toHaveBeenCalled())
    expect(ultimaChamada()).toMatchObject({ to: undefined, ordenacao: "data_asc", status: 0 })
  })

  it("com período escolhido, respeita as datas", async () => {
    abrir({ de: "2026-12-01", ate: "2026-12-31" })
    await waitFor(() => expect(listTransactionsPage).toHaveBeenCalled())
    expect(ultimaChamada()).toMatchObject({ from: "2026-12-01", to: "2027-01-01", ordenacao: undefined })
  })
})

describe("Transações: visões Saldo e Gastos", () => {
  beforeEach(() => { vi.clearAllMocks(); try { localStorage.clear() } catch { /* sem armazenamento */ } })

  it("Saldo (padrão) é o extrato de caixa; Gastos pede a visão do servidor, sem caixa e sem tipo de lançamento", async () => {
    abrir({ natureza: "fatura" })
    await waitFor(() => expect(listTransactionsPage).toHaveBeenCalled())
    expect(ultimaChamada()).toMatchObject({ apenasCaixa: true, visao: undefined, natureza: "fatura" })

    fireEvent.click(screen.getByRole("radio", { name: "Gastos" }))
    await waitFor(() => expect(ultimaChamada()).toMatchObject({ apenasCaixa: false, visao: "gastos", natureza: undefined }))

    fireEvent.click(screen.getByRole("button", { name: /Filtros/ }))
    expect(screen.queryByText("Tipo de lançamento")).toBeNull()
  })

  it("compra parcelada vira uma linha com o total, '5x de', o cartão e abre o parcelamento", () => {
    const linha = linhaDoLancamento({
      id: "p1", descricao: "Geladeira", valor: 1500, tipo: 1, categoriaId: "c1", data: "2026-10-19",
      cartaoCreditoId: "nubank", cartaoCreditoNome: "Nubank", ehCompraParcelada: true, parcelas: 5, valorParcela: 300,
      meioPagamentoDescricao: "Crédito", statusTransacao: 1,
    }, "Casa")
    expect(linha.para).toBe("/cartoes/nubank/parcelamentos/p1")
    expect(linha.estado).toEqual({ voltarPara: "/transacoes" })
    expect(linha.sub?.replace(/ /g, " ")).toBe("Nubank · Casa · 5x de R$ 300,00")
    expect(linha.valor).toBe(1500)
  })
})

describe("Transações: dinheiro de empréstimo", () => {
  it("leva a etiqueta Empréstimo (mexe no saldo, fora do mês)", () => {
    const linha = linhaDoLancamento({
      id: "t1", descricao: "Empréstimo: Conserto do carro", valor: 1800, tipo: 1, categoriaId: "c1", data: "2026-10-19",
      contaNome: "Itaú", ehEmprestimo: true, statusTransacao: 1,
    })
    render(<>{linha.etiqueta}</>)
    expect(screen.getByText("Empréstimo")).toBeInTheDocument()
  })
})
