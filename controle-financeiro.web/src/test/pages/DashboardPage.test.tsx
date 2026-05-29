import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { PontesThemeProvider } from "../../components/pontes"
import DashboardPage from "../../pages/Dashboard/DashboardPage"
import type { DashboardData } from "../../types/Dashboard"

vi.mock("recharts", () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    ResponsiveContainer: Stub, AreaChart: Stub, Area: Stub,
    PieChart: Stub, Pie: Stub, Cell: Stub, XAxis: Stub, YAxis: Stub,
    CartesianGrid: Stub, Tooltip: Stub,
  }
})

const mockData: DashboardData = {
  saldoTotal: 5000, saldoMesAnterior: 4200,
  receitasMes: 1400, despesasMes: 500, saldoMes: 900,
  recebido: 1000, aReceber: 400, pago: 300, aPagar: 200,
  evolucaoSaldo: [{ label: "mai/26", ano: 2026, mes: 5, saldo: 5000 }],
  topCategorias: [{ descricao: "Mercado", valor: 300, percentual: 60 }],
  transacoesRecentes: [
    { id: "1", descricao: "Salário", valor: 1000, tipo: 2, data: "2026-05-10", categoria: "Renda", conta: "Conta" },
    { id: "2", descricao: "Mercado", valor: 300, tipo: 1, data: "2026-05-12", categoria: "Alimentação", conta: "Conta" },
  ],
  saldoContas: [{ id: "c1", nome: "Conta Corrente", saldo: 5000, tipo: 1, tipoDescricao: "Conta Corrente" }],
  cartoesResumo: [],
}

const getDashboard = vi.fn()
vi.mock("../../services/dashboardService", () => ({ getDashboard: (...a: unknown[]) => getDashboard(...a) }))
vi.mock("../../hooks/useAuth", () => ({ useAuth: () => ({ currentUser: { nome: "Gabriel Dev" } }) }))

function renderDash() {
  return render(
    <MemoryRouter>
      <PontesThemeProvider><DashboardPage /></PontesThemeProvider>
    </MemoryRouter>
  )
}

describe("DashboardPage (#81)", () => {
  beforeEach(() => {
    getDashboard.mockReset()
    getDashboard.mockResolvedValue(mockData)
  })

  it("saúda o usuário pelo primeiro nome", async () => {
    renderDash()
    expect(await screen.findByText("Olá, Gabriel")).toBeInTheDocument()
  })

  it("mostra os 3 números humanos do mês", async () => {
    renderDash()
    // espera os dados carregarem (getDashboard async) — não só a saudação
    await screen.findByText("Entrou")
    for (const stat of ["Entrou", "Saiu", "Sobrou"]) {
      expect(screen.getByText(stat)).toBeInTheDocument()
    }
  })

  it("mostra pendências quando há a receber / a pagar", async () => {
    renderDash()
    expect(await screen.findByText((t) => t.includes("Ainda vai entrar"))).toBeInTheDocument()
    expect(screen.getByText((t) => t.includes("Ainda vai sair"))).toBeInTheDocument()
  })

  it("renderiza saldo total e seções", async () => {
    renderDash()
    await screen.findByText("Saldo total")
    expect(screen.getByText("Saldo total")).toBeInTheDocument()
    expect(screen.getByText("Seu mês")).toBeInTheDocument()
    expect(screen.getByText("Saldo nos últimos meses")).toBeInTheDocument()
    expect(screen.getByText("Maiores gastos")).toBeInTheDocument()
    expect(screen.getByText("Suas contas")).toBeInTheDocument()
    expect(screen.getByText("Transações recentes")).toBeInTheDocument()
  })

  it("olho esconde os valores", async () => {
    renderDash()
    await screen.findByText("Olá, Gabriel")
    // espera o valor aparecer (HeroBalance anima) e ignora separador de milhar (locale/ICU)
    await waitFor(() =>
      expect(screen.getAllByText((t) => t.replace(/\D/g, "").includes("5000")).length).toBeGreaterThan(0)
    )
    fireEvent.click(screen.getByLabelText("Esconder valores"))
    await waitFor(() => {
      expect(screen.getAllByText((t) => t.includes("••••")).length).toBeGreaterThan(0)
    })
  })
})
