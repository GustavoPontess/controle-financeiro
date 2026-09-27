import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
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
const getBancos = vi.fn()
vi.mock("../../services/bancoService", () => ({ getBancos: (...a: unknown[]) => getBancos(...a) }))

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
const bancos = [{ id: "b1", nome: "Banco Teste" }]
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
    // "Agora" fixo dentro do ciclo da fatura aberta (20/mai–20/jun) — torna
    // atualIdx determinístico e imune à data real do runner/CI (flake #84).
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-06-10T12:00:00Z").getTime())
    getCartoes.mockReset().mockResolvedValue([cartao])
    getFaturasByCartao.mockReset().mockResolvedValue([fatura])
    getFaturaDetalhe.mockReset().mockResolvedValue(detalhe)
    pagarFatura.mockReset().mockResolvedValue(undefined)
    getBancos.mockReset().mockResolvedValue(bancos)
    createCartao.mockReset().mockResolvedValue(cartao)
  })

  afterEach(() => {
    vi.restoreAllMocks()
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
    // Cartão único → auto-foco; aguarda fatura carregar (badge Aberta da atual).
    expect(await screen.findByText("Aberta")).toBeInTheDocument()
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

  it("escolhe bandeira por chip (Elo) e cadastra com os últimos 4 dígitos", async () => {
    renderPage()
    fireEvent.click(await screen.findByText("Novo Cartão"))
    await screen.findByText("Novo cartão")

    // Modalidade "Somente Débito" evita ter que preencher limite/dias (fora do escopo deste teste).
    fireEvent.click(screen.getByText("Crédito e Débito"))
    fireEvent.click(await screen.findByText("Somente Débito"))

    fireEvent.change(screen.getByPlaceholderText("Ex: Nubank Roxinho"), { target: { value: "Meu Elo" } })
    fireEvent.click(screen.getByTitle("Elo"))
    fireEvent.change(screen.getByPlaceholderText("0000"), { target: { value: "1234" } })
    fireEvent.click(await screen.findByText("Quem emitiu o cartão"))
    fireEvent.click(await screen.findByText("Banco Teste"))
    fireEvent.click(screen.getByText("Cadastrar"))

    await waitFor(() => expect(createCartao).toHaveBeenCalledTimes(1))
    const payload = createCartao.mock.calls[0][0]
    expect(payload).toMatchObject({ ultimosDigitos: "1234", bandeira: 3 }) // Elo
  })

  it("paga fatura: chama pagarFatura com conta, valor e Idempotency-Key", async () => {
    renderPage()
    // Cartão único → auto-foco; aguarda Pagar aparecer (fatura carregada).
    fireEvent.click(await screen.findByText("Pagar"))
    await screen.findByText("Pagar fatura")
    fireEvent.click(screen.getByText("Confirmar pagamento"))
    await waitFor(() => expect(pagarFatura).toHaveBeenCalledTimes(1))
    const [cartaoId, faturaId, payload, idemKey] = pagarFatura.mock.calls[0]
    expect(cartaoId).toBe("c1")
    expect(faturaId).toBe("f1")
    expect(payload).toMatchObject({ contaId: "a1", valor: 150 })
    // A API exige a chave (400 sem ela) — tem que ir preenchida.
    expect(idemKey).toEqual(expect.any(String))
    expect(idemKey).not.toBe("")
  })

  it("pagar fatura: retry reusa a mesma Idempotency-Key; reabrir o modal gera outra", async () => {
    // 1ª tentativa falha (ex.: rede caiu depois de o servidor pagar) → o retry TEM que mandar a
    // mesma chave, senão a API pagaria 2x.
    pagarFatura.mockReset()
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValue(undefined)
    renderPage()
    fireEvent.click(await screen.findByText("Pagar"))
    await screen.findByText("Pagar fatura")

    fireEvent.click(screen.getByText("Confirmar pagamento"))
    await waitFor(() => expect(pagarFatura).toHaveBeenCalledTimes(1))
    // Falhou → modal continua aberto; confirma de novo (retry).
    await waitFor(() => expect(screen.getByText("Confirmar pagamento")).not.toBeDisabled())
    fireEvent.click(screen.getByText("Confirmar pagamento"))
    await waitFor(() => expect(pagarFatura).toHaveBeenCalledTimes(2))
    expect(pagarFatura.mock.calls[1][3]).toBe(pagarFatura.mock.calls[0][3])

    // Sucesso fecha o modal; um NOVO pagamento (modal reaberto) é outra operação → outra chave.
    await waitFor(() => expect(screen.queryByText("Pagar fatura")).not.toBeInTheDocument())
    fireEvent.click(await screen.findByText("Pagar"))
    await screen.findByText("Pagar fatura")
    fireEvent.click(screen.getByText("Confirmar pagamento"))
    await waitFor(() => expect(pagarFatura).toHaveBeenCalledTimes(3))
    expect(pagarFatura.mock.calls[2][3]).not.toBe(pagarFatura.mock.calls[0][3])
  })

  it("cartão só com faturas FUTURAS abre no mês de hoje (vazio), não na fatura futura", async () => {
    // 27/set com fechamento dia 20 → o mês atual é o ciclo que fecha em OUTUBRO. O bug antigo
    // abria em Jan/2027 rotulado "atual" (caía na fatura mais recente por não ter uma cobrindo hoje).
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-09-27T12:00:00Z").getTime())
    getFaturasByCartao.mockReset().mockResolvedValue([
      { ...fatura, id: "dez", dataInicio: "2026-11-20", dataFechamento: "2026-12-20", dataVencimento: "2026-12-28" },
      { ...fatura, id: "jan", dataInicio: "2026-12-20", dataFechamento: "2027-01-20", dataVencimento: "2027-01-28" },
    ])
    renderPage()
    expect(await screen.findByText(/Outubro de 2026 · atual/)).toBeInTheDocument()
    expect(screen.getByText("Sem lançamentos neste mês.")).toBeInTheDocument()
    expect(screen.getByLabelText("Mês anterior")).toBeDisabled()
    // Pra frente: novembro (vazio) → dezembro (fatura real).
    fireEvent.click(screen.getByLabelText("Próximo mês"))
    expect(await screen.findByText("Novembro de 2026")).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("Próximo mês"))
    expect(await screen.findByText("Dezembro de 2026")).toBeInTheDocument()
  })

  it("anda pra trás até faturas passadas; mês sem fatura no meio aparece vazio", async () => {
    getFaturasByCartao.mockReset().mockResolvedValue([
      fatura, // jun/2026 — atual (agora = 10/jun)
      { ...fatura, id: "abr", dataInicio: "2026-03-20", dataFechamento: "2026-04-20", dataVencimento: "2026-04-28" },
    ])
    renderPage()
    expect(await screen.findByText(/Junho de 2026 · atual/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("Mês anterior"))
    expect(await screen.findByText("Maio de 2026")).toBeInTheDocument()
    expect(screen.getByText("Sem lançamentos neste mês.")).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("Mês anterior"))
    expect(await screen.findByText("Abril de 2026")).toBeInTheDocument()
    expect(screen.getByLabelText("Mês anterior")).toBeDisabled()
  })
})
