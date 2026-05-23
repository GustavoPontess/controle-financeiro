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

// Fixtures pros 3 estados de status (statusKey): aberta parcial, fechada quitada, fechada com saldo.
const fAbertaParcial = {
  id: "fo", dataInicio: "2026-05-20", dataFechamento: "2026-06-20", dataVencimento: "2026-06-28",
  estadoCiclo: 0, estadoPagamento: 1, valorTotal: 130, valorPago: 50, valorRestante: 80, vencida: false,
} as unknown as Fatura
const fFechadaPaga = {
  id: "fp", dataInicio: "2026-04-20", dataFechamento: "2026-05-20", dataVencimento: "2026-05-28",
  estadoCiclo: 1, estadoPagamento: 2, valorTotal: 300, valorPago: 300, valorRestante: 0, vencida: false,
} as unknown as Fatura
const fFechadaComSaldo = {
  id: "fd", dataInicio: "2026-03-20", dataFechamento: "2026-04-20", dataVencimento: "2026-04-28",
  estadoCiclo: 1, estadoPagamento: 0, valorTotal: 200, valorPago: 0, valorRestante: 200, vencida: false,
} as unknown as Fatura

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

  it("lista cartão + resumo e limite", async () => {
    renderPage()
    expect(await screen.findByText("Nubank")).toBeInTheDocument()
    expect(screen.getByText("Limite total")).toBeInTheDocument()
    expect(screen.getAllByText(/R\$\s?4\.850,00/).length).toBeGreaterThan(0) // disponível
  })

  it("abre faturas (clica no card) e destaca a fatura atual", async () => {
    renderPage()
    fireEvent.click(await screen.findByText("Nubank"))
    expect(await screen.findByText("Todos os cartões")).toBeInTheDocument()
    expect(screen.getByText(/· atual/)).toBeInTheDocument()
    expect(screen.getByText("Aberta")).toBeInTheDocument()
  })

  it("status: aberta parcial NÃO vira Paga; fechada quitada = Paga; fechada com saldo = Fechada", async () => {
    getFaturasByCartao.mockReset().mockResolvedValue([fAbertaParcial, fFechadaPaga, fFechadaComSaldo])
    renderPage()
    fireEvent.click(await screen.findByText("Nubank"))
    await screen.findByText("Todos os cartões")
    // Mês atual: aberta com pagamento parcial → "Aberta" (NÃO "Paga")
    expect(screen.getByText("Aberta")).toBeInTheDocument()
    expect(screen.getByText(/Pago R\$\s?50,00 de R\$\s?130,00/)).toBeInTheDocument()
    expect(screen.queryByText("Paga")).not.toBeInTheDocument()
    // Mês anterior: fatura fechada e quitada → "Paga"
    fireEvent.click(screen.getByLabelText("Mês anterior"))
    expect(await screen.findByText("Paga")).toBeInTheDocument()
    // Mês anterior: fatura fechada com saldo → "Fechada"
    fireEvent.click(screen.getByLabelText("Mês anterior"))
    expect(await screen.findByText("Fechada")).toBeInTheDocument()
  })

  it("valida form: submit sem nome bloqueia e mostra erro", async () => {
    renderPage()
    fireEvent.click(await screen.findByText("Novo Cartão"))
    await screen.findByText("Novo cartão")
    fireEvent.click(screen.getByText("Cadastrar"))
    expect(await screen.findByText("Informe o nome do cartão")).toBeInTheDocument()
    expect(createCartao).not.toHaveBeenCalled()
  })

  it("últimos dígitos aceita só números", async () => {
    renderPage()
    fireEvent.click(await screen.findByText("Novo Cartão"))
    await screen.findByText("Novo cartão")
    const input = screen.getByPlaceholderText("0000") as HTMLInputElement
    fireEvent.change(input, { target: { value: "ab12cd34xy" } })
    expect(input.value).toBe("1234")
  })

  it("paga fatura: chama pagarFatura com conta e valor", async () => {
    renderPage()
    fireEvent.click(await screen.findByText("Nubank"))
    await screen.findByText("Todos os cartões")
    fireEvent.click(screen.getByText("Pagar"))
    await screen.findByText("Pagar fatura")
    fireEvent.click(screen.getByText("Confirmar pagamento"))
    await waitFor(() => expect(pagarFatura).toHaveBeenCalledTimes(1))
    const [cartaoId, faturaId, payload] = pagarFatura.mock.calls[0]
    expect(cartaoId).toBe("c1")
    expect(faturaId).toBe("f1")
    expect(payload).toMatchObject({ contaId: "a1", valor: 150 })
  })
})
