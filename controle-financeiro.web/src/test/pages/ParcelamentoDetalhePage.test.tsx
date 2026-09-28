import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import ParcelamentoDetalhePage from "../../pages/Parcelamentos/[id]"

vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useParams: () => ({ id: "p1" }),
  useNavigate: () => vi.fn(),
  useOutletContext: () => ({ notify: vi.fn() }),
}))

const obterDetalhe = vi.fn()
vi.mock("../../services/ParcelamentoService", () => ({
  ParcelamentoService: {
    obterDetalhe: (...a: unknown[]) => obterDetalhe(...a),
    pagarParcelaAntecipado: vi.fn(),
    cancelar: vi.fn(),
  },
}))
vi.mock("../../services/contaService", () => ({ getContas: () => Promise.resolve([]) }))

const base = {
  id: "p1", descricao: "Livro", tipo: 0, quantidadeParcelas: 2, parcelasPagas: 1,
  valorOriginal: 200, valorPago: 100, valorRestante: 0, ativo: true,
  parcelas: [
    { id: "x1", numero: 1, quantidadeTotal: 2, dataVencimento: "2026-09-28T00:00:00", valor: 100, status: 1, pagoEm: "2026-09-28T00:00:00" },
    { id: "x2", numero: 2, quantidadeTotal: 2, dataVencimento: "2026-10-28T00:00:00", valor: 100, status: 2 },
  ],
}

function renderPage() {
  return render(<PontesThemeProvider><ParcelamentoDetalhePage /></PontesThemeProvider>)
}

describe("ParcelamentoDetalhePage — cancelado", () => {
  beforeEach(() => obterDetalhe.mockReset())

  it("cancelado: aviso com data e motivo, selo 'Cancelado' e sem botão de cancelar de novo", async () => {
    obterDetalhe.mockResolvedValue({
      ...base, ativo: false, canceladoEm: "2026-09-28T15:00:00", motivoCancelamento: "Devolvido",
    })
    renderPage()
    expect(await screen.findByText("Parcelamento cancelado:")).toBeInTheDocument()
    expect(screen.getByText(/em 28\/09\/2026 · Devolvido/)).toBeInTheDocument()
    expect(screen.getByText("Cancelado")).toBeInTheDocument()
    expect(screen.queryByText("Cancelar Parcelamento")).not.toBeInTheDocument()
  })

  it("ativo: sem aviso, com o botão de cancelar", async () => {
    obterDetalhe.mockResolvedValue(base)
    renderPage()
    expect(await screen.findByText("Cancelar Parcelamento")).toBeInTheDocument()
    expect(screen.queryByText("Parcelamento cancelado:")).not.toBeInTheDocument()
  })
})
