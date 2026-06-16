import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { PontesThemeProvider, setHideBalance } from "../../components/pontes"
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
  entradasCaixa: 1000, saidasCaixa: 300, saldoCaixaMes: 700,
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
    setHideBalance(false) // estado do olho é global — reseta entre testes
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

  it("olho global esconde os valores do dashboard", async () => {
    renderDash()
    await screen.findByText("Olá, Gabriel")
    // espera o valor aparecer (HeroBalance anima) e ignora separador de milhar (locale/ICU)
    await waitFor(() =>
      expect(screen.getAllByText((t) => t.replace(/\D/g, "").includes("5000")).length).toBeGreaterThan(0)
    )
    // O olho vive no navbar global agora; aqui simulamos o estado global ligado.
    act(() => setHideBalance(true))
    await waitFor(() => {
      expect(screen.getAllByText((t) => t.includes("••••")).length).toBeGreaterThan(0)
    })
  })

  // ── Redesign #181 ─────────────────────────────────────────────────────────

  it("hero mostra delta vs mês anterior (5000 - 4200 = +800)", async () => {
    renderDash()
    await screen.findByText("Olá, Gabriel")
    // Delta = 800; pct = 800/4200 = 19,05%. Tolerância: texto contém "vs mês anterior".
    expect(await screen.findByText(/vs mês anterior/i)).toBeInTheDocument()
    // %+ aparece com sinal positivo (delta>0)
    expect(screen.getByText(/\+19[,.]0%|\+19\.0%/)).toBeInTheDocument()
  })

  it("hero esconde delta quando saldoMesAnterior=0 (baseline zero)", async () => {
    getDashboard.mockReset()
    getDashboard.mockResolvedValue({ ...mockData, saldoMesAnterior: 0 })
    renderDash()
    await screen.findByText("Olá, Gabriel")
    // Fallback "Soma de todas as contas" aparece em vez do delta.
    expect(await screen.findByText("Soma de todas as contas")).toBeInTheDocument()
  })

  it("QuickActions renderiza 4 atalhos com dicas N/T/C/F", async () => {
    renderDash()
    await screen.findByText("Olá, Gabriel")
    expect(screen.getByText("Nova transação")).toBeInTheDocument()
    expect(screen.getByText("Transações")).toBeInTheDocument()
    expect(screen.getByText("Cartões")).toBeInTheDocument()
    expect(screen.getByText("Transferir")).toBeInTheDocument()
    // Dicas de teclado discretas — Transferir agora tem atalho F
    expect(screen.getByText("N")).toBeInTheDocument()
    expect(screen.getByText("T")).toBeInTheDocument()
    expect(screen.getByText("C")).toBeInTheDocument()
    expect(screen.getByText("F")).toBeInTheDocument()
  })

  it("atalho N dispara evento openNewTransaction (fora de input)", async () => {
    renderDash()
    await screen.findByText("Olá, Gabriel")
    let fired = 0
    const handler = () => { fired++ }
    window.addEventListener("openNewTransaction", handler)
    fireEvent.keyDown(window, { key: "n" })
    window.removeEventListener("openNewTransaction", handler)
    expect(fired).toBe(1)
  })

  it("seção Cartões só aparece quando cartoesResumo > 0", async () => {
    renderDash()
    await screen.findByText("Olá, Gabriel")
    // mockData padrão tem cartoesResumo=[], então não renderiza
    expect(screen.queryByText("Seus cartões")).not.toBeInTheDocument()

    // re-render com cartões
    getDashboard.mockReset()
    getDashboard.mockResolvedValue({
      ...mockData,
      cartoesResumo: [{
        id: "card-1", nome: "Nubank Roxinho",
        bancoNome: "Nubank",
        limiteTotal: 5000, limiteUsado: 4250, limiteDisponivel: 750,
        percentualUsado: 85, diasAteFechamento: 3,
        proximoFechamento: "2026-06-01",
      }],
    })
    const { unmount } = renderDash()
    expect(await screen.findByText("Seus cartões")).toBeInTheDocument()
    expect(screen.getByText("Nubank Roxinho")).toBeInTheDocument()
    expect(screen.getByText("85%")).toBeInTheDocument()
    expect(screen.getByText(/fecha em 3 dias/i)).toBeInTheDocument()
    unmount()
  })
})
