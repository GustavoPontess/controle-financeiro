import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, waitFor } from "@testing-library/react"
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
