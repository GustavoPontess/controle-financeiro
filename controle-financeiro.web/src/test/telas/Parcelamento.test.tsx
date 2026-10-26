import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

const parcela = (numero: number, status: number) => ({
  id: `p${numero}`, numero, quantidadeTotal: 3, dataVencimento: "2026-11-08T00:00:00", valor: 100, status, faturaId: `f${numero}`,
  faturaMesReferencia: "2026-11-01T00:00:00", faturaDataVencimento: "2026-11-08T00:00:00",
})
vi.mock("../../services/ParcelamentoService", () => ({
  ParcelamentoService: {
    obterDetalhe: vi.fn(async () => ({
      id: "pc1", descricao: "Notebook", tipo: 0, dataCompra: "2026-09-10T00:00:00", cartaoCreditoId: "c1", cartaoCreditoNome: "Nubank",
      quantidadeParcelas: 3, parcelasPagas: 1, parcelasPagasAntes: 0, valorPagoAntes: 0, valorOriginal: 300, valorPago: 100,
      valorRestante: 200, ativo: true, criadoEm: "2026-09-10T00:00:00",
      parcelas: [parcela(1, 1), parcela(2, 0), parcela(3, 0)],
    })),
    cancelar: vi.fn(),
    cancelarParcela: vi.fn(),
  },
}))
import { ParcelamentoService } from "../../services/ParcelamentoService"
import Parcelamento from "../../telas/Parcelamento"

const renderizar = () => render(
  <MemoryRouter initialEntries={["/cartoes/c1/parcelamentos/pc1"]}>
    <Routes><Route path="/cartoes/:id/parcelamentos/:pid" element={<Parcelamento />} /></Routes>
  </MemoryRouter>,
)

describe("Parcelamento", () => {
  beforeEach(() => vi.mocked(ParcelamentoService.cancelar).mockReset())

  it("só parcela pendente tem ações", async () => {
    renderizar()
    await screen.findByText("Notebook")
    expect(screen.queryByRole("button", { name: "Ações da parcela 1" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ações da parcela 2" })).toBeInTheDocument()
  })

  it("cancelar o parcelamento exige motivo e manda a chave de idempotência", async () => {
    vi.mocked(ParcelamentoService.cancelar).mockResolvedValue({} as never)
    renderizar()
    await screen.findByText("Notebook")
    await userEvent.click(screen.getByRole("button", { name: "Cancelar parcelamento" }))
    const dialogo = screen.getByRole("alertdialog")
    expect(within(dialogo).getByRole("button", { name: "Manter parcelamento" })).toBeInTheDocument()

    await userEvent.click(within(dialogo).getByRole("button", { name: "Cancelar parcelamento" }))
    expect(within(dialogo).getByText(/Diga o motivo/)).toBeInTheDocument()
    expect(ParcelamentoService.cancelar).not.toHaveBeenCalled()

    await userEvent.type(within(dialogo).getByPlaceholderText("Compra devolvida"), "Devolvi o notebook")
    await userEvent.click(within(dialogo).getByRole("button", { name: "Cancelar parcelamento" }))
    expect(ParcelamentoService.cancelar).toHaveBeenCalledWith("pc1", expect.objectContaining({
      motivo: "Devolvi o notebook", idempotencyKey: expect.any(String),
    }))
  })
})
