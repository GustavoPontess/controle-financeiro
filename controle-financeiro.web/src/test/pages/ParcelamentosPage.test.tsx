import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { PontesThemeProvider } from "../../components/pontes"
import ParcelamentosPage from "../../pages/Parcelamentos/index"
import type { Parcelamento } from "../../types/Parcelamento"
import type { CartaoCredito } from "../../types/CartaoCredito"

vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ notify: vi.fn() }),
  useNavigate: () => vi.fn(),
}))

const listarPaginado = vi.fn()
const obterStats = vi.fn().mockResolvedValue({ ativos: 1, totalRestante: 2400, qtdTotal: 1 })
const criar = vi.fn()
const cancelar = vi.fn()
vi.mock("../../services/ParcelamentoService", () => ({
  ParcelamentoService: {
    listarPaginado: (...a: unknown[]) => listarPaginado(...a),
    obterStats: (...a: unknown[]) => obterStats(...a),
    listar: () => Promise.resolve([]),
    criar: (...a: unknown[]) => criar(...a),
    cancelar: (...a: unknown[]) => cancelar(...a),
  },
}))
const paged = <T,>(items: T[]) => ({
  items, total: items.length, page: 1, pageSize: 100, totalPages: 1,
})
vi.mock("../../services/cartaoCreditoService", () => ({
  getCartoes: () => Promise.resolve(cartoes),
}))

const cartoes = [
  { id: "c1", nome: "Nubank", temCredito: true },
] as unknown as CartaoCredito[]

const p1 = {
  id: "p1", descricao: "Notebook", valorOriginal: 3000, valorPago: 600,
  valorRestante: 2400, quantidadeParcelas: 10, parcelasPagas: 2,
  tipo: 0, ativo: true,
  proximaParcela: { dataVencimento: "2026-06-15T00:00:00Z", valor: 300 },
} as unknown as Parcelamento

function renderPage() {
  return render(
    <MemoryRouter>
      <PontesThemeProvider><ParcelamentosPage /></PontesThemeProvider>
    </MemoryRouter>
  )
}

describe("ParcelamentosPage (#153)", () => {
  beforeEach(() => {
    listarPaginado.mockReset().mockResolvedValue(paged([p1]))
    criar.mockReset().mockResolvedValue(undefined)
    cancelar.mockReset().mockResolvedValue(undefined)
  })

  it("lista parcelamentos + stats", async () => {
    renderPage()
    expect(await screen.findByText("Notebook")).toBeInTheDocument()
    expect(screen.getByText("Ativos")).toBeInTheDocument()
    expect(screen.getByText("A pagar")).toBeInTheDocument()
  })

  it("empty state", async () => {
    listarPaginado.mockReset().mockResolvedValue(paged([]))
    renderPage()
    expect(await screen.findByText("Nenhum parcelamento cadastrado")).toBeInTheDocument()
  })

  it("valida form vazio (descrição, valor, cartão)", async () => {
    renderPage()
    await screen.findByText("Notebook")
    fireEvent.click(screen.getByText("Novo Parcelamento"))
    await screen.findByText("Novo parcelamento")
    fireEvent.click(screen.getByText("Criar"))
    expect(await screen.findByText("Informe a descrição")).toBeInTheDocument()
    expect(screen.getByText("Informe o valor")).toBeInTheDocument()
    expect(screen.getAllByText("Selecione o cartão").length).toBeGreaterThan(0)
    expect(criar).not.toHaveBeenCalled()
  })

  // Regressão do 409: o form mandava `taxaJuroMensal: 0` INCONDICIONAL, e o backend rejeita
  // qualquer taxa fora de PIX Crédito → criar Compra Parcelada era impossível pela UI.
  // O mock antigo aceitava qualquer payload e nunca conferia — por isso passava batido.
  it("Compra Parcelada NÃO envia taxaJuroMensal (regressão do 409)", async () => {
    renderPage()
    await screen.findByText("Notebook")
    fireEvent.click(screen.getByText("Novo Parcelamento"))
    await screen.findByText("Novo parcelamento")

    fireEvent.change(screen.getByPlaceholderText("Ex: Notebook, Monitor"), { target: { value: "Geladeira" } })
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "300000" } })
    fireEvent.click(screen.getByText("Selecione o cartão"))
    fireEvent.click(await screen.findByText("Nubank"))
    fireEvent.click(screen.getByText("Criar"))

    await waitFor(() => expect(criar).toHaveBeenCalledTimes(1))
    const payload = criar.mock.calls[0][0] as { tipo: number; taxaJuroMensal?: number }
    expect(payload.tipo).toBe(0)                     // CompraParcelada
    expect(payload.taxaJuroMensal).toBeUndefined()   // não manda 0 → não dispara 409
  })

  it("PIX Crédito continua enviando a taxaJuroMensal informada", async () => {
    renderPage()
    await screen.findByText("Notebook")
    fireEvent.click(screen.getByText("Novo Parcelamento"))
    await screen.findByText("Novo parcelamento")

    fireEvent.change(screen.getByPlaceholderText("Ex: Notebook, Monitor"), { target: { value: "PIX compra" } })
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "300000" } })
    fireEvent.click(screen.getByText("Selecione o cartão"))
    fireEvent.click(await screen.findByText("Nubank"))

    // Tipo → PIX Crédito. O 1º "Compra Parcelada" é o badge do card; o trigger do select é o último.
    const triggers = screen.getAllByText("Compra Parcelada")
    fireEvent.click(triggers[triggers.length - 1])
    fireEvent.click(await screen.findByText("PIX Crédito"))

    // Campo de taxa aparece: 2º spinbutton (o 1º é Parcelas).
    const spins = screen.getAllByRole("spinbutton")
    fireEvent.change(spins[spins.length - 1], { target: { value: "2.5" } })
    fireEvent.click(screen.getByText("Criar"))

    await waitFor(() => expect(criar).toHaveBeenCalledTimes(1))
    const payload = criar.mock.calls[0][0] as { tipo: number; taxaJuroMensal?: number }
    expect(payload.tipo).toBe(1)                 // PIXCredito
    expect(payload.taxaJuroMensal).toBe(2.5)
  })
})
