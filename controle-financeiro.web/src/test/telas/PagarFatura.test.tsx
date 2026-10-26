import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

vi.mock("../../services/cartaoCreditoService", () => ({
  getCartoes: vi.fn(async () => [{ id: "c1", nome: "Nubank", bandeira: 2, temCredito: true, temDebito: false, ehPrePago: false, contaId: "k1", ativo: true, diaFechamento: 1, diaVencimento: 8 }]),
}))
vi.mock("../../services/faturaService", () => ({
  getFaturasByCartao: vi.fn(async () => [{
    id: "f1", cartaoCreditoId: "c1", cartaoCreditoNome: "Nubank", dataInicio: "2026-10-02T00:00:00", dataFechamento: "2026-11-01T00:00:00",
    dataVencimento: "2026-11-08T00:00:00", status: 1, statusDescricao: "", estadoCiclo: 0, estadoPagamento: 1, estaAtrasada: false,
    valorTotal: 150, valorPago: 50, valorRestante: 100, vencida: false,
  }]),
  pagarFatura: vi.fn(),
}))
vi.mock("../../services/contaService", () => ({
  getContas: vi.fn(async () => [{ id: "k1", nome: "Conta Nubank", tipo: 1, tipoDescricao: "", saldoAtual: 500, isCarteira: false }]),
}))
import { pagarFatura } from "../../services/faturaService"
import PagarFatura from "../../telas/PagarFatura"

const renderizar = () => render(
  <MemoryRouter initialEntries={["/cartoes/c1/faturas/f1/pagar"]}>
    <Routes>
      <Route path="/cartoes/:id/faturas/:faturaId/pagar" element={<PagarFatura />} />
      <Route path="/cartoes/:id" element={<p>página do cartão</p>} />
    </Routes>
  </MemoryRouter>,
)
const botaoPagar = () => screen.getByRole("button", { name: /^Pagar R\$/ })

describe("PagarFatura", () => {
  beforeEach(() => vi.mocked(pagarFatura).mockReset())

  it("abre com o restante e a conta vinculada ao cartão", async () => {
    renderizar()
    expect(await screen.findByText("Como vai ficar")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("0,00")).toHaveValue("100,00")
    expect(screen.getByRole("combobox", { name: "Sai da conta" })).toHaveTextContent("Conta Nubank")
  })

  it("valor acima do restante bloqueia sem chamar o servidor", async () => {
    renderizar()
    const valor = await screen.findByPlaceholderText("0,00")
    await userEvent.clear(valor)
    await userEvent.type(valor, "20000")
    await userEvent.click(botaoPagar())
    expect(screen.getByText(/No máximo o restante/)).toBeInTheDocument()
    expect(pagarFatura).not.toHaveBeenCalled()
  })

  it("paga o restante e, no retry depois de erro, reusa a mesma chave (não paga 2x)", async () => {
    vi.mocked(pagarFatura)
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce(undefined)
    renderizar()
    await screen.findByText("Como vai ficar")
    await userEvent.click(botaoPagar())
    expect(await screen.findByRole("alert")).toBeInTheDocument()
    await userEvent.click(botaoPagar())
    expect(await screen.findByText("página do cartão")).toBeInTheDocument()

    expect(pagarFatura).toHaveBeenCalledTimes(2)
    const [primeira, segunda] = vi.mocked(pagarFatura).mock.calls
    expect(primeira[0]).toBe("c1")
    expect(primeira[1]).toBe("f1")
    expect(primeira[2]).toEqual(expect.objectContaining({ contaId: "k1", valor: 100, meioPagamento: 4 }))
    expect(primeira[3]).toBeTruthy()
    expect(segunda[3]).toBe(primeira[3])
  })
})
