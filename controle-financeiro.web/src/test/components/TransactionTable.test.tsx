import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import TransactionTable, { type TransactionRow } from "../../pages/Transactions/components/TransactionTable/TransactionTable"

// Serviços só são chamados em interações (compartilhar/rateio/excluir), não no
// mount — mockamos pra isolar o render da célula de data.
vi.mock("../../services/familiaService", () => ({
  getFamilias: vi.fn().mockResolvedValue([]),
  compartilharTransacao: vi.fn(),
  getDependentes: vi.fn().mockResolvedValue([]),
  atribuirDependente: vi.fn(),
  getRateioTransacao: vi.fn().mockResolvedValue({ modo: 1, itens: [] }),
  definirRateioTransacao: vi.fn(),
  removerRateioTransacao: vi.fn(),
}))
vi.mock("../../services/transactionService", () => ({ deleteTransaction: vi.fn() }))

const baseRow = (over: Partial<TransactionRow>): TransactionRow => ({
  id: over.id ?? "t1",
  descricao: over.descricao ?? "Lançamento",
  valor: 100,
  tipo: 1,
  data: "2026-05-20T00:00:00.000Z",
  statusTransacao: 1,
  ...over,
})

function renderRows(rows: TransactionRow[]) {
  render(<TransactionTable rows={rows} onRefresh={vi.fn()} notify={vi.fn()} />)
}

describe("TransactionTable — célula de data (status + origem)", () => {
  it("lançamento executado com hora mostra a hora", () => {
    renderRows([baseRow({ descricao: "Café", data: "2026-05-20T14:32:00.000Z" })])
    expect(screen.getByText("14:32")).toBeInTheDocument()
  })

  it("previsto mostra badge 'Previsto' e não a hora", () => {
    renderRows([baseRow({ descricao: "Salário", statusTransacao: 0, data: "2026-06-05T14:00:00.000Z" })])
    expect(screen.getByText("Previsto")).toBeInTheDocument()
    expect(screen.queryByText("14:00")).not.toBeInTheDocument()
  })

  it("recorrente sem hora mostra selo 'Recorrente'", () => {
    renderRows([baseRow({ descricao: "Netflix", recorrenteOrigemId: "r1" })])
    expect(screen.getByText("Recorrente")).toBeInTheDocument()
  })

  it("parcela mostra selo 'Parcelado'", () => {
    renderRows([baseRow({ descricao: "Geladeira", parcelamentoId: "p1" })])
    expect(screen.getByText("Parcelado")).toBeInTheDocument()
  })

  it("previsto tem prioridade sobre selo de origem", () => {
    renderRows([baseRow({ descricao: "Assinatura futura", statusTransacao: 0, recorrenteOrigemId: "r1" })])
    expect(screen.getByText("Previsto")).toBeInTheDocument()
    expect(screen.queryByText("Recorrente")).not.toBeInTheDocument()
  })
})
