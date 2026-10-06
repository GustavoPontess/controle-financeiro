import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { PontesThemeProvider, setHideBalance } from "../../components/pontes"
import DashboardPage from "../../pages/Dashboard/DashboardPage"
import type { DashboardData, TransacaoRecente, SaldoConta, CartaoResumo, CompraCartao } from "../../types/Dashboard"
import type { Orcamento } from "../../types/Orcamento"

// ── Mocks ────────────────────────────────────────────────────────────────────

// recharts não rende em jsdom (largura 0): vira stub. AreaChart e YAxis anotam as props pra conferir o
// que a tela entrega ao gráfico: a série e o formatador do eixo (que precisa respeitar o olho de ocultar).
const grafico = vi.hoisted(() => ({
  serie: undefined as unknown,
  formatarEixo: undefined as ((v: number) => string) | undefined,
}))
vi.mock("recharts", () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    ResponsiveContainer: Stub, Area: Stub, PieChart: Stub, Pie: Stub, Cell: Stub,
    XAxis: Stub, CartesianGrid: Stub, Tooltip: Stub,
    AreaChart: ({ data, children }: { data: unknown; children?: React.ReactNode }) => {
      grafico.serie = data
      return <div>{children}</div>
    },
    YAxis: ({ tickFormatter }: { tickFormatter: (v: number) => string }) => {
      grafico.formatarEixo = tickFormatter
      return null
    },
  }
})

const navigateSpy = vi.hoisted(() => vi.fn())
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => navigateSpy,
}))

const getDashboard = vi.fn()
vi.mock("../../services/dashboardService", () => ({ getDashboard: (...a: unknown[]) => getDashboard(...a) }))
const getOrcamentos = vi.fn()
vi.mock("../../services/orcamentoService", () => ({ getOrcamentos: (...a: unknown[]) => getOrcamentos(...a) }))

// ── Fixtures ─────────────────────────────────────────────────────────────────

// "Hoje" fixo: o rótulo do mês, o "Hoje/Ontem" das transações e o "fim de <mês passado>" dependem do
// relógio. Congela só o Date (os timers reais seguem pro findBy/waitFor).
const AGORA = new Date(2026, 9, 2, 15, 30, 0) // 02/10/2026, 15:30
const HOJE = "2026-10-02"
const ONTEM = "2026-10-01"

const evolucao = [
  { label: "mai/26", ano: 2026, mes: 5, saldo: 2100 },
  { label: "jun/26", ano: 2026, mes: 6, saldo: 2600 },
  { label: "jul/26", ano: 2026, mes: 7, saldo: 3100 },
  { label: "ago/26", ano: 2026, mes: 8, saldo: 3800 },
  { label: "set/26", ano: 2026, mes: 9, saldo: 4200 },
  { label: "out/26", ano: 2026, mes: 10, saldo: 5000 },
]

// Soma 5.000 = saldoTotal. Valores distintos entre si pra cada linha ser achada sem ambiguidade.
const contas: SaldoConta[] = [
  { id: "c1", nome: "Nubank Corrente", saldo: 3200, tipo: 1, tipoDescricao: "Conta Corrente", bancoNome: "Nubank", logoUrl: "https://cdn.exemplo.test/nubank.png", cor: "#820AD1" },
  { id: "c2", nome: "Carteira", saldo: 1950, tipo: 4, tipoDescricao: "Dinheiro", isCarteira: true },
  { id: "c3", nome: "Cheque especial", saldo: -150, tipo: 1, tipoDescricao: "Conta Corrente" },
]

const recentes: TransacaoRecente[] = [
  { id: "t1", descricao: "Salário outubro", valor: 4200, tipo: 2, data: HOJE, hora: "14:30:00", categoria: "Renda", conta: "Nubank Corrente" },
  { id: "t2", descricao: "Mercado Dia", valor: 187.45, tipo: 1, data: ONTEM, hora: "09:05:00", categoria: "Alimentação", conta: "Nubank Corrente" },
  { id: "t3", descricao: "Transferência para a Carteira", valor: 300, tipo: 1, data: "2026-09-15", hora: null, conta: "Nubank Corrente", ehTransferencia: true },
  { id: "t4", descricao: "Pagamento de fatura", valor: 1250.9, tipo: 1, data: "2026-09-10", hora: "08:00:00", categoria: "Cartão", conta: "Nubank Corrente", ehPagamentoFatura: true },
]

function makeDashboard(over: Partial<DashboardData> = {}): DashboardData {
  return {
    saldoTotal: 5000, saldoMesAnterior: 4200,
    receitasMes: 1400, despesasMes: 500, saldoMes: 900,
    recebido: 1000, aReceber: 400, pago: 300, aPagar: 200,
    entradasCaixa: 1000, saidasCaixa: 300, saldoCaixaMes: 700,
    entradasCaixaMesAnterior: 800, saidasCaixaMesAnterior: 200,
    evolucaoSaldo: evolucao,
    topCategorias: [
      { descricao: "Moradia", valor: 180, percentual: 60 },
      { descricao: "Mercado", valor: 120, percentual: 40 },
    ],
    transacoesRecentes: recentes,
    saldoContas: contas,
    cartoesResumo: [],
    ...over,
  }
}

function makeOrcamento(over: Partial<Orcamento> = {}): Orcamento {
  return {
    id: "o1", categoriaId: null, categoriaNome: null, mes: 10, ano: 2026,
    valorLimite: 3000, percentualAlerta: 80, valorGasto: 1200, valorRestante: 1800,
    percentualConsumido: 40, emAlerta: false, ultrapassado: false,
    ...over,
  }
}

function makeCartao(over: Partial<CartaoResumo> = {}): CartaoResumo {
  return {
    id: "card-1", nome: "Nubank Roxinho", ultimosDigitos: "1234", bancoNome: "Nubank",
    limiteTotal: 5000, limiteUsado: 4250, limiteDisponivel: 750,
    percentualUsado: 85, diasAteFechamento: 3, proximoFechamento: "2026-10-05",
    ...over,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

function renderDash() {
  return render(
    <MemoryRouter>
      <PontesThemeProvider><DashboardPage /></PontesThemeProvider>
    </MemoryRouter>
  )
}

const algoEsmaecido = () => document.querySelector('[data-atualizando="true"]') !== null

// Espera a carga INTEIRA: a faixa de saldo aparece antes do orçamento, e só no fim da carga some o
// esmaecimento ("atualizando"). Sem isso o teste olharia o orçamento antes dele chegar.
async function carregar() {
  await screen.findByText("Saldo total")
  await waitFor(() => expect(algoEsmaecido()).toBe(false))
}

async function renderCarregado() {
  const r = renderDash()
  await carregar()
  return r
}

const botao = (nome: string) => screen.getByRole("button", { name: nome })
const titulo = (nome: string) => screen.getByRole("heading", { name: nome })
const secao = (nome: string) => titulo(nome).closest("section") as HTMLElement
const heroSaldo = () => screen.getByText("Saldo total").parentElement as HTMLElement
const stat = (rotulo: "Entrou" | "Saiu" | "Sobrou") => screen.getByText(rotulo).closest("div") as HTMLElement
// Fica esmaecido (data-atualizando) quem tem esse atributo no próprio nó ou num ancestral.
const esmaecido = (el: HTMLElement) => el.closest("[data-atualizando]")?.getAttribute("data-atualizando")
const barras = (el: HTMLElement) =>
  Array.from(el.querySelectorAll<HTMLElement>('[class*="barraFill"]')).map((b) => ({ largura: b.style.width, tom: b.dataset.tone }))

// ── Testes ───────────────────────────────────────────────────────────────────

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(AGORA)
    getDashboard.mockReset().mockResolvedValue(makeDashboard())
    getOrcamentos.mockReset().mockResolvedValue({ data: [] }) // sem orçamento por padrão
    navigateSpy.mockReset()
    setHideBalance(false) // o estado do olho é global — reseta entre testes
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── carga inicial ──────────────────────────────────────────────────────────

  describe("carga inicial", () => {
    it("busca o resumo do mês de hoje e o orçamento desse mesmo mês", async () => {
      await renderCarregado()
      expect(getDashboard).toHaveBeenCalledTimes(1)
      expect(getDashboard).toHaveBeenCalledWith(2026, 10)
      expect(getOrcamentos).toHaveBeenCalledWith(10, 2026) // (mês, ano): ordem inversa do resumo
    })

    it("enquanto a 1ª carga não chega, não mostra a faixa de saldo nem alerta de erro", async () => {
      const resposta = deferred<DashboardData>()
      getDashboard.mockReturnValue(resposta.promise)
      renderDash()
      expect(screen.queryByText("Saldo total")).not.toBeInTheDocument()
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()

      await act(async () => { resposta.resolve(makeDashboard()) })
      expect(await screen.findByText("Saldo total")).toBeInTheDocument()
    })

    it("depois de carregar, nada fica esmaecido", async () => {
      await renderCarregado()
      expect(algoEsmaecido()).toBe(false)
    })
  })

  // ── faixa de saldo (hero) ──────────────────────────────────────────────────

  describe("faixa de saldo", () => {
    it("mostra 'Saldo total' com o valor em reais", async () => {
      await renderCarregado()
      expect(within(heroSaldo()).getByText("R$ 5.000,00")).toBeInTheDocument()
    })

    it("mostra Entrou, Saiu e Sobrou com o caixa do mês", async () => {
      await renderCarregado()
      expect(within(stat("Entrou")).getByText("R$ 1.000,00")).toBeInTheDocument()
      expect(within(stat("Saiu")).getByText("R$ 300,00")).toBeInTheDocument()
      expect(within(stat("Sobrou")).getByText("R$ 700,00")).toBeInTheDocument()
    })

    it.each([
      { quando: "sobra dinheiro", sobrou: 700, tom: "up" },
      { quando: "o mês fecha no zero", sobrou: 0, tom: "up" },
      { quando: "falta dinheiro", sobrou: -150, tom: "down" },
    ])("Sobrou fica no tom '$tom' quando $quando", async ({ sobrou, tom }) => {
      getDashboard.mockResolvedValue(makeDashboard({ saldoCaixaMes: sobrou }))
      await renderCarregado()
      expect(within(stat("Sobrou")).getByText(/R\$/)).toHaveAttribute("data-tone", tom)
    })

    describe("variação % contra o mês anterior (Entrou e Saiu)", () => {
      it("mostra a variação sem sinal de + ou −, e só em Entrou e Saiu", async () => {
        await renderCarregado() // entrou 1.000 vs 800 = 25%; saiu 300 vs 200 = 50%
        const titulo = "comparado ao mês anterior"
        expect(within(stat("Entrou")).getByTitle(titulo)).toHaveTextContent(/^25%$/)
        expect(within(stat("Saiu")).getByTitle(titulo)).toHaveTextContent(/^50%$/)
        expect(within(stat("Sobrou")).queryByTitle(titulo)).not.toBeInTheDocument()
      })

      type CasoVariacao = { caso: string; rotulo: "Entrou" | "Saiu"; over: Partial<DashboardData>; pct: string; tom: "up" | "down" }
      // Verde = bom pra aquela métrica: entrar mais é bom; sair mais é ruim.
      const casos: CasoVariacao[] = [
        { caso: "Entrou subiu (bom)", rotulo: "Entrou", over: { entradasCaixa: 1000, entradasCaixaMesAnterior: 800 }, pct: "25%", tom: "up" },
        { caso: "Entrou caiu (ruim)", rotulo: "Entrou", over: { entradasCaixa: 600, entradasCaixaMesAnterior: 800 }, pct: "25%", tom: "down" },
        { caso: "Saiu subiu (ruim)", rotulo: "Saiu", over: { saidasCaixa: 300, saidasCaixaMesAnterior: 200 }, pct: "50%", tom: "down" },
        { caso: "Saiu caiu (bom)", rotulo: "Saiu", over: { saidasCaixa: 100, saidasCaixaMesAnterior: 200 }, pct: "50%", tom: "up" },
      ]
      it.each(casos)("$caso: $pct em tom '$tom'", async ({ rotulo, over, pct, tom }) => {
        getDashboard.mockResolvedValue(makeDashboard(over))
        await renderCarregado()
        const variacao = within(stat(rotulo)).getByTitle("comparado ao mês anterior")
        expect(variacao).toHaveTextContent(new RegExp(`^${pct}$`))
        expect(variacao).toHaveAttribute("data-tone", tom)
      })

      it("some quando o mês anterior não teve movimento (sem base de comparação)", async () => {
        getDashboard.mockResolvedValue(makeDashboard({ entradasCaixaMesAnterior: 0, saidasCaixaMesAnterior: 0 }))
        await renderCarregado()
        expect(screen.queryByTitle("comparado ao mês anterior")).not.toBeInTheDocument()
      })
    })

    describe("quanto o saldo andou desde o fim do mês passado", () => {
      it("subiu: 'R$ 800,00 a mais que no fim de setembro', em tom positivo e sem sinal de +", async () => {
        await renderCarregado() // 5.000 hoje vs 4.200 no fim de setembro
        const delta = screen.getByText("R$ 800,00 a mais")
        expect(delta.closest("div")).toHaveAttribute("data-tone", "up")
        expect(screen.getByText("que no fim de setembro")).toBeInTheDocument()
      })

      it("caiu: 'R$ 600,00 a menos', em tom negativo e sem sinal de −", async () => {
        getDashboard.mockResolvedValue(makeDashboard({ saldoTotal: 5000, saldoMesAnterior: 5600 }))
        await renderCarregado()
        const delta = screen.getByText("R$ 600,00 a menos")
        expect(delta.closest("div")).toHaveAttribute("data-tone", "down")
        expect(screen.getByText("que no fim de setembro")).toBeInTheDocument()
      })

      it.each([
        { caso: "o saldo não mudou", saldoTotal: 5000, saldoMesAnterior: 5000 },
        { caso: "a diferença é menor que 1 centavo", saldoTotal: 5000.004, saldoMesAnterior: 5000 },
      ])("some quando $caso", async ({ saldoTotal, saldoMesAnterior }) => {
        getDashboard.mockResolvedValue(makeDashboard({ saldoTotal, saldoMesAnterior }))
        await renderCarregado()
        expect(screen.getByText("Saldo total")).toBeInTheDocument()
        expect(screen.queryByText(/a mais|a menos/)).not.toBeInTheDocument()
        expect(screen.queryByText(/que no fim de/)).not.toBeInTheDocument()
      })

      it("a partir de 1 centavo de diferença já aparece", async () => {
        getDashboard.mockResolvedValue(makeDashboard({ saldoTotal: 5000.01, saldoMesAnterior: 5000 }))
        await renderCarregado()
        expect(screen.getByText("R$ 0,01 a mais")).toBeInTheDocument()
      })

      it("em janeiro compara com o fim de dezembro", async () => {
        vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0))
        await renderCarregado()
        expect(screen.getByText("que no fim de dezembro")).toBeInTheDocument()
      })

      it("compara sempre com o mês do calendário: navegar de mês não muda o 'fim de setembro'", async () => {
        await renderCarregado()
        fireEvent.click(botao("Mês anterior"))
        await waitFor(() => expect(getDashboard).toHaveBeenLastCalledWith(2026, 9))
        await carregar()
        expect(screen.getByText("set 2026")).toBeInTheDocument()
        expect(screen.getByText("que no fim de setembro")).toBeInTheDocument()
      })
    })

    describe("pendências do mês", () => {
      it("mostra 'Ainda vai entrar' e 'Ainda vai sair' com os valores quando há a receber e a pagar", async () => {
        await renderCarregado()
        expect(screen.getByText("Ainda vai entrar")).toHaveTextContent("Ainda vai entrar R$ 400,00")
        expect(screen.getByText("Ainda vai sair")).toHaveTextContent("Ainda vai sair R$ 200,00")
      })

      it("sem nada a receber, só aparece 'Ainda vai sair'", async () => {
        getDashboard.mockResolvedValue(makeDashboard({ aReceber: 0 }))
        await renderCarregado()
        expect(screen.queryByText("Ainda vai entrar")).not.toBeInTheDocument()
        expect(screen.getByText("Ainda vai sair")).toBeInTheDocument()
      })

      it("sem nada a pagar, só aparece 'Ainda vai entrar'", async () => {
        getDashboard.mockResolvedValue(makeDashboard({ aPagar: 0 }))
        await renderCarregado()
        expect(screen.queryByText("Ainda vai sair")).not.toBeInTheDocument()
        expect(screen.getByText("Ainda vai entrar")).toBeInTheDocument()
      })

      it("sem pendência nenhuma, a linha some inteira", async () => {
        getDashboard.mockResolvedValue(makeDashboard({ aReceber: 0, aPagar: 0 }))
        await renderCarregado()
        expect(screen.queryByText("Ainda vai entrar")).not.toBeInTheDocument()
        expect(screen.queryByText("Ainda vai sair")).not.toBeInTheDocument()
      })
    })
  })

  // ── troca de mês ───────────────────────────────────────────────────────────

  describe("troca de mês", () => {
    it("começa no mês de hoje", async () => {
      await renderCarregado()
      expect(screen.getByText("out 2026")).toBeInTheDocument()
    })

    it("'Mês anterior' busca o mês certo (resumo e orçamento) e troca o rótulo", async () => {
      await renderCarregado()
      fireEvent.click(botao("Mês anterior"))
      expect(screen.getByText("set 2026")).toBeInTheDocument()
      await waitFor(() => expect(getDashboard).toHaveBeenLastCalledWith(2026, 9))
      await carregar()
      expect(getOrcamentos).toHaveBeenLastCalledWith(9, 2026)
    })

    it("'Próximo mês' avança; dois cliques andam dois meses", async () => {
      await renderCarregado()
      fireEvent.click(botao("Próximo mês"))
      await waitFor(() => expect(getDashboard).toHaveBeenLastCalledWith(2026, 11))
      await carregar()
      fireEvent.click(botao("Próximo mês"))
      await waitFor(() => expect(getDashboard).toHaveBeenLastCalledWith(2026, 12))
      await carregar()
      expect(screen.getByText("dez 2026")).toBeInTheDocument()
    })

    it("vira o ano pra trás: de janeiro, 'Mês anterior' vai pra dezembro do ano anterior", async () => {
      vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0))
      await renderCarregado()
      expect(getDashboard).toHaveBeenLastCalledWith(2026, 1)
      fireEvent.click(botao("Mês anterior"))
      expect(screen.getByText("dez 2025")).toBeInTheDocument()
      await waitFor(() => expect(getDashboard).toHaveBeenLastCalledWith(2025, 12))
      await carregar()
    })

    it("vira o ano pra frente: de dezembro, 'Próximo mês' vai pra janeiro do ano seguinte", async () => {
      vi.setSystemTime(new Date(2026, 11, 20, 12, 0, 0))
      await renderCarregado()
      expect(getDashboard).toHaveBeenLastCalledWith(2026, 12)
      fireEvent.click(botao("Próximo mês"))
      expect(screen.getByText("jan 2027")).toBeInTheDocument()
      await waitFor(() => expect(getDashboard).toHaveBeenLastCalledWith(2027, 1))
      await carregar()
    })

    it("enquanto o mês novo carrega, esmaece só o que depende do mês (data-atualizando) e mantém a tela", async () => {
      await renderCarregado()
      const pendente = deferred<DashboardData>()
      getDashboard.mockReturnValueOnce(pendente.promise)
      fireEvent.click(botao("Mês anterior"))

      // Depende do mês: números do hero (botões de mês incluídos), gráfico, maiores gastos e orçamento.
      await waitFor(() => expect(esmaecido(botao("Mês anterior"))).toBe("true"))
      expect(esmaecido(titulo("Saldo nos últimos meses"))).toBe("true")
      expect(esmaecido(titulo("Maiores gastos"))).toBe("true")
      expect(esmaecido(titulo("Orçamento do mês"))).toBe("true")
      // Não depende do mês: o que aconteceu e onde está o dinheiro agora.
      expect(esmaecido(titulo("Transações recentes"))).toBeUndefined()
      expect(esmaecido(titulo("Contas"))).toBeUndefined()
      // A tela não pisca: segue mostrando os números enquanto carrega.
      expect(screen.getByText("Saldo total")).toBeInTheDocument()

      await act(async () => { pendente.resolve(makeDashboard()) })
      await waitFor(() => expect(algoEsmaecido()).toBe(false))
    })

    it("recarrega o mês que está na tela quando uma transação é criada em outro lugar do app", async () => {
      await renderCarregado()
      fireEvent.click(botao("Mês anterior"))
      await waitFor(() => expect(getDashboard).toHaveBeenLastCalledWith(2026, 9))
      await carregar()

      getDashboard.mockResolvedValue(makeDashboard({ saldoTotal: 5500 }))
      act(() => { window.dispatchEvent(new Event("transactionCreated")) })

      expect(await screen.findByText("R$ 5.500,00")).toBeInTheDocument()
      expect(getDashboard).toHaveBeenCalledTimes(3)
      expect(getDashboard).toHaveBeenLastCalledWith(2026, 9)
      await carregar()
    })

    it("deixa de ouvir a criação de transação ao sair da tela", async () => {
      const { unmount } = await renderCarregado()
      unmount()
      window.dispatchEvent(new Event("transactionCreated"))
      expect(getDashboard).toHaveBeenCalledTimes(1)
    })

    // Regressão: clicando "Mês anterior" duas vezes seguidas, a resposta do 1º clique chegando DEPOIS
    // da do 2º não pode pôr os números do mês errado sob o rótulo do mês certo.
    it("resposta atrasada de um mês antigo não sobrescreve o mês da tela", async () => {
      await renderCarregado()
      const lenta = deferred<DashboardData>()  // 1º clique (set): demora
      const rapida = deferred<DashboardData>() // 2º clique (ago): chega primeiro
      getDashboard.mockReturnValueOnce(lenta.promise).mockReturnValueOnce(rapida.promise)
      fireEvent.click(botao("Mês anterior"))
      fireEvent.click(botao("Mês anterior"))
      expect(screen.getByText("ago 2026")).toBeInTheDocument()

      await act(async () => { rapida.resolve(makeDashboard({ saldoTotal: 8000 })) })
      await act(async () => { lenta.resolve(makeDashboard({ saldoTotal: 9999 })) })

      // A tela está em agosto: tem que mostrar o saldo de agosto, não o de setembro que chegou atrasado.
      expect(within(heroSaldo()).getByText("R$ 8.000,00")).toBeInTheDocument()
    })
  })

  // ── erro ao carregar ───────────────────────────────────────────────────────

  describe("quando o resumo não carrega", () => {
    it("mostra o alerta com 'Tentar de novo' e nenhum número", async () => {
      getDashboard.mockRejectedValue(new Error("boom"))
      renderDash()
      const alerta = await screen.findByRole("alert")
      expect(alerta).toHaveTextContent("Não deu pra carregar o resumo.")
      expect(within(alerta).getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument()
      expect(screen.queryByText("Saldo total")).not.toBeInTheDocument()
    })

    it("'Tentar de novo' busca outra vez e, dando certo, troca o alerta pelo resumo", async () => {
      getDashboard.mockRejectedValueOnce(new Error("boom"))
      renderDash()
      fireEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }))

      expect(await screen.findByText("Saldo total")).toBeInTheDocument()
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
      expect(getDashboard).toHaveBeenCalledTimes(2)
    })

    it("se a nova tentativa também falha, o alerta volta", async () => {
      getDashboard.mockRejectedValue(new Error("boom"))
      renderDash()
      fireEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }))

      await waitFor(() => expect(getDashboard).toHaveBeenCalledTimes(2))
      expect(await screen.findByRole("alert")).toHaveTextContent("Não deu pra carregar o resumo.")
      expect(screen.queryByText("Saldo total")).not.toBeInTheDocument()
    })

    it("falha ao trocar de mês: 'Tentar de novo' refaz o mês escolhido, não o de hoje", async () => {
      await renderCarregado()
      getDashboard.mockRejectedValueOnce(new Error("boom"))
      fireEvent.click(botao("Mês anterior"))
      const alerta = await screen.findByRole("alert")

      fireEvent.click(within(alerta).getByRole("button", { name: "Tentar de novo" }))
      await waitFor(() => expect(getDashboard).toHaveBeenCalledTimes(3))
      expect(getDashboard).toHaveBeenLastCalledWith(2026, 9)
      await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument())
      await carregar()
    })
  })

  // ── gráficos ───────────────────────────────────────────────────────────────

  describe("Saldo nos últimos meses", () => {
    it("entrega ao gráfico os 6 meses que a API mandou", async () => {
      await renderCarregado()
      expect(titulo("Saldo nos últimos meses")).toBeInTheDocument()
      expect(grafico.serie).toEqual(evolucao)
      expect(grafico.serie).toHaveLength(6)
    })

    it("eixo do valor: compacto e SEM 'R$' (com o símbolo o rótulo era cortado), em branco com o olho fechado", async () => {
      await renderCarregado()
      expect(grafico.formatarEixo!(5000)).toMatch(/^5\s?mil$/)
      expect(grafico.formatarEixo!(13500)).toMatch(/^13,5\s?mil$/)
      expect(grafico.formatarEixo!(13500)).not.toMatch(/R\$/)

      act(() => setHideBalance(true))
      await waitFor(() => expect(grafico.formatarEixo!(5000)).toBe(""))

      act(() => setHideBalance(false))
      await waitFor(() => expect(grafico.formatarEixo!(5000)).toMatch(/mil/))
    })
  })

  describe("Maiores gastos", () => {
    it("lista as categorias com percentual e valor, e o total no centro", async () => {
      await renderCarregado()
      const caixa = within(secao("Maiores gastos"))
      expect(caixa.getByText("Moradia")).toBeInTheDocument()
      expect(caixa.getByText("60%")).toBeInTheDocument()
      expect(caixa.getByText("R$ 180,00")).toBeInTheDocument()
      expect(caixa.getByText("Mercado")).toBeInTheDocument()
      expect(caixa.getByText("40%")).toBeInTheDocument()
      expect(caixa.getByText("R$ 120,00")).toBeInTheDocument()
      expect(caixa.getByText("Total")).toBeInTheDocument()
      expect(caixa.getByText("R$ 300,00")).toBeInTheDocument() // 180 + 120 = o que saiu no mês
    })

    it("percentual com casa decimal sai em pt-BR (vírgula), como mandam do back", async () => {
      getDashboard.mockResolvedValue(makeDashboard({
        topCategorias: [
          { descricao: "Moradia", valor: 200, percentual: 66.7 },
          { descricao: "Sem categoria", valor: 100, percentual: 33.3 },
        ],
      }))
      await renderCarregado()
      const caixa = within(secao("Maiores gastos"))
      expect(caixa.getByText("66,7%")).toBeInTheDocument()
      expect(caixa.getByText("33,3%")).toBeInTheDocument()
      expect(caixa.getByText("Sem categoria")).toBeInTheDocument()
      expect(caixa.queryByText("66.7%")).not.toBeInTheDocument()
    })

    it("sem despesa no mês mostra o vazio", async () => {
      getDashboard.mockResolvedValue(makeDashboard({ topCategorias: [] }))
      await renderCarregado()
      expect(within(secao("Maiores gastos")).getByText("Nenhuma despesa no período")).toBeInTheDocument()
    })
  })

  // ── transações recentes ────────────────────────────────────────────────────

  describe("Transações recentes", () => {
    it("cada linha tem a descrição e 'categoria · conta · quando'", async () => {
      await renderCarregado()
      const caixa = within(secao("Transações recentes"))
      expect(caixa.getByText("Salário outubro")).toBeInTheDocument()
      expect(caixa.getByText("Renda · Nubank Corrente · Hoje 14:30")).toBeInTheDocument()
      expect(caixa.getByText("Mercado Dia")).toBeInTheDocument()
      expect(caixa.getByText("Alimentação · Nubank Corrente · Ontem 09:05")).toBeInTheDocument()
      expect(caixa.getByText("Cartão · Nubank Corrente · 10/09 08:00")).toBeInTheDocument()
      // sem categoria e sem hora: pula o que falta, sem separador sobrando
      expect(caixa.getByText("Nubank Corrente · 15/09")).toBeInTheDocument()
    })

    it("mantém a ordem que a API mandou (a ordenação é do back)", async () => {
      await renderCarregado()
      const descricoes = within(secao("Transações recentes"))
        .getAllByText(/^(Salário outubro|Mercado Dia|Transferência para a Carteira|Pagamento de fatura)$/)
        .map((el) => el.textContent)
      expect(descricoes).toEqual(["Salário outubro", "Mercado Dia", "Transferência para a Carteira", "Pagamento de fatura"])
    })

    it("valor sem prefixo + ou −: entrada em verde, saída em vermelho", async () => {
      await renderCarregado()
      const caixa = within(secao("Transações recentes"))
      expect(caixa.getByText("R$ 4.200,00")).toHaveAttribute("data-tom", "entrada")
      expect(caixa.getByText("R$ 187,45")).toHaveAttribute("data-tom", "saida")
      expect(caixa.queryByText(/^[+\-−]\s*R\$/)).not.toBeInTheDocument()
    })

    it("transferência e pagamento de fatura são neutros: nem verde nem vermelho", async () => {
      await renderCarregado()
      const caixa = within(secao("Transações recentes"))
      expect(caixa.getByText("R$ 300,00")).toHaveAttribute("data-tom", "neutro") // transferência
      expect(caixa.getByText("R$ 1.250,90")).toHaveAttribute("data-tom", "neutro") // pagamento de fatura
    })

    it("a perna de ENTRADA de uma transferência também é neutra (não conta como ganho)", async () => {
      getDashboard.mockResolvedValue(makeDashboard({
        transacoesRecentes: [
          { id: "x1", descricao: "Transferência da Nubank", valor: 300, tipo: 2, data: HOJE, hora: "10:00:00", conta: "Carteira", ehTransferencia: true },
          { id: "x2", descricao: "Estorno de fatura", valor: 80, tipo: 2, data: HOJE, hora: "10:05:00", conta: "Nubank Corrente", ehPagamentoFatura: true },
        ],
      }))
      await renderCarregado()
      const caixa = within(secao("Transações recentes"))
      expect(caixa.getByText("R$ 300,00")).toHaveAttribute("data-tom", "neutro")
      expect(caixa.getByText("R$ 80,00")).toHaveAttribute("data-tom", "neutro")
    })

    describe("quando aconteceu", () => {
      const casos = [
        { caso: "hoje com hora", data: HOJE, hora: "14:30:00" as string | null, esperado: "Hoje 14:30" },
        { caso: "hoje sem hora", data: HOJE, hora: null, esperado: "Hoje" },
        { caso: "ontem com hora", data: ONTEM, hora: "09:05:00", esperado: "Ontem 09:05" },
        { caso: "dia mais antigo com hora", data: "2026-09-15", hora: "08:00:00", esperado: "15/09 08:00" },
        { caso: "dia mais antigo sem hora", data: "2026-09-15", hora: null, esperado: "15/09" },
        { caso: "hora com fração de segundo (TimeOnly do .NET)", data: HOJE, hora: "14:30:00.1234567", esperado: "Hoje 14:30" },
        { caso: "meia-noite em ponto", data: ONTEM, hora: "00:00:00", esperado: "Ontem 00:00" },
      ]
      it.each(casos)("$caso → '$esperado'", async ({ data, hora, esperado }) => {
        getDashboard.mockResolvedValue(makeDashboard({
          transacoesRecentes: [{ id: "q1", descricao: "Compra", valor: 10, tipo: 1, data, hora, categoria: "Lazer", conta: "Conta" }],
        }))
        await renderCarregado()
        expect(within(secao("Transações recentes")).getByText(`Lazer · Conta · ${esperado}`)).toBeInTheDocument()
      })

      it("na virada do ano, 31/12 ainda é 'Ontem' em 01/01", async () => {
        vi.setSystemTime(new Date(2027, 0, 1, 10, 0, 0))
        getDashboard.mockResolvedValue(makeDashboard({
          transacoesRecentes: [{ id: "q1", descricao: "Ceia", valor: 10, tipo: 1, data: "2026-12-31", hora: "23:10:00", categoria: "Lazer", conta: "Conta" }],
        }))
        await renderCarregado()
        expect(within(secao("Transações recentes")).getByText("Lazer · Conta · Ontem 23:10")).toBeInTheDocument()
      })

      it("sem categoria e sem conta, mostra só o quando", async () => {
        getDashboard.mockResolvedValue(makeDashboard({
          transacoesRecentes: [{ id: "q1", descricao: "Compra solta", valor: 10, tipo: 1, data: HOJE, hora: "14:30:00" }],
        }))
        await renderCarregado()
        expect(within(secao("Transações recentes")).getByText("Hoje 14:30")).toBeInTheDocument()
      })
    })

    it("sem transações mostra 'Nenhuma transação ainda'", async () => {
      getDashboard.mockResolvedValue(makeDashboard({ transacoesRecentes: [] }))
      await renderCarregado()
      expect(within(secao("Transações recentes")).getByText("Nenhuma transação ainda")).toBeInTheDocument()
    })
  })

  // ── orçamento do mês ───────────────────────────────────────────────────────

  describe("Orçamento do mês", () => {
    it("sem orçamento: só o botão 'Configurar', que leva pra /limites", async () => {
      await renderCarregado()
      const caixa = secao("Orçamento do mês")
      expect(within(caixa).queryByText(/Ainda pode gastar|Passou/)).not.toBeInTheDocument()
      expect(barras(caixa)).toHaveLength(0)

      fireEvent.click(within(caixa).getByRole("button", { name: "Configurar" }))
      expect(navigateSpy).toHaveBeenCalledWith("/limites")
    })

    it("dentro do limite: %, barra e quanto ainda pode gastar", async () => {
      getOrcamentos.mockResolvedValue({ data: [makeOrcamento()] })
      renderDash()
      await screen.findByText("Ainda pode gastar R$ 1.800,00")
      const caixa = secao("Orçamento do mês")
      expect(within(caixa).getByText("40%")).toHaveAttribute("data-tone", "ok")
      expect(within(caixa).getByText("R$ 1.200,00 de R$ 3.000,00")).toBeInTheDocument()
      expect(barras(caixa)).toEqual([{ largura: "40%", tom: "ok" }])
      expect(within(caixa).queryByText(/Passou/)).not.toBeInTheDocument()
      expect(within(caixa).queryByRole("button", { name: "Configurar" })).not.toBeInTheDocument()
    })

    it("em alerta (perto do limite): tom de atenção, mas ainda mostra quanto pode gastar", async () => {
      getOrcamentos.mockResolvedValue({ data: [makeOrcamento({
        valorGasto: 2550, valorRestante: 450, percentualConsumido: 85, emAlerta: true,
      })] })
      renderDash()
      await screen.findByText("Ainda pode gastar R$ 450,00")
      const caixa = secao("Orçamento do mês")
      expect(within(caixa).getByText("85%")).toHaveAttribute("data-tone", "warning")
      expect(barras(caixa)).toEqual([{ largura: "85%", tom: "warning" }])
    })

    it("ultrapassado: 'Passou X do limite', barra e % travados em 100%, tom de perigo", async () => {
      getOrcamentos.mockResolvedValue({ data: [makeOrcamento({
        valorGasto: 3500, valorRestante: -500, percentualConsumido: 116.7, emAlerta: true, ultrapassado: true,
      })] })
      renderDash()
      await screen.findByText("Passou R$ 500,00 do limite")
      const caixa = secao("Orçamento do mês")
      expect(within(caixa).queryByText(/Ainda pode gastar/)).not.toBeInTheDocument()
      expect(within(caixa).getByText("100%")).toHaveAttribute("data-tone", "danger")
      expect(within(caixa).getByText("R$ 3.500,00 de R$ 3.000,00")).toBeInTheDocument()
      expect(barras(caixa)).toEqual([{ largura: "100%", tom: "danger" }])
    })

    it("usa só o orçamento GERAL do mês: o de categoria não conta", async () => {
      getOrcamentos.mockResolvedValue({ data: [
        makeOrcamento({ id: "o-cat", categoriaId: "cat-1", categoriaNome: "Mercado", valorLimite: 500, valorGasto: 100, valorRestante: 400, percentualConsumido: 20 }),
        makeOrcamento({ id: "o-geral" }),
      ] })
      renderDash()
      await screen.findByText("Ainda pode gastar R$ 1.800,00")
      const caixa = within(secao("Orçamento do mês"))
      expect(caixa.queryByText(/R\$ 400,00/)).not.toBeInTheDocument() // o restante do orçamento de categoria
      expect(caixa.getByText("40%")).toBeInTheDocument()
    })

    it("só com orçamento de categoria, a caixa fica como 'sem orçamento' (Configurar)", async () => {
      getOrcamentos.mockResolvedValue({ data: [
        makeOrcamento({ id: "o-cat", categoriaId: "cat-1", categoriaNome: "Mercado" }),
      ] })
      await renderCarregado()
      expect(within(secao("Orçamento do mês")).getByRole("button", { name: "Configurar" })).toBeInTheDocument()
      expect(screen.queryByText(/Ainda pode gastar/)).not.toBeInTheDocument()
    })

    it("falha ao buscar o orçamento não derruba o resumo: sem alerta e sem orçamento", async () => {
      getOrcamentos.mockRejectedValue(new Error("boom"))
      await renderCarregado()
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
      expect(within(heroSaldo()).getByText("R$ 5.000,00")).toBeInTheDocument()
      expect(within(secao("Orçamento do mês")).getByRole("button", { name: "Configurar" })).toBeInTheDocument()
    })
  })

  // ── contas ─────────────────────────────────────────────────────────────────

  describe("Contas", () => {
    it("cada linha tem o nome, o banco (ou o tipo, se não tiver banco) e o saldo", async () => {
      await renderCarregado()
      const caixa = within(secao("Contas"))
      expect(caixa.getByText("Nubank Corrente")).toBeInTheDocument()
      expect(caixa.getByText("Nubank")).toBeInTheDocument() // bancoNome
      expect(caixa.getByText("R$ 3.200,00")).toBeInTheDocument()
      expect(caixa.getByText("Carteira")).toBeInTheDocument()
      expect(caixa.getByText("Dinheiro")).toBeInTheDocument() // sem banco: cai no tipo
      expect(caixa.getByText("R$ 1.950,00")).toBeInTheDocument()
    })

    it("mostra o logo do banco quando a conta tem", async () => {
      await renderCarregado()
      expect(within(secao("Contas")).getByRole("img", { name: "Nubank" }))
        .toHaveAttribute("src", "https://cdn.exemplo.test/nubank.png")
    })

    it("saldo negativo fica vermelho; positivo, não", async () => {
      await renderCarregado()
      const caixa = within(secao("Contas"))
      expect(caixa.getByText("-R$ 150,00")).toHaveAttribute("data-tom", "saida")
      expect(caixa.getByText("R$ 3.200,00")).not.toHaveAttribute("data-tom")
    })

    it("sem contas mostra 'Nenhuma conta cadastrada'", async () => {
      getDashboard.mockResolvedValue(makeDashboard({ saldoContas: [] }))
      await renderCarregado()
      expect(within(secao("Contas")).getByText("Nenhuma conta cadastrada")).toBeInTheDocument()
    })
  })

  // ── cartões ────────────────────────────────────────────────────────────────

  describe("Cartões", () => {
    it("sem cartão, a seção inteira não existe (nem o 'Ver todos')", async () => {
      await renderCarregado()
      expect(screen.queryByRole("heading", { name: "Cartões" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /Ver todos/ })).not.toBeInTheDocument()
    })

    it("mostra o nome com os 4 últimos dígitos, quanto do limite está usado e quando fecha", async () => {
      getDashboard.mockResolvedValue(makeDashboard({ cartoesResumo: [makeCartao()] }))
      await renderCarregado()
      const caixa = within(secao("Cartões"))
      expect(caixa.getByText("Nubank Roxinho")).toBeInTheDocument()
      expect(caixa.getByText("•••• 1234")).toBeInTheDocument()
      expect(caixa.getByText("R$ 4.250,00 de R$ 5.000,00")).toBeInTheDocument()
      expect(caixa.getByText("fecha em 3 dias")).toBeInTheDocument()
    })

    it("sem os 4 últimos dígitos, o nome vem sozinho (sem '••••')", async () => {
      getDashboard.mockResolvedValue(makeDashboard({ cartoesResumo: [makeCartao({ ultimosDigitos: null })] }))
      await renderCarregado()
      const caixa = within(secao("Cartões"))
      expect(caixa.getByText("Nubank Roxinho")).toBeInTheDocument()
      expect(caixa.queryByText(/••••/)).not.toBeInTheDocument()
    })

    it("dois cartões de mesmo nome se distinguem pelos dígitos", async () => {
      getDashboard.mockResolvedValue(makeDashboard({
        cartoesResumo: [
          makeCartao({ id: "a", ultimosDigitos: "1111" }),
          makeCartao({ id: "b", ultimosDigitos: "2222" }),
        ],
      }))
      await renderCarregado()
      const caixa = within(secao("Cartões"))
      expect(caixa.getAllByText("Nubank Roxinho")).toHaveLength(2)
      expect(caixa.getByText("•••• 1111")).toBeInTheDocument()
      expect(caixa.getByText("•••• 2222")).toBeInTheDocument()
    })

    it.each([
      { dias: 0, texto: "fecha hoje" },
      { dias: 1, texto: "fecha amanhã" },
      { dias: 2, texto: "fecha em 2 dias" },
      { dias: 30, texto: "fecha em 30 dias" },
    ])("faltando $dias dia(s): '$texto'", async ({ dias, texto }) => {
      getDashboard.mockResolvedValue(makeDashboard({ cartoesResumo: [makeCartao({ diasAteFechamento: dias })] }))
      await renderCarregado()
      expect(within(secao("Cartões")).getByText(texto)).toBeInTheDocument()
    })

    it.each([
      { caso: "nulo", dias: null },
      { caso: "ausente", dias: undefined },
    ])("sem data de fechamento ($caso), não mostra a linha 'fecha …'", async ({ dias }) => {
      getDashboard.mockResolvedValue(makeDashboard({ cartoesResumo: [makeCartao({ diasAteFechamento: dias })] }))
      await renderCarregado()
      expect(within(secao("Cartões")).queryByText(/^fecha/)).not.toBeInTheDocument()
    })

    it("a barra acompanha o uso do limite: ok até 69%, atenção de 70%, perigo de 90%, travada em 0–100%", async () => {
      const uso = [40, 69.9, 70, 89.9, 90, 150, -5]
      getDashboard.mockResolvedValue(makeDashboard({
        cartoesResumo: uso.map((pct, i) => makeCartao({ id: `c${i}`, nome: `Cartão ${i}`, percentualUsado: pct })),
      }))
      await renderCarregado()
      expect(barras(secao("Cartões"))).toEqual([
        { largura: "40%", tom: "ok" },
        { largura: "69.9%", tom: "ok" },
        { largura: "70%", tom: "warning" },
        { largura: "89.9%", tom: "warning" },
        { largura: "90%", tom: "danger" },
        { largura: "100%", tom: "danger" },
        { largura: "0%", tom: "ok" },
      ])
    })
  })

  // ── navegação ──────────────────────────────────────────────────────────────

  // ── Gasto no cartão (à parte do caixa — decisão 2026-10-03) ─────────────────

  describe("Gasto no cartão", () => {
    const compras: CompraCartao[] = [
      { descricao: "Tênis", valor: 300, data: HOJE, categoria: "Vestuário", cartao: "Nubank" },
      { descricao: "TV", valor: 200, data: "2026-08-03", parcela: 3, totalParcelas: 10, categoria: "Eletrônicos", cartao: "Nubank" },
    ]

    it("sem compra no cartão no mês, a caixa não aparece", async () => {
      await renderCarregado()
      expect(screen.queryByRole("heading", { name: "Gasto no cartão" })).not.toBeInTheDocument()
    })

    it("mostra o total à parte e cada compra; a parcela aparece com o número dela ('3/10')", async () => {
      getDashboard.mockResolvedValue(makeDashboard({ gastoCartaoMes: 500, comprasCartaoMes: compras }))
      await renderCarregado()
      const caixa = secao("Gasto no cartão")
      expect(within(caixa).getByText(/R\$\s?500,00/)).toBeInTheDocument()
      expect(within(caixa).getByText("Tênis")).toBeInTheDocument()
      expect(within(caixa).getByText("Vestuário · Nubank · Hoje")).toBeInTheDocument()
      expect(within(caixa).getByText("TV")).toBeInTheDocument()
      expect(within(caixa).getByTitle("Parcela 3 de 10")).toHaveTextContent("3/10")
      expect(within(caixa).getByText("Eletrônicos · Nubank · compra em 03/08")).toBeInTheDocument()
      expect(within(caixa).getByText(/R\$\s?200,00/)).toBeInTheDocument()
    })

    it("não mexe no 'Saiu' (segue o caixa que veio do resumo)", async () => {
      getDashboard.mockResolvedValue(makeDashboard({ gastoCartaoMes: 500, comprasCartaoMes: compras }))
      await renderCarregado()
      expect(stat("Saiu")).toHaveTextContent(/R\$\s?300,00/)
    })

    it("mais de 5 compras: mostra 5 e um link 'Mais N compras' que leva pros cartões", async () => {
      const muitas = Array.from({ length: 7 }, (_, i) => ({ descricao: `Compra ${i + 1}`, valor: 10, data: HOJE }))
      getDashboard.mockResolvedValue(makeDashboard({ gastoCartaoMes: 70, comprasCartaoMes: muitas }))
      await renderCarregado()
      const caixa = secao("Gasto no cartão")
      expect(within(caixa).getByText("Compra 5")).toBeInTheDocument()
      expect(within(caixa).queryByText("Compra 6")).not.toBeInTheDocument()
      fireEvent.click(within(caixa).getByRole("button", { name: /Mais 2 compras/ }))
      expect(navigateSpy).toHaveBeenCalledWith("/credit-cards")
    })

    it("olho fechado mascara o total e os valores das compras", async () => {
      setHideBalance(true)
      getDashboard.mockResolvedValue(makeDashboard({ gastoCartaoMes: 500, comprasCartaoMes: compras }))
      await renderCarregado()
      const caixa = secao("Gasto no cartão")
      expect(caixa).not.toHaveTextContent(/500,00|300,00|200,00/)
    })
  })

  describe("links 'Ver todas/todos'", () => {
    const casos = [
      { botao: "Ver todas", secao: "Transações recentes", rota: "/transactions", over: {} as Partial<DashboardData> },
      { botao: "Ver todas", secao: "Contas", rota: "/accounts", over: {} as Partial<DashboardData> },
      { botao: "Ver todos", secao: "Cartões", rota: "/credit-cards", over: { cartoesResumo: [makeCartao()] } as Partial<DashboardData> },
    ]
    it.each(casos)("'$botao' em $secao leva pra $rota", async ({ botao: nome, secao: titulo, rota, over }) => {
      getDashboard.mockResolvedValue(makeDashboard(over))
      await renderCarregado()
      fireEvent.click(within(secao(titulo)).getByRole("button", { name: nome }))
      expect(navigateSpy).toHaveBeenCalledTimes(1)
      expect(navigateSpy).toHaveBeenCalledWith(rota)
    })
  })

  // ── olho de ocultar saldo ──────────────────────────────────────────────────

  describe("olho de ocultar saldo", () => {
    // Qualquer "R$ " seguido de dígito é valor aparecendo; a máscara é "R$ ••••".
    const valorVisivel = () => /R\$\s*\d/.test(document.body.textContent ?? "")

    it("fechar o olho mascara todo valor em reais da tela, ao vivo, e abrir devolve", async () => {
      getDashboard.mockResolvedValue(makeDashboard({ cartoesResumo: [makeCartao()] }))
      getOrcamentos.mockResolvedValue({ data: [makeOrcamento()] })
      renderDash()
      await screen.findByText("Ainda pode gastar R$ 1.800,00")
      await carregar()
      expect(valorVisivel()).toBe(true) // controle: com o olho aberto os valores aparecem

      act(() => setHideBalance(true))
      await waitFor(() => expect(valorVisivel()).toBe(false))
      expect(within(heroSaldo()).getByText("R$ ••••")).toBeInTheDocument()
      expect(within(stat("Entrou")).getByText("R$ ••••")).toBeInTheDocument()
      expect(within(secao("Contas")).getAllByText("R$ ••••")).toHaveLength(3)
      expect(within(secao("Transações recentes")).getAllByText("R$ ••••")).toHaveLength(4)
      expect(within(secao("Cartões")).getByText("R$ •••• de R$ ••••")).toBeInTheDocument()
      expect(within(secao("Orçamento do mês")).getByText("Ainda pode gastar R$ ••••")).toBeInTheDocument()

      act(() => setHideBalance(false))
      await waitFor(() => expect(within(heroSaldo()).getByText("R$ 5.000,00")).toBeInTheDocument())
      expect(valorVisivel()).toBe(true)
    })

    it("já abre mascarado quando o olho estava fechado", async () => {
      setHideBalance(true)
      await renderCarregado()
      expect(within(heroSaldo()).getByText("R$ ••••")).toBeInTheDocument()
      expect(valorVisivel()).toBe(false)
    })

    it("mascara também a variação do saldo e as variações % de Entrou/Saiu", async () => {
      setHideBalance(true)
      await renderCarregado()
      expect(screen.getByText("R$ •••• a mais")).toBeInTheDocument()
      expect(within(stat("Entrou")).getByTitle("comparado ao mês anterior")).toHaveTextContent(/^••$/)
      expect(within(stat("Saiu")).getByTitle("comparado ao mês anterior")).toHaveTextContent(/^••$/)
      expect(screen.queryByText("25%")).not.toBeInTheDocument()
    })

    it("mascara as pendências do mês", async () => {
      setHideBalance(true)
      await renderCarregado()
      expect(screen.getByText("Ainda vai entrar")).toHaveTextContent("Ainda vai entrar R$ ••••")
      expect(screen.getByText("Ainda vai sair")).toHaveTextContent("Ainda vai sair R$ ••••")
    })
  })

  // ── padrão denso ───────────────────────────────────────────────────────────

  describe("padrão denso das telas internas", () => {
    it("não tem saudação nem título h1 no corpo: o título da página fica no navbar", async () => {
      await renderCarregado()
      expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
      expect(screen.queryByText(/Olá/)).not.toBeInTheDocument()
    })

    it("organiza o corpo em caixas com título h2", async () => {
      getDashboard.mockResolvedValue(makeDashboard({ cartoesResumo: [makeCartao()] }))
      await renderCarregado()
      const titulos = screen.getAllByRole("heading")
      titulos.forEach((h) => expect(h.tagName).toBe("H2"))
      expect(titulos.map((h) => h.textContent).sort()).toEqual([
        "Cartões", "Contas", "Maiores gastos", "Orçamento do mês", "Saldo nos últimos meses", "Transações recentes",
      ])
    })

    it("não tem mais a linha de atalhos (Nova transação, Transferir…)", async () => {
      await renderCarregado()
      expect(screen.queryByText("Atalhos rápidos")).not.toBeInTheDocument()
      expect(screen.queryByText("Nova transação")).not.toBeInTheDocument()
      expect(screen.queryByText("Transferir")).not.toBeInTheDocument()
    })

    it("tecla solta não dispara nada: sem atalho de teclado (N, T, C, F e setas)", async () => {
      await renderCarregado()
      let aberturas = 0
      const aoAbrir = () => { aberturas++ }
      window.addEventListener("openNewTransaction", aoAbrir)
      for (const key of ["n", "N", "t", "c", "f", "ArrowLeft", "ArrowRight"]) {
        fireEvent.keyDown(document.body, { key })
      }
      window.removeEventListener("openNewTransaction", aoAbrir)

      expect(aberturas).toBe(0) // N não abre mais o modal de nova transação
      expect(navigateSpy).not.toHaveBeenCalled() // T/C/F não navegam
      expect(getDashboard).toHaveBeenCalledTimes(1) // as setas não trocam de mês
      expect(screen.getByText("out 2026")).toBeInTheDocument()
    })
  })
})
