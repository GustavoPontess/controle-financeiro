import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
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

const listar = vi.fn()
const criar = vi.fn()
const cancelar = vi.fn()
vi.mock("../../services/ParcelamentoService", () => ({
  ParcelamentoService: {
    listar: (...a: unknown[]) => listar(...a),
    criar: (...a: unknown[]) => criar(...a),
    cancelar: (...a: unknown[]) => cancelar(...a),
  },
}))
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
    listar.mockReset().mockResolvedValue([p1])
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
    listar.mockReset().mockResolvedValue([])
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
})
