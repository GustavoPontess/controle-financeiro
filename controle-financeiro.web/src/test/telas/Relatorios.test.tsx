import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import type { AnoDoCheckUp, CheckUp, Sinal } from "../../types/Relatorio"
import type { DinheiroDoMes } from "../../types/DinheiroDoMes"
import type { LimitesDoMes } from "../../types/Limite"

const vazio = (mes: number) => ({ ano: 2026, mes, entrou: 0, saiu: 0, sobrou: 0, investido: 0, rendaEsperada: 0, despesasPlanejadas: 0, investimentosPlanejados: 0 })
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
    { ...vazio(7), entrou: 5000, saiu: 700, sobrou: 4300 }, { ...vazio(8), entrou: 5000, saiu: 700, sobrou: 4300, investido: 500 },
    { ...vazio(9), entrou: 5000, saiu: 1000, sobrou: 4000, investido: 300, rendaEsperada: 5000, despesasPlanejadas: 1200, investimentosPlanejados: 400 }],
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
// O ano de 2026 até outubro (hoje nos testes): os meses da linha do tempo e o "Ano completo".
const doAno: AnoDoCheckUp = {
  ano: 2026, ateMes: 10, anoAtual: true, entrou: 15000, saiu: 2400, sobrou: 12600, investido: 800,
  rendaEsperada: 20000, despesasPlanejadas: 3600, investimentosPlanejados: 1200,
  meses: [...dados.mesAMes.filter((m) => m.ano === 2026), vazio(10), { ...vazio(11), rendaEsperada: 5000, despesasPlanejadas: 1200 }, vazio(12)],
  categorias: [
    { categoriaId: "c1", nome: "Mercado", valor: 2100, percentualDoGasto: 87.5, normal: 1500, variacaoPercentual: 40, limite: 2000 },
    { categoriaId: "c2", nome: "Lazer", valor: 300, percentualDoGasto: 12.5, normal: 0, variacaoPercentual: null, limite: null },
  ],
  semCategoria: null,
  primeiroAno: 2025,
  ritmo: { mesesNaMedia: 3, entrouPorMes: 5000, saiuPorMes: 800, sobrouPorMes: 4200, fechaOAnoCom: 37000 },
  comprometido: { contasFixas: 1500, parcelas: 300, parcelasAteDezembro: 200, percentualDoQueEntrou: 12 },
  reserva: { dinheiroGuardado: 9600, guardadoNasMetas: 0, gastoMedioPorMes: 800, mesesDeReserva: 12, resposta: null },
}
const avisos: Sinal[] = [{ chave: "fatura-x", origem: "fatura", peso: 655.9, ehDeHoje: false,
  resposta: { tom: "alerta", texto: "Fatura do Nubank atrasada: R$ 655,90 desde 05/09.", acoes: [{ rotulo: "Ver cartões", para: "/cartoes" }] } }]

vi.mock("../../services/relatorioService", () => ({
  getCheckUp: vi.fn(async () => dados),
  getSinais: vi.fn(async () => avisos),
  getAno: vi.fn(async () => doAno),
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
  it("sem o dinheiro do mês: o resumo no topo com as categorias embaixo (parte da renda, normal), o que dá pra fazer, o comprometido e a reserva, nessa ordem", async () => {
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

    const categorias = screen.getByRole("list", { name: "Categorias do mês" })
    expect(within(categorias).getByText(/80% acima do normal/)).toHaveAttribute("data-tom", "alerta")
    expect(within(categorias).getByText(/50% abaixo do normal/)).toHaveAttribute("data-tom", "positivo")
    expect(within(categorias).getByText("4 lançamentos pra classificar")).toBeInTheDocument() // Sem categoria fora do ranking, por último
    expect(within(categorias).getByText("18%")).toBeInTheDocument() // Mercado: 900 dos 5.000 que entraram (não do gasto)
    // A barra da renda aparece uma vez só (no topo, com o dinheiro do mês); aqui, sem ele, nenhuma.
    expect(screen.queryByRole("img", { name: /Gastos:/ })).not.toBeInTheDocument()

    expect(screen.getByText("Mercado passou do normal em setembro: R$ 400,00 a mais.")).toBeInTheDocument()
    expect(screen.getByText(/Contas fixas e parcelas levam R\$ 500,00/)).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "10% da renda comprometida" })).toBeInTheDocument()
    expect(screen.getByText("18 meses")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: /Reserva de 18 meses numa régua de 0 a 12/ })).toBeInTheDocument()
    expect(screen.getByText("Guardado nas metas (fora da reserva)")).toBeInTheDocument()

    // A linha de raciocínio, de cima pra baixo: como estou e por quê · o que faço · o que vem · se apertar. O "como venho
    // indo" é a linha do tempo no alto (não tem mais o gráfico do mês a mês no pé da tela).
    // Sem o dinheiro do mês, o topo do mês atual volta a ser o resumo (quanto sobrou).
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Resumo do mês", "O que dá pra fazer", "Contas fixas e parcelas", "Reserva de emergência",
    ])
    // Ao lado do título: o ano (uma lista do primeiro ano com lançamento até o atual, já no atual), o período (o mês de
    // hoje) e o Baixar.
    await screen.findByRole("group", { name: "Meses" })
    const anoEscolhido = screen.getByRole("combobox", { name: "Ano" })
    expect(anoEscolhido).toHaveTextContent("2026")
    await userEvent.click(anoEscolhido) // a lista do site (não a do sistema)
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["2026", "2025"])
    await userEvent.keyboard("{Escape}")
    expect(screen.getByRole("combobox", { name: "Período" })).toHaveTextContent("Outubro")
    // A linha do tempo: o ano atual, de janeiro até o mês de hoje (outubro, nos testes), com o atual escolhido.
    const meses = within(await screen.findByRole("group", { name: "Meses" })).getAllByRole("button")
    expect(meses.map((b) => b.getAttribute("aria-label")?.split(":")[0])).toEqual(
      ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map((m) => `${m} de 2026`))
    // Sempre de janeiro a dezembro: os meses que ainda não chegaram ficam apagados, só com o planejado, e sem clique.
    expect(meses[10]).toBeDisabled()
    expect(meses[10]).toHaveAccessibleName(/Novembro de 2026: ainda não chegou \(planejado: renda R\$\s5\.000,00, despesas R\$\s1\.200,00\)/)
    expect(meses[11]).toHaveAccessibleName("Dezembro de 2026: ainda não chegou")
    expect(meses[9]).toHaveAttribute("aria-pressed", "true")
    expect(meses[8]).toHaveAccessibleName(/Setembro de 2026: entrou R\$\s5\.000,00 \(planejado R\$\s5\.000,00\), saiu R\$\s1\.000,00 \(planejado R\$\s1\.200,00\), investiu R\$\s300,00 \(planejado R\$\s400,00\), sobrou R\$\s4\.000,00/)
    expect(meses[7]).toHaveAccessibleName(/Agosto de 2026: entrou R\$\s5\.000,00, saiu R\$\s700,00, investiu R\$\s500,00, sobrou/) // sem planejado, sem parênteses

    // A linha do tempo e o "Baixar" ficam no bloco de cima (a linha logo abaixo do título); sem link pro Orçamento ali.
    const topo = screen.getByRole("heading", { level: 2, name: "Resumo do mês" }).closest("section")!
    expect(within(topo).getByRole("group", { name: "Meses" })).toBeInTheDocument()
    expect(within(topo).getByRole("button", { name: "Baixar este relatório em PDF" })).toBeInTheDocument()
    expect(within(topo).queryByRole("link", { name: /Orçamento/ })).not.toBeInTheDocument()
  })

  it("Período = Ano completo: o ano somado contra o planejado e as categorias do ano; o que é de mês some", async () => {
    render(<MemoryRouter><Relatorios /></MemoryRouter>)
    await screen.findByRole("group", { name: "Meses" })
    await userEvent.click(screen.getByRole("combobox", { name: "Período" }))
    await userEvent.click(screen.getByRole("option", { name: "Ano completo" }))

    expect(await screen.findByRole("heading", { level: 2, name: "2026 até agora" })).toBeInTheDocument()
    // Nenhum mês escolhido: todos coloridos.
    const meses = within(screen.getByRole("group", { name: "Meses" })).getAllByRole("button")
    expect(meses.every((b) => b.getAttribute("aria-pressed") === "false")).toBe(true)
    expect(screen.getByText("Sobrou até agora")).toBeInTheDocument()
    expect(screen.getByText(/84% do que entrou · janeiro a outubro/)).toBeInTheDocument()
    const conta = screen.getByText("Investiu").closest("dl")!
    expect(conta.textContent).toMatch(/Entrou\s*R\$\s15\.000,00\s*de R\$\s20\.000,00 planejados/) // contra a renda esperada do ano
    expect(conta.textContent).toMatch(/Saiu\s*R\$\s2\.400,00\s*de R\$\s3\.600,00 planejados/)
    const categorias = screen.getByRole("list", { name: "Categorias do ano" })
    const mercado = within(categorias).getByRole("button", { name: /Mercado/ })
    expect(mercado.textContent).toMatch(/40% acima de jan–out\/2025/)
    expect(mercado.textContent).toMatch(/limite do ano R\$\s2\.000,00: passou R\$\s100,00/)
    expect(within(mercado).getByText("Passou")).toBeInTheDocument()
    expect(within(categorias).getByText("Nova em 2026")).toBeInTheDocument()
    // Baixar = este relatório em PDF (a impressão do navegador, com o nome do arquivo dizendo o período).
    const imprimir = vi.spyOn(window, "print").mockImplementation(() => { expect(document.title).toBe("Relatório 2026") })
    await userEvent.click(screen.getByRole("button", { name: "Baixar este relatório em PDF" }))
    expect(imprimir).toHaveBeenCalled()
    imprimir.mockRestore()
    // Etapa 2: o ritmo do ano no topo, contas fixas e parcelas do ano e a reserva pelo gasto médio do ano; "O que dá pra
    // fazer" (do mês) não aparece.
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["2026 até agora", "Contas fixas e parcelas", "Reserva de emergência"])
    expect(screen.getByText(/Por mês, em média/).textContent).toMatch(/entrou R\$\s5\.000,00, saiu R\$\s800,00, sobrou R\$\s4\.200,00\. No ritmo de agora, 2026 fecha com R\$\s37\.000,00 sobrando/)
    expect(screen.getByText("Parcelas que ainda caem até dezembro")).toBeInTheDocument()
    expect(screen.getByText("12 meses")).toBeInTheDocument()
    expect(screen.getByText(/de gasto médio por mês no ano/)).toBeInTheDocument()

    // Tocar num mês volta pro mês.
    await userEvent.click(within(screen.getByRole("group", { name: "Meses" })).getByRole("button", { name: /^Setembro de 2026/ }))
    expect(screen.getByRole("combobox", { name: "Período" })).toHaveTextContent("Setembro")
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
    const categorias = await screen.findByRole("list", { name: "Categorias do mês" })
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
    // O limite mora na linha da categoria (lista única): a marca, a etiqueta e a frase junto do normal.
    const categorias = await screen.findByRole("list", { name: "Categorias do mês" })
    const mercado = within(categorias).getByRole("button", { name: /Mercado/ })
    expect(within(mercado).getByText("Vai passar")).toBeInTheDocument()
    expect(mercado.textContent).toMatch(/80% acima do normal/)
    expect(mercado.textContent).toMatch(/limite R\$\s1\.000,00: passa R\$\s200,00 com o que ainda vem/) // 1.000 − 900 − 300
    expect(screen.queryByRole("list", { name: "Limites por categoria" })).not.toBeInTheDocument() // não é mais uma lista à parte
    // A parte de cada categoria é da renda do mês (8.000), não só do que entrou até agora (5.000).
    expect(within(categorias).getByText("11,3%")).toBeInTheDocument() // Mercado: 900 de 8.000
    // No mês atual o topo diz o mês ("Outubro até agora"), no lugar do resumo; ao lado, o que entrou (de quanto se
    // esperava) e o que saiu (contra o seu normal).
    const titulos = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)
    expect(titulos[0]).toBe("Outubro até agora")
    expect(screen.getByText(/esperados/).textContent).toMatch(/de R\$\s8\.000,00 esperados/)
    expect(screen.getByText(/seu normal é/).textContent).toMatch(/R\$\s700,00/)
    expect(titulos).not.toContain("Resumo do mês até agora")
    // O limite já está na linha da categoria (com a etiqueta): o aviso dele não se repete nos avisos; os outros ficam.
    expect(await screen.findByText(/Fatura do Nubank atrasada/)).toBeInTheDocument()
    expect(screen.queryByText("Mercado: vai passar R$ 200,00 do planejado.")).not.toBeInTheDocument()
  })

  it("tocar no mês anterior na linha do tempo mantém o mesmo bloco no topo, com as palavras do mês fechado (quanto sobrou)", async () => {
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

    const linhaDoTempo = await screen.findByRole("group", { name: "Meses" })
    await userEvent.click(within(linhaDoTempo).getByRole("button", { name: /^Setembro de 2026/ }))
    // A linha do tempo não muda com o mês: só o destaque anda.
    expect(within(linhaDoTempo).getByRole("button", { name: /^Setembro de 2026/ })).toHaveAttribute("aria-pressed", "true")
    expect(within(linhaDoTempo).getAllByRole("button")).toHaveLength(12)

    expect(await screen.findByRole("heading", { level: 2, name: "Como foi setembro" })).toBeInTheDocument()
    expect(screen.queryByText("Ainda dá pra gastar")).not.toBeInTheDocument()
    expect(screen.getByText("80% do que entrou")).toBeInTheDocument() // embaixo do "Sobrou" grande
    expect(screen.getByText("43% a mais")).toBeInTheDocument() // o que saiu contra agosto
    expect(screen.queryByText(/esperados|seu normal é/)).not.toBeInTheDocument() // frases do mês atual
    expect(screen.queryByText(/por dia/)).not.toBeInTheDocument() // o mês acabou
    const categorias = screen.getByRole("list", { name: "Categorias do mês" })
    const mercado = within(categorias).getByRole("button", { name: /Mercado/ })
    const lazer = within(categorias).getByRole("button", { name: /Lazer/ })
    expect(within(mercado).getByText("Passou")).toBeInTheDocument()
    expect(mercado.textContent).toMatch(/passou R\$\s100,00/)
    // "Vai passar" não existe num mês que acabou: o previsto que não veio não conta, sobrou do limite.
    expect(within(lazer).queryByText("Vai passar")).not.toBeInTheDocument()
    expect(lazer.textContent).toMatch(/limite R\$\s300,00: sobrou R\$\s200,00/)
  })
})
