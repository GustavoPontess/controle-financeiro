import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import type { CheckUp, Sinal } from "../../types/Relatorio"
import type { DinheiroDoMes } from "../../types/DinheiroDoMes"
import type { LimitesDoMes } from "../../types/Limite"

const vazio = (mes: number) => ({ ano: 2026, mes, entrou: 0, saiu: 0, sobrou: 0 })
const dados: CheckUp = {
  ano: 2026, mes: 9, mesAtual: false, entrou: 5000, saiu: 1000, sobrou: 4000, percentualQueSobrou: 80,
  variacaoEntrou: 0, variacaoSaiu: 43, sobrouMesAnterior: 4300,
  contasFixasPorMes: 500, parcelasDoMes: 0, percentualComprometido: 10,
  praOndeFoi: [
    { categoriaId: "c1", nome: "Mercado", valor: 900, percentualDoGasto: 90, normal: 500, variacaoPercentual: 80, previsto: 0 },
    { categoriaId: "c2", nome: "Lazer", valor: 100, percentualDoGasto: 10, normal: 200, variacaoPercentual: -50, previsto: 0 },
  ],
  semCategoria: { valor: 300, percentualDoGasto: 23, quantidade: 4 },
  mesAMes: [...[10, 11, 12].map((m) => ({ ...vazio(m), ano: 2025 })), ...[1, 2, 3, 4, 5, 6].map(vazio),
    { ano: 2026, mes: 7, entrou: 5000, saiu: 700, sobrou: 4300 }, { ano: 2026, mes: 8, entrou: 5000, saiu: 700, sobrou: 4300 },
    { ano: 2026, mes: 9, entrou: 5000, saiu: 1000, sobrou: 4000 }],
  dinheiroGuardado: 12600, guardadoNasMetas: 2000, gastoNormal: 700, mesesDeReserva: 18,
  respostaReserva: { tom: "positivo", texto: "O que está nas contas cobre uns 18 meses do seu gasto normal.", acoes: [] },
  comprometido: {
    maioresContasFixas: [{ id: "f1", descricao: "Aluguel", porMes: 500 }], totalContasFixas: 1,
    parcelasProximosMeses: [], parcelasAteAno: null, parcelasAteMes: null, parcelaQueAcaba: null, faturas: [],
    folgaPorMes: null, metasPedemPorMes: 0, faixaAtencao: 40, faixaAlerta: 60,
    resposta: { tom: "positivo", texto: "Contas fixas e parcelas levam R$ 500,00 dos R$ 5.000,00 da renda (10%).", acoes: [] },
  },
  corte: {
    resposta: { tom: "neutro", texto: "Mercado passou do normal em setembro: R$ 400,00 a mais.", acoes: [] },
    itens: [{ tipo: "categoria", id: "c1", nome: "Mercado", valor: 900, normal: 500, aMais: 400, previsto: 0 }],
  },
  sinais: [{ chave: "sem-categoria-2026-9", origem: "dados", peso: 300, ehDeHoje: false,
    resposta: { tom: "neutro", texto: "4 lançamentos de setembro ainda sem categoria (R$ 300,00).", acoes: [{ rotulo: "Classificar", para: "/transacoes?categoriaId=00000000-0000-0000-0000-000000000000&mes=2026-09" }] } }],
  resposta: { tom: "positivo", texto: "Em setembro entraram R$ 5.000,00 e saíram R$ 1.000,00: sobraram R$ 4.000,00 (80% do que entrou).", acoes: [{ rotulo: "Ver o planejado", para: "/orcamento" }] },
}
const avisos: Sinal[] = [{ chave: "fatura-x", origem: "fatura", peso: 655.9, ehDeHoje: false,
  resposta: { tom: "alerta", texto: "Fatura do Nubank atrasada: R$ 655,90 desde 05/09.", acoes: [{ rotulo: "Ver cartões", para: "/cartoes" }] } }]

vi.mock("../../services/relatorioService", () => ({
  getCheckUp: vi.fn(async () => dados),
  getSinais: vi.fn(async () => avisos),
  urlCsvDoMes: (ano: number, mes: number) => `/csv/${ano}/${mes}`,
}))
vi.mock("../../services/dinheiroDoMesService", () => ({ getDinheiroDoMes: vi.fn(async () => { throw new Error("fora do teste") }) }))
vi.mock("../../services/limiteService", () => ({ getLimitesDoMes: vi.fn(async () => { throw new Error("fora do teste") }) }))
import { getCheckUp, getSinais } from "../../services/relatorioService"
import { getDinheiroDoMes } from "../../services/dinheiroDoMesService"
import { getLimitesDoMes } from "../../services/limiteService"
import Relatorios from "../../telas/Relatorios"

function Onde() { const l = useLocation(); return <p>em {l.pathname}{l.search}</p> }
const avisoDeLimite: Sinal = { chave: "limite-c1-2026-10", origem: "limite", peso: 200, ehDeHoje: false,
  resposta: { tom: "alerta", texto: "Mercado: vai passar R$ 200,00 do planejado.", acoes: [] } }

describe("Relatórios = check-up do mês", () => {
  it("mês fechado: o resumo no topo, cada categoria como parte da renda contra o normal, o corte, os avisos, o comprometido e a reserva, nessa ordem", async () => {
    vi.mocked(getSinais).mockResolvedValueOnce([avisoDeLimite, ...avisos])
    render(<MemoryRouter><Relatorios /></MemoryRouter>)

    // O topo é a resposta: quanto sobrou (com o % do que entrou) e a conta entrou − saiu.
    expect(await screen.findByText(/80% do que entrou ·/)).toBeInTheDocument()
    expect(getCheckUp).toHaveBeenCalled()
    expect(screen.getByText("43% a mais")).toBeInTheDocument() // saiu contra o mês anterior

    // O que vale olhar: Seus dados primeiro, depois os avisos das outras telas.
    const textos = screen.getAllByText(/ainda sem categoria \(R\$ 300,00\)|Fatura do Nubank atrasada/).map((e) => e.textContent)
    expect(textos[0]).toMatch(/sem categoria/)
    expect(await screen.findByText(/Fatura do Nubank atrasada/)).toBeInTheDocument()
    // Sem os limites na tela (mês fechado ou sem o dinheiro do mês), o aviso de limite fica nos avisos.
    expect(screen.getByText("Mercado: vai passar R$ 200,00 do planejado.")).toBeInTheDocument()
    // Cada coisa num lugar só: sem os achados curtos no topo (repetiam o corte, o comprometido e a reserva).
    expect(screen.queryByRole("list", { name: "Achados do mês" })).not.toBeInTheDocument()

    const categorias = screen.getByRole("list", { name: "Pra onde foi" })
    expect(within(categorias).getByText(/80% acima do normal/)).toHaveAttribute("data-tom", "alerta")
    expect(within(categorias).getByText(/50% abaixo do normal/)).toHaveAttribute("data-tom", "positivo")
    expect(within(categorias).getByText("4 lançamentos pra classificar")).toBeInTheDocument() // Sem categoria fora do ranking, por último
    expect(within(categorias).getByText("18%")).toBeInTheDocument() // Mercado: 900 dos 5.000 que entraram (não do gasto)
    expect(screen.getByRole("img", { name: /Gastos: 26% da renda, sobrou 74%/ })).toBeInTheDocument()

    expect(screen.getByText("Mercado passou do normal em setembro: R$ 400,00 a mais.")).toBeInTheDocument()
    expect(screen.getByText(/Contas fixas e parcelas levam R\$ 500,00/)).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "10% da renda comprometida" })).toBeInTheDocument()
    expect(screen.getByText("18 meses")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: /Reserva de 18 meses numa régua de 0 a 12/ })).toBeInTheDocument()
    expect(screen.getByText("Guardado nas metas (fora da reserva)")).toBeInTheDocument()

    // A linha de raciocínio, de cima pra baixo: como estou · por quê · o que faço · como venho · o que vem · se apertar.
    // Sem o dinheiro do mês, o topo do mês atual volta a ser o resumo (quanto sobrou).
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Resumo do mês", "Pra onde foi a sua renda", "Avisos do mês", "Entradas e saídas por mês", "Contas fixas e parcelas", "Reserva de emergência",
    ])

    expect(screen.getByRole("link", { name: /Exportar lançamentos do mês/ })).toHaveAttribute("href", expect.stringMatching(/^\/csv\/\d{4}\/\d+$/))
  })

  it("tocar numa categoria abre Transações filtrada por ela e pelo mês", async () => {
    render(
      <MemoryRouter initialEntries={["/relatorios"]}>
        <Routes>
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/transacoes" element={<Onde />} />
        </Routes>
      </MemoryRouter>,
    )
    const categorias = await screen.findByRole("list", { name: "Pra onde foi" })
    await userEvent.click(within(categorias).getByRole("button", { name: /Mercado/ }))
    expect(await screen.findByText(/em \/transacoes\?categoriaId=c1&mes=\d{4}-\d{2}/)).toBeInTheDocument()
  })

  it("no mês atual: quanto ainda dá pra gastar (por dia até o fim do mês) e os limites contando o que ainda vem", async () => {
    // Hoje é 20/10/2026 nos testes: faltam 12 dias (com hoje).
    const doMes: DinheiroDoMes = {
      ano: 2026, mes: 10, rendaEsperada: 8000, rendaRecebida: 5000, rendaBase: 8000, jaSaiu: 3000, aindaVemTotal: 800, livre: 4200, percentualUsado: 47.5,
      jaSaiuPorCategoria: [],
      aindaVem: [{ transacaoId: "t1", contaFixaId: "f1", descricao: "Aluguel", data: "2026-10-25", categoriaId: "c9", categoria: "Moradia", valor: 800 }],
      resposta: { tom: "neutro", texto: "", acoes: [] }, faturas: [], faturasAPagar: 0,
      parcelasFuturas: { total: 0, ateAno: null, ateMes: null, porMes: [] },
    }
    const limites: LimitesDoMes = {
      ano: 2026, mes: 10, editavel: true, totalLimite: 1000, totalGasto: 900, totalPrevisto: 300, semLimite: [],
      limites: [{ categoriaId: "c1", categoria: "Mercado", limite: 1000, gasto: 900, previsto: 300, sobra: 100, percentual: 90, situacao: "vai-passar",
        desdeAno: 2026, desdeMes: 1, percentualAlerta: 80, aindaVem: [], resposta: null, parcelasFuturas: 0, parcelasAteAno: null, parcelasAteMes: null }],
    }
    vi.mocked(getCheckUp).mockResolvedValueOnce({ ...dados, mes: 10, mesAtual: true })
    vi.mocked(getSinais).mockResolvedValueOnce([avisoDeLimite, ...avisos])
    vi.mocked(getDinheiroDoMes).mockResolvedValueOnce(doMes)
    vi.mocked(getLimitesDoMes).mockResolvedValueOnce(limites)
    render(<MemoryRouter><Relatorios /></MemoryRouter>)

    expect(await screen.findByText("Ainda dá pra gastar")).toBeInTheDocument()
    expect(screen.getByText(/por dia nos 12 dias que faltam/).textContent).toMatch(/R\$\s350,00/) // 4.200 ÷ 12
    expect(screen.getByRole("img", { name: "Da renda: já saiu 38%, ainda vem 10%" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Aluguel/ })).toHaveAttribute("href", "/contas-fixas/f1") // o que ainda vem
    const lista = screen.getByRole("list", { name: "Limites por categoria" })
    expect(within(lista).getByText("Vai passar")).toBeInTheDocument()
    expect(within(lista).getByRole("listitem").textContent).toMatch(/passa R\$\s200,00 com o que ainda vem/) // 1.000 − 900 − 300
    // A renda da seção "Pra onde foi" no mês atual é a renda do mês (8.000), não só o que entrou até agora (5.000).
    expect(await screen.findByText(/Da renda do mês/)).toBeInTheDocument()
    expect(within(screen.getByRole("list", { name: "Pra onde foi" })).getByText("11,3%")).toBeInTheDocument() // Mercado: 900 de 8.000
    // No mês atual o topo diz o mês ("Outubro até agora"), no lugar do resumo; ao lado, o que entrou (de quanto se
    // esperava) e o que saiu (contra o seu normal).
    const titulos = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)
    expect(titulos[0]).toBe("Outubro até agora")
    expect(screen.getByText(/esperados/).textContent).toMatch(/de R\$\s8\.000,00 esperados/)
    expect(screen.getByText(/seu normal é/).textContent).toMatch(/R\$\s700,00/)
    expect(titulos).not.toContain("Resumo do mês até agora")
    // O limite já está em "Limites por categoria" (com a etiqueta): o aviso dele não se repete nos avisos; os outros ficam.
    expect(await screen.findByText(/Fatura do Nubank atrasada/)).toBeInTheDocument()
    expect(screen.queryByText("Mercado: vai passar R$ 200,00 do planejado.")).not.toBeInTheDocument()
  })

  it("trocar pro mês anterior mantém o mesmo bloco no topo, com as palavras do mês fechado (quanto sobrou)", async () => {
    const setembro: DinheiroDoMes = {
      ano: 2026, mes: 9, rendaEsperada: 5000, rendaRecebida: 5000, rendaBase: 5000, jaSaiu: 1000, aindaVemTotal: 0, livre: 4000, percentualUsado: 20,
      jaSaiuPorCategoria: [{ categoriaId: "c1", nome: "Mercado", valor: 900, percentualDaRenda: 18 }, { categoriaId: "c2", nome: "Lazer", valor: 100, percentualDaRenda: 2 }],
      aindaVem: [], resposta: { tom: "positivo", texto: "", acoes: [] }, faturas: [], faturasAPagar: 0,
      parcelasFuturas: { total: 0, ateAno: null, ateMes: null, porMes: [] },
    }
    const limite = (categoriaId: string, categoria: string, valor: number, gasto: number, previsto: number, situacao: LimitesDoMes["limites"][number]["situacao"]) => ({
      categoriaId, categoria, limite: valor, gasto, previsto, sobra: valor - gasto, percentual: (gasto * 100) / valor, situacao,
      desdeAno: 2026, desdeMes: 1, percentualAlerta: 80, aindaVem: [], resposta: null, parcelasFuturas: 0, parcelasAteAno: null, parcelasAteMes: null,
    })
    const limitesDeSetembro: LimitesDoMes = {
      ano: 2026, mes: 9, editavel: false, totalLimite: 1100, totalGasto: 1000, totalPrevisto: 150, semLimite: [],
      limites: [limite("c1", "Mercado", 800, 900, 0, "passou"), limite("c2", "Lazer", 300, 100, 150, "vai-passar")],
    }
    // Outubro (hoje nos testes) sem o dinheiro do mês; setembro com.
    vi.mocked(getDinheiroDoMes).mockRejectedValueOnce(new Error("fora do teste")).mockResolvedValueOnce(setembro)
    vi.mocked(getLimitesDoMes).mockRejectedValueOnce(new Error("fora do teste")).mockResolvedValueOnce(limitesDeSetembro)
    render(<MemoryRouter><Relatorios /></MemoryRouter>)

    await userEvent.click(await screen.findByRole("button", { name: "Mês anterior" }))

    expect(await screen.findByRole("heading", { level: 2, name: "Como foi setembro" })).toBeInTheDocument()
    expect(screen.queryByText("Ainda dá pra gastar")).not.toBeInTheDocument()
    expect(screen.getByText("80% do que entrou")).toBeInTheDocument() // embaixo do "Sobrou" grande
    expect(screen.getByText("43% a mais")).toBeInTheDocument() // o que saiu contra agosto
    expect(screen.queryByText(/esperados|seu normal é/)).not.toBeInTheDocument() // frases do mês atual
    expect(screen.queryByText(/por dia/)).not.toBeInTheDocument() // o mês acabou
    const lista = screen.getByRole("list", { name: "Limites por categoria" })
    const [mercado, lazer] = within(lista).getAllByRole("listitem")
    expect(within(mercado).getByText("Passou")).toBeInTheDocument()
    expect(mercado.textContent).toMatch(/passou R\$\s100,00/)
    // "Vai passar" não existe num mês que acabou: o previsto que não veio não conta, sobrou do limite.
    expect(within(lazer).queryByText("Vai passar")).not.toBeInTheDocument()
    expect(lazer.textContent).toMatch(/sobrou R\$\s200,00 do limite/)
  })
})
