import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import CreditCardsPage from "../../pages/CreditCards/CreditCardsPage"
import type { CartaoCredito } from "../../types/CartaoCredito"
import type { Conta } from "../../types/Conta"
import type { Fatura, FaturaDetalhe } from "../../types/Fatura"

vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ notify: vi.fn() }),
}))

const getCartoes = vi.fn()
const createCartao = vi.fn(); const updateCartao = vi.fn(); const deleteCartao = vi.fn()
vi.mock("../../services/cartaoCreditoService", () => ({
  getCartoes: (...a: unknown[]) => getCartoes(...a),
  createCartao: (...a: unknown[]) => createCartao(...a),
  updateCartao: (...a: unknown[]) => updateCartao(...a),
  deleteCartao: (...a: unknown[]) => deleteCartao(...a),
}))
vi.mock("../../services/contaService", () => ({ getContas: () => Promise.resolve(contas) }))
vi.mock("../../services/bancoService", () => ({ getBancos: () => Promise.resolve([]) }))

const getFaturasByCartao = vi.fn()
const getFaturaDetalhe = vi.fn()
const pagarFatura = vi.fn()
vi.mock("../../services/faturaService", () => ({
  getFaturasByCartao: (...a: unknown[]) => getFaturasByCartao(...a),
  getFaturaDetalhe: (...a: unknown[]) => getFaturaDetalhe(...a),
  pagarFatura: (...a: unknown[]) => pagarFatura(...a),
}))

const cartao = {
  id: "c1", nome: "Nubank", bandeira: 2, bandeiraDescricao: "Mastercard",
  temCredito: true, temDebito: false, ehPrePago: false, limite: 5000, gastosNoCicloAtual: 150,
  limiteDisponivel: 4850, diaFechamento: 20, diaVencimento: 28, contaId: "a1",
  contaNome: "Conta Corrente", ultimosDigitos: "4218",
} as unknown as CartaoCredito
const contas = [{ id: "a1", nome: "Conta Corrente", isCarteira: false }] as unknown as Conta[]
const fatura = {
  id: "f1", dataInicio: "2026-05-20", dataFechamento: "2026-06-20", dataVencimento: "2026-06-28",
  estadoCiclo: 0, estadoPagamento: 0, valorTotal: 150, valorPago: 0, valorRestante: 150, vencida: false,
} as unknown as Fatura
const detalhe = { transacoes: [] } as unknown as FaturaDetalhe

function renderPage() {
  return render(<PontesThemeProvider><CreditCardsPage /></PontesThemeProvider>)
}

describe("CreditCardsPage (#84)", () => {
  beforeEach(() => {
    getCartoes.mockReset().mockResolvedValue([cartao])
    getFaturasByCartao.mockReset().mockResolvedValue([fatura])
    getFaturaDetalhe.mockReset().mockResolvedValue(detalhe)
    pagarFatura.mockReset().mockResolvedValue(undefined)
  })

  it("lista cartão + stats e limite", async () => {
    renderPage()
    expect(await screen.findByText("Nubank")).toBeInTheDocument()
    expect(screen.getByText("Total de Cartões")).toBeInTheDocument()
    expect(screen.getByText(/R\$\s?4\.850,00/)).toBeInTheDocument() // disponível
  })

  it("abre faturas e mostra a fatura aberta", async () => {
    renderPage()
    await screen.findByText("Nubank")
    fireEvent.click(screen.getByLabelText("Ver faturas"))
    expect(await screen.findByText(/Faturas — Nubank/)).toBeInTheDocument()
    expect(screen.getByText("Aberta")).toBeInTheDocument()
  })

  it("paga fatura: chama pagarFatura com conta e valor", async () => {
    renderPage()
    await screen.findByText("Nubank")
    fireEvent.click(screen.getByLabelText("Ver faturas"))
    await screen.findByText(/Faturas — Nubank/)
    fireEvent.click(screen.getByLabelText("Pagar fatura"))
    await screen.findByText("Pagar fatura")
    fireEvent.click(screen.getByText("Confirmar pagamento"))
    await waitFor(() => expect(pagarFatura).toHaveBeenCalledTimes(1))
    const [cartaoId, faturaId, payload] = pagarFatura.mock.calls[0]
    expect(cartaoId).toBe("c1")
    expect(faturaId).toBe("f1")
    expect(payload).toMatchObject({ contaId: "a1", valor: 150 })
  })
})
