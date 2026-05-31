import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import ReportsPage from "../../pages/Reports/ReportsPage"
import type { RelatorioData } from "../../types/Relatorio"

// recharts não rende em jsdom (largura 0) — stub pra isolar a lógica/markup.
vi.mock("recharts", () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    ResponsiveContainer: Stub, AreaChart: Stub, Area: Stub, BarChart: Stub, Bar: Stub,
    XAxis: Stub, YAxis: Stub, CartesianGrid: Stub, Tooltip: Stub, Legend: Stub,
    ReferenceLine: Stub, Cell: Stub, PieChart: Stub, Pie: Stub,
  }
})

const mockData: RelatorioData = {
  evolucaoMensal: [
    { ano: 2026, mes: 4, mesLabel: "Abr.", receitas: 9000, despesas: 3000, saldo: 6000 },
    { ano: 2026, mes: 5, mesLabel: "Mai.", receitas: 9900, despesas: 3200, saldo: 6700 },
  ],
  gastosPorCategoria: [
    { descricao: "Moradia", valor: 4000, percentual: 65 },
    { descricao: "Mercado", valor: 2200, percentual: 35 },
  ],
  comparacaoUltimosMeses: [],
}

const getRelatorio = vi.fn()
vi.mock("../../services/relatorioService", () => ({ getRelatorio: (...a: unknown[]) => getRelatorio(...a) }))

function renderReports() {
  return render(<PontesThemeProvider><ReportsPage /></PontesThemeProvider>)
}

// Intl pt-BR usa NBSP ( ) após "R$" — normaliza p/ comparar com espaço normal.
// Matcher por elemento pode bater wrapper + value → usa getAllByText.
const money = (val: string) => (content: string) => content.replace(/ /g, " ") === val

describe("ReportsPage", () => {
  beforeEach(() => {
    getRelatorio.mockReset()
    getRelatorio.mockResolvedValue(mockData)
  })

  it("KPIs do ano somam receitas/despesas/saldo", async () => {
    renderReports()
    // total receitas 9000+9900 = 18.900 ; despesas 6200 ; saldo 12.700
    expect((await screen.findAllByText(money("R$ 18.900,00"))).length).toBeGreaterThan(0)
    expect(screen.getAllByText(money("R$ 6.200,00")).length).toBeGreaterThan(0)
    expect(screen.getAllByText(money("R$ 12.700,00")).length).toBeGreaterThan(0)
  })

  it("comparação mostra último mês vs anterior", async () => {
    renderReports()
    expect(await screen.findByText("Mai. vs Abr.")).toBeInTheDocument()
    // receita subiu 9000→9900 = +10%
    expect(screen.getByText("+10.0%")).toBeInTheDocument()
  })

  it("renderiza todos os blocos de gráfico", async () => {
    renderReports()
    await screen.findByText("Saldo acumulado")
    for (const titulo of [
      "Evolução do saldo mensal", "Receitas vs despesas por mês",
      "Saldo acumulado", "Taxa de economia", "Distribuição de despesas",
    ]) {
      expect(screen.getByText(titulo)).toBeInTheDocument()
    }
  })

  it("taxa de economia mostra a média no subtítulo", async () => {
    renderReports()
    // abr: 6000/9000=66.7% ; mai: 6700/9900=67.7% ; média ≈ 67%
    expect(await screen.findByText(/% da receita que sobrou — média 67%/)).toBeInTheDocument()
  })

  it("distribuição usa o donut com as categorias", async () => {
    renderReports()
    expect(await screen.findByText("Moradia")).toBeInTheDocument()
    expect(screen.getByText("Mercado")).toBeInTheDocument()
  })
})
