import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { PontesThemeProvider } from "../../components/pontes"
import ParcelamentoDetalhePage from "../../pages/Parcelamentos/[id]"
import type { ParcelamentoDetalhe } from "../../types/Parcelamento"

vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useParams: () => ({ id: "p1" }),
  useNavigate: () => vi.fn(),
  useOutletContext: () => ({ notify: vi.fn() }),
}))

// Parcela ANTIGA (criada antes da regra do mês de fechamento): DataVencimento = dia da compra (28/09),
// mas ela está na fatura que fecha 10/10 e vence 20/10. A tela mostrava "SET/2026 · 28/09"; Cartões
// mostra essa fatura como "Outubro". O detalhe tem que falar a língua de Cartões.
const detalhe = {
  id: "p1", descricao: "Geladeira", tipo: 0, dataCompra: "2026-09-28T00:00:00",
  cartaoCreditoId: "c1", cartaoCreditoNome: "Nubank", quantidadeParcelas: 2, parcelasPagas: 0,
  valorOriginal: 600, valorPago: 0, valorRestante: 600, ativo: true, criadoEm: "2026-09-28T12:00:00",
  proximaParcela: {
    id: "x1", numero: 1, dataVencimento: "2026-09-28T00:00:00", valor: 300, faturaId: "f1",
    faturaMesReferencia: "2026-10-10T00:00:00", faturaDataVencimento: "2026-10-20T00:00:00",
  },
  parcelas: [
    {
      id: "x1", numero: 1, quantidadeTotal: 2, dataVencimento: "2026-09-28T00:00:00", valor: 300, status: 0,
      faturaId: "f1", faturaMesReferencia: "2026-10-10T00:00:00", faturaDataVencimento: "2026-10-20T00:00:00",
    },
    {
      id: "x2", numero: 2, quantidadeTotal: 2, dataVencimento: "2026-10-28T00:00:00", valor: 300, status: 0,
      faturaId: "f2", faturaMesReferencia: "2026-11-10T00:00:00", faturaDataVencimento: "2026-11-20T00:00:00",
    },
  ],
} as unknown as ParcelamentoDetalhe

vi.mock("../../services/ParcelamentoService", () => ({
  ParcelamentoService: { obterDetalhe: () => Promise.resolve(detalhe) },
}))
vi.mock("../../services/contaService", () => ({ getContas: () => Promise.resolve([]) }))

describe("ParcelamentoDetalhePage — fatura da parcela", () => {
  it("mostra a fatura pelo mês de FECHAMENTO (rótulo de Cartões) e o vencimento real dela", async () => {
    render(
      <MemoryRouter>
        <PontesThemeProvider><ParcelamentoDetalhePage /></PontesThemeProvider>
      </MemoryRouter>
    )

    expect(await screen.findByText("Fatura Outubro de 2026")).toBeInTheDocument()

    const linhas = screen.getAllByRole("row").slice(1) // sem o cabeçalho
    expect(within(linhas[0]).getByText("Outubro de 2026")).toBeInTheDocument()
    expect(within(linhas[0]).getByText("20/10/2026")).toBeInTheDocument()
    expect(within(linhas[1]).getByText("Novembro de 2026")).toBeInTheDocument()
    expect(within(linhas[1]).getByText("20/11/2026")).toBeInTheDocument()
    expect(screen.queryByText("28/09/2026")).not.toBeInTheDocument()
    expect(screen.queryByText(/SET\/2026/)).not.toBeInTheDocument()
  })
})
