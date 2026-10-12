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
    { ano: 2026, mes: 4, mesLabel: "Abr.", receitas: 9000, despesas: 3000, saldo: 6000, saldoFimDoMes: 6000 },
    { ano: 2026, mes: 5, mesLabel: "Mai.", receitas: 9900, despesas: 3200, saldo: 6700, saldoFimDoMes: 12700 },
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

// Intl pt-BR usa NBSP (\u00A0) após "R$" — normaliza p/ comparar com espaço normal.
// Matcher por elemento pode bater wrapper + value → usa getAllByText.
const money = (val: string) => (content: string) => content.replace(/\u00A0/g, " ") === val

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

  it("comparação de saldo usa o saldo real da conta, não o resultado do mês", async () => {
    renderReports()
    expect(await screen.findByText("Saldo na conta")).toBeInTheDocument()
    // saldo real 6.000 → 12.700 = +111.7% (o resultado do mês, 6.000 → 6.700, daria +11.7%)
    expect(screen.getByText("+111.7%")).toBeInTheDocument()
  })

  it("mês que ainda não chegou fica fora da comparação (não vira −100%)", async () => {
    // Data fixa (só o Date): junho/2026. Julho tem só uma compra no cartão lançada pra frente.
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 5, 15))
    try {
      getRelatorio.mockResolvedValue({
        ...mockData,
        evolucaoMensal: [
          ...mockData.evolucaoMensal,
          { ano: 2026, mes: 6, mesLabel: "Jun.", receitas: 9000, despesas: 3000, saldo: 6000, saldoFimDoMes: 18700 },
          { ano: 2026, mes: 7, mesLabel: "Jul.", receitas: 0, despesas: 130.49, saldo: 0, saldoFimDoMes: 18700 },
        ],
      })
      renderReports()
      expect(await screen.findByText("Jun. vs Mai.")).toBeInTheDocument()
      expect(screen.queryByText("Jul. vs Jun.")).not.toBeInTheDocument()
      expect(screen.queryByText("-100.0%")).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it("renderiza todos os blocos de gráfico", async () => {
    renderReports()
    await screen.findByText("Saldo acumulado")
    for (const titulo of [
      "Evolução mensal", "Receitas vs despesas por mês",
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
