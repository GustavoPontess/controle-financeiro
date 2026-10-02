import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import ReconciliacaoPage from "../../pages/Reconciliacao/ReconciliacaoPage"
import type { Conta } from "../../types/Conta"
import type { Transaction } from "../../types/Transaction"
import type { ReconciliacaoMarco } from "../../types/Reconciliacao"

// Tela /reconciliacao (reescrita): hero (seletor de conta + saldo + chip de confiança
// HONESTO "Conferido dd/mm" × "A conferir" + delta desde a última conferência + "Conferir hoje") → coluna
// esquerda = painel conferir (protagonista: saldo real × calculado, "Movimentos desde dd/mm" do marco ANTERIOR ao dia) + coluna
// direita = calendário de marcos + histórico. Cobre: hero e chip (incluindo o limiar de 0,005), troca de conta
// recarregando marcos, abertura JÁ conferindo HOJE, os 3 desfechos (bate = "Confere — gravar marco" /
// baseline = "Definir saldo inicial" / verificação = "Ajustar" + "Lançar o que falta"), lista de movimentos
// (listTransactionsPage), histórico (incl. partida/derivado), marco existente (alterar valor / remover com confirmação),
// navegação de mês e os erros.
//
// "Agora" é FIXO (só o Date é falsificado; timers seguem reais pro waitFor): a tela decide pendente/futuro/
// movimentos comparando dia × hoje, então o teste não pode depender do dia em que roda.
const { notify, navigateSpy, getContas, listMarcos, getSaldoCalculado, criarMarco, removerMarco, listTransactionsPage } = vi.hoisted(() => ({
  notify: vi.fn(),
  navigateSpy: vi.fn(),
  getContas: vi.fn(),
  listMarcos: vi.fn(),
  getSaldoCalculado: vi.fn(),
  criarMarco: vi.fn(),
  removerMarco: vi.fn(),
  listTransactionsPage: vi.fn(),
}))

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return { ...actual, useOutletContext: () => ({ notify }), useNavigate: () => navigateSpy }
})
vi.mock("../../services/contaService", () => ({ getContas: (...a: unknown[]) => getContas(...a) }))
vi.mock("../../services/reconciliacaoService", () => ({
  listMarcos: (...a: unknown[]) => listMarcos(...a),
  getSaldoCalculado: (...a: unknown[]) => getSaldoCalculado(...a),
  criarMarco: (...a: unknown[]) => criarMarco(...a),
  removerMarco: (...a: unknown[]) => removerMarco(...a),
}))
vi.mock("../../services/transactionService", () => ({ listTransactionsPage: (...a: unknown[]) => listTransactionsPage(...a) }))

// --- Datas (relógio fixo: 20/06/2026 10:30, hora local). ---
const AGORA = new Date(2026, 5, 20, 10, 30, 0)
const ANO = 2026
const MES = 5 // junho, 0-based
const pad2 = (n: number) => String(n).padStart(2, "0")
const HOJE = 20
const DIA_MARCO = 15 // passado em relação a hoje
const DIA_LIVRE = 10 // passado, sem marco
const isoDia = (dia: number) => `${ANO}-${pad2(MES + 1)}-${pad2(dia)}`
const dataLabel = (dia: number) => `${pad2(dia)}/${pad2(MES + 1)}/${ANO}`
const diaMes = (dia: number) => `${pad2(dia)}/${pad2(MES + 1)}`
// Hoje usa a hora atual no cálculo/gravação; os outros dias "23:59" (fixo, assertável).
const HOJE_CALCULO = `${isoDia(HOJE)}T10:30:00.000Z`
const fimDoDia = (dia: number) => `${isoDia(dia)}T23:59:00.000Z`

const contaA = { id: "c1", nome: "Conta Corrente", saldoAtual: 1234.56 } as unknown as Conta
const contaB = { id: "c2", nome: "Poupança", saldoAtual: 99 } as unknown as Conta
const SALDO_A = /R\$\s?1\.234,56/
const GRAVAR = "Confere — gravar marco"

function marco(dia: number, over: Partial<ReconciliacaoMarco> = {}, mesOffset = 0): ReconciliacaoMarco {
  return {
    id: `m-${dia}`,
    contaId: "c1",
    dataHora: new Date(Date.UTC(ANO, MES + mesOffset, dia, 14, 30)).toISOString(),
    saldoDeclarado: 500,
    saldoCalculado: 500,
    diferenca: 0,
    tipo: 2,
    temAjuste: false,
    criadoEm: new Date(Date.UTC(ANO, MES + mesOffset, dia, 14, 31)).toISOString(),
    ...over,
  }
}

function tx(id: string, descricao: string, valor: number, tipo: number, dia: number): Transaction {
  return { id, descricao, valor, tipo, categoriaId: null, data: `${isoDia(dia)}T12:00:00` } as Transaction
}

// A tela já seleciona HOJE no mount e chama getSaldoCalculado pra ele. Por padrão descarto essa chamada
// (e qualquer toast do mount) depois que a tela assenta, pra que os testes de clique em dia assertem só o
// que o CLIQUE fez. Os testes do próprio mount passam `{ manterMount: true }`.
async function renderPage({ manterMount = false }: { manterMount?: boolean } = {}) {
  render(<PontesThemeProvider><ReconciliacaoPage /></PontesThemeProvider>)
  await screen.findByText(SALDO_A) // contas carregaram
  await waitFor(() => expect(listMarcos).toHaveBeenCalledWith("c1"))
  await act(async () => {}) // deixa o setMarcos e o cálculo de hoje assentarem
  if (!manterMount) {
    getSaldoCalculado.mockClear()
    notify.mockClear()
  }
}

// Célula do calendário: nome acessível = só o número do dia (o ícone de check é decorativo). Nome EXATO
// pra não casar com as linhas do histórico ("15/06 ...") nem "1" com "15".
const botaoDia = (n: number) => screen.getByRole("button", { name: String(n) })
const clicarDia = (n: number) => fireEvent.click(botaoDia(n))
// Digita em dígitos crus no campo de saldo real (PontesInput + máscara: "10000" -> "100,00").
const digitarSaldoReal = (centavos: string) =>
  fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: centavos } })
// Linha "rótulo + valor" do resultado (Calculado / Declarado / Diferença).
const linha = (rotulo: string) => screen.getByText(rotulo).parentElement as HTMLElement
const historico = () => screen.getByText("Histórico de marcos").nextElementSibling as HTMLElement
// Abre o painel de conferir no dia livre e espera o cálculo do app chegar.
async function abrirDiaLivre() {
  clicarDia(DIA_LIVRE)
  await screen.findByText("Saldo real da conta")
  await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalledWith("c1", fimDoDia(DIA_LIVRE)))
}

describe("ReconciliacaoPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(AGORA)
    notify.mockReset()
    navigateSpy.mockReset()
    getContas.mockReset().mockResolvedValue([contaA, contaB])
    listMarcos.mockReset().mockResolvedValue([])
    getSaldoCalculado.mockReset().mockResolvedValue(100)
    criarMarco.mockReset().mockResolvedValue(marco(DIA_LIVRE))
    removerMarco.mockReset().mockResolvedValue(undefined)
    listTransactionsPage.mockReset().mockResolvedValue({ items: [], total: 0 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ---------------------------------------------------------------- seletor de conta (dentro do hero)

  it("o seletor de conta (no hero) já vem na 1ª conta e carrega os marcos dela", async () => {
    await renderPage()
    expect(screen.getByRole("button", { name: "Conta Corrente" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Poupança" })).not.toBeInTheDocument() // menu fechado
    expect(listMarcos).toHaveBeenCalledWith("c1")
  })

  it("o seletor oferece todas as contas do usuário", async () => {
    await renderPage()
    fireEvent.click(screen.getByRole("button", { name: "Conta Corrente" }))
    expect(await screen.findByRole("button", { name: "Poupança" })).toBeInTheDocument()
  })

  it("sem nenhuma conta: não consulta marcos nem movimentos e mostra saldo zerado", async () => {
    getContas.mockResolvedValue([])
    render(<PontesThemeProvider><ReconciliacaoPage /></PontesThemeProvider>)
    await waitFor(() => expect(getContas).toHaveBeenCalled())
    await act(async () => {})
    expect(screen.getByText(/R\$\s?0,00/)).toBeInTheDocument()
    expect(listMarcos).not.toHaveBeenCalled()
    expect(listTransactionsPage).not.toHaveBeenCalled()
    // sem conta não há o que conferir: nada de cálculo de hoje, painel pede pra escolher um dia
    expect(getSaldoCalculado).not.toHaveBeenCalled()
    expect(screen.getByText(/Escolha um dia no calendário/)).toBeInTheDocument()
  })

  it("trocar a conta no seletor recarrega os marcos, mostra o saldo dela e volta a conferir HOJE na nova conta", async () => {
    // c1 tem um marco (e o saldo dela bate com ele → "Conferido"); c2 não tem nenhum
    listMarcos.mockImplementation(async (id: string) => (id === "c1" ? [marco(DIA_MARCO, { saldoDeclarado: 1234.56, saldoCalculado: 1234.56 })] : []))
    await renderPage()
    expect(await screen.findByText(`Conferido ${diaMes(DIA_MARCO)}`)).toBeInTheDocument()
    expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu")

    fireEvent.click(screen.getByRole("button", { name: "Conta Corrente" }))
    fireEvent.click(await screen.findByRole("button", { name: "Poupança" }))

    await waitFor(() => expect(listMarcos).toHaveBeenLastCalledWith("c2"))
    expect(await screen.findByText(/R\$\s?99,00/)).toBeInTheDocument()
    expect(screen.queryByText(SALDO_A)).not.toBeInTheDocument()
    // marcos da conta NOVA: histórico vazio, calendário sem o marco da outra conta, chip "A conferir"
    expect(await screen.findByText(/Nenhuma conferência ainda/)).toBeInTheDocument()
    expect(botaoDia(DIA_MARCO)).not.toHaveAttribute("data-marco")
    expect(screen.getByText("A conferir")).toBeInTheDocument()
    expect(screen.queryByText(`Conferido ${diaMes(DIA_MARCO)}`)).not.toBeInTheDocument()
    // painel reabre em "Conferir hoje" já calculando o saldo da NOVA conta (e buscando os movimentos dela)
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenLastCalledWith("c2", HOJE_CALCULO))
    expect(await screen.findByText(`hoje, ${diaMes(HOJE)}`)).toBeInTheDocument()
    expect(screen.getByText("Saldo real da conta")).toBeInTheDocument()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 6, expect.objectContaining({ contaId: "c2" })))
  })

  // ---------------------------------------------------------------- hero

  it("hero mostra 'Saldo em conta' com o saldo da 1ª conta, 'A conferir' e nenhuma linha de delta quando não há marcos", async () => {
    await renderPage()
    expect(screen.getByText("Saldo em conta")).toBeInTheDocument()
    expect(screen.getByText(SALDO_A)).toBeInTheDocument()
    expect(screen.queryByText(/R\$\s?99,00/)).not.toBeInTheDocument() // saldo da 2ª conta não aparece
    const chip = screen.getByText("A conferir")
    expect(chip).toHaveAttribute("data-ok", "false")
    expect(screen.queryByText(/desde a última conferência/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Conferir hoje" })).toBeInTheDocument()
  })

  it("chip 'Conferido dd/mm' (verde) quando o saldo atual bate com o último marco — e não mostra delta", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { saldoDeclarado: 1234.56, saldoCalculado: 1234.56 })])
    await renderPage()
    const chip = await screen.findByText(`Conferido ${diaMes(DIA_MARCO)}`)
    expect(chip).toHaveAttribute("data-ok", "true")
    expect(screen.queryByText("A conferir")).not.toBeInTheDocument()
    expect(screen.queryByText(/desde a última conferência/)).not.toBeInTheDocument()
  })

  it("chip 'A conferir' + delta POSITIVO quando o saldo atual está acima do último marco", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { saldoDeclarado: 1000, saldoCalculado: 1000 })])
    await renderPage()
    expect(await screen.findByText(/\+R\$\s?234,56 desde a última conferência/)).toBeInTheDocument()
    expect(screen.getByText("A conferir")).toHaveAttribute("data-ok", "false")
    expect(screen.queryByText(/Conferido \d{2}\/\d{2}/)).not.toBeInTheDocument()
  })

  it("chip 'A conferir' + delta NEGATIVO (com sinal de menos) quando o saldo atual está abaixo do último marco", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { saldoDeclarado: 2000, saldoCalculado: 2000 })])
    await renderPage()
    expect(await screen.findByText(/−R\$\s?765,44 desde a última conferência/)).toBeInTheDocument()
    expect(screen.getByText("A conferir")).toBeInTheDocument()
    expect(screen.queryByText(/\+R\$\s?765,44/)).not.toBeInTheDocument()
  })

  it.each([
    ["diferença de 0,004 (< meio centavo) conta como conferido", 0.004, true],
    ["diferença de 0,006 (>= meio centavo) já é 'a conferir'", 0.006, false],
  ])("limiar do chip: %s", async (_nome, folga, esperaConferido) => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { saldoDeclarado: 1234.56 + folga })])
    await renderPage()
    await screen.findByRole("button", { name: String(DIA_MARCO) })
    await waitFor(() => {
      if (esperaConferido) expect(screen.getByText(`Conferido ${diaMes(DIA_MARCO)}`)).toBeInTheDocument()
      else expect(screen.getByText("A conferir")).toBeInTheDocument()
    })
    if (esperaConferido) expect(screen.queryByText(/desde a última conferência/)).not.toBeInTheDocument()
    else expect(screen.getByText(/desde a última conferência/)).toBeInTheDocument()
  })

  it("o chip e o delta usam o marco MAIS RECENTE (o 1º da lista, que o backend devolve desc)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { saldoDeclarado: 1234.56 }), marco(5, { tipo: 1, saldoDeclarado: 100 })])
    await renderPage()
    expect(await screen.findByText(`Conferido ${diaMes(DIA_MARCO)}`)).toBeInTheDocument()
    expect(screen.queryByText(`Conferido ${diaMes(5)}`)).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------- calendário

  it("marca no calendário cada tipo de marco (inicial / conferido / ajuste)", async () => {
    listMarcos.mockResolvedValue([
      marco(18, { temAjuste: true, diferenca: 10, saldoDeclarado: 510 }),
      marco(DIA_MARCO),
      marco(5, { tipo: 1, saldoDeclarado: 300 }),
    ])
    await renderPage()
    await waitFor(() => expect(botaoDia(5)).toHaveAttribute("data-marco", "inicial"))
    expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu")
    expect(botaoDia(18)).toHaveAttribute("data-marco", "ajuste")
    expect(botaoDia(DIA_LIVRE)).not.toHaveAttribute("data-marco")
  })

  it("destaca hoje e o dia selecionado no calendário (a tela abre selecionando hoje)", async () => {
    await renderPage()
    expect(botaoDia(HOJE)).toHaveAttribute("data-hoje", "true")
    expect(botaoDia(HOJE)).toHaveAttribute("data-sel", "true")
    expect(botaoDia(DIA_LIVRE)).not.toHaveAttribute("data-hoje")
    expect(botaoDia(DIA_LIVRE)).not.toHaveAttribute("data-sel")
  })

  it("'a conferir' (tracejado): só dias DEPOIS do último marco e ATÉ hoje — nem antes do marco, nem no futuro", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu"))
    expect(botaoDia(DIA_LIVRE)).not.toHaveAttribute("data-pendente") // antes do marco
    expect(botaoDia(DIA_MARCO)).not.toHaveAttribute("data-pendente") // o próprio marco
    expect(botaoDia(DIA_MARCO + 1)).toHaveAttribute("data-pendente", "true") // logo depois
    expect(botaoDia(HOJE)).toHaveAttribute("data-pendente", "true") // hoje também falta conferir
    expect(botaoDia(HOJE + 1)).not.toHaveAttribute("data-pendente") // futuro não é pendência
  })

  it("marco do mês passado: o dia 1 deste mês já fica 'a conferir'", async () => {
    listMarcos.mockResolvedValue([marco(15, {}, -1)])
    await renderPage()
    await waitFor(() => expect(botaoDia(1)).toHaveAttribute("data-pendente", "true"))
  })

  it("sem nenhum marco nenhum dia fica 'a conferir' (não há de onde contar)", async () => {
    await renderPage()
    expect(botaoDia(DIA_MARCO)).not.toHaveAttribute("data-pendente")
    expect(botaoDia(HOJE)).not.toHaveAttribute("data-pendente")
  })

  it("navegar de mês esconde os marcos do mês corrente e volta a mostrá-los", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu"))
    expect(screen.getByText(`Junho ${ANO}`)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }))
    expect(screen.getByText(`Maio ${ANO}`)).toBeInTheDocument()
    expect(botaoDia(DIA_MARCO)).not.toHaveAttribute("data-marco")

    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }))
    expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu")
  })

  // ---------------------------------------------------------------- abrir já conferindo hoje

  it("ao abrir, a tela já seleciona HOJE: painel 'Conferir hoje, dd/mm' com o saldo real e o cálculo até agora", async () => {
    await renderPage({ manterMount: true })
    // não nasce vazio
    expect(screen.queryByText(/Escolha um dia no calendário/)).not.toBeInTheDocument()
    expect(screen.getByText(`hoje, ${diaMes(HOJE)}`, { selector: "strong" })).toBeInTheDocument()
    expect(screen.getByText("Saldo real da conta")).toBeInTheDocument()
    // calcula o saldo de hoje com a hora atual (não o "23:59" dos outros dias), 1x, da conta selecionada
    expect(getSaldoCalculado).toHaveBeenCalledTimes(1)
    expect(getSaldoCalculado).toHaveBeenCalledWith("c1", HOJE_CALCULO)
  })

  it("hoje já tem marco: ao abrir, o painel mostra o marco de hoje (e não o campo de conferir)", async () => {
    listMarcos.mockResolvedValue([marco(HOJE)])
    await renderPage({ manterMount: true })
    expect(await screen.findByRole("button", { name: "Remover" })).toBeInTheDocument()
    expect(screen.getByText(dataLabel(HOJE), { selector: "strong" })).toBeInTheDocument() // "Marco de DD/MM/YYYY"
    expect(screen.queryByText("Saldo real da conta")).not.toBeInTheDocument()
  })

  it("botão 'Conferir hoje' do hero volta pro mês e pro dia de hoje (depois de navegar de mês)", async () => {
    await renderPage()
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }))
    expect(screen.getByText(`Maio ${ANO}`)).toBeInTheDocument()
    expect(screen.getByText(/Escolha um dia no calendário/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Conferir hoje" }))
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalledWith("c1", HOJE_CALCULO))
    expect(await screen.findByText(`hoje, ${diaMes(HOJE)}`)).toBeInTheDocument()
    expect(screen.getByText(`Junho ${ANO}`)).toBeInTheDocument()
    expect(botaoDia(HOJE)).toHaveAttribute("data-sel", "true")
  })

  it("'Conferir hoje' troca de um dia qualquer pra hoje, descartando o saldo digitado", async () => {
    await renderPage()
    await abrirDiaLivre()
    digitarSaldoReal("10000")
    await screen.findByText("Calculado (app)")

    fireEvent.click(screen.getByRole("button", { name: "Conferir hoje" }))
    expect(await screen.findByText(`hoje, ${diaMes(HOJE)}`)).toBeInTheDocument()
    expect(screen.getByPlaceholderText("0,00")).toHaveValue("")
    expect(screen.queryByText("Calculado (app)")).not.toBeInTheDocument()
  })

  it("trocar de mês limpa o dia selecionado: painel volta a pedir um dia e o campo de saldo some", async () => {
    await renderPage()
    expect(screen.getByText("Saldo real da conta")).toBeInTheDocument() // hoje aberto
    digitarSaldoReal("10000")
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }))
    expect(screen.getByText(/Escolha um dia no calendário/)).toBeInTheDocument()
    expect(screen.queryByText("Saldo real da conta")).not.toBeInTheDocument()
    expect(screen.queryByText("Calculado (app)")).not.toBeInTheDocument()
    // e voltar pro mês de hoje não traz a seleção (nem o valor digitado) de volta
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }))
    expect(screen.getByText(/Escolha um dia no calendário/)).toBeInTheDocument()
    expect(botaoDia(HOJE)).not.toHaveAttribute("data-sel")
  })

  it("regressão: dia selecionado + navegar pra mês com marco no MESMO número de dia não mostra o marco do outro mês", async () => {
    // marco só no mês SEGUINTE, no mesmo nº de dia que vamos selecionar
    listMarcos.mockResolvedValue([marco(DIA_LIVRE, { id: "m-next", saldoDeclarado: 777, saldoCalculado: 777 }, 1)])
    await renderPage()
    await abrirDiaLivre()
    digitarSaldoReal("10000")
    await screen.findByText("Calculado (app)")

    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }))
    // antes do fix o painel virava "Marco de <mês atual>" exibindo o marco do mês seguinte
    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument()
    expect(screen.getByText(/Escolha um dia no calendário/)).toBeInTheDocument()

    // clicando no dia do mês seguinte aí sim aparece o marco dele, com a data certa
    fireEvent.click(botaoDia(DIA_LIVRE))
    const rotulo = `${pad2(DIA_LIVRE)}/${pad2(MES + 2)}/${ANO}`
    expect(await screen.findByText(rotulo, { selector: "strong" })).toBeInTheDocument()
    expect(within(linha("Declarado (você)")).getByText(/R\$\s?777,00/)).toBeInTheDocument()
  })

  // ---------------------------------------------------------------- erros de carga

  it("erro ao carregar as contas avisa por toast e não consulta marcos", async () => {
    getContas.mockRejectedValue(new Error("boom"))
    render(<PontesThemeProvider><ReconciliacaoPage /></PontesThemeProvider>)
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error", message: "Erro ao carregar contas" })))
    expect(listMarcos).not.toHaveBeenCalled()
  })

  it("erro ao carregar os marcos avisa por toast (e o hero segue com o saldo da conta, 'A conferir')", async () => {
    listMarcos.mockRejectedValue(new Error("boom"))
    await renderPage({ manterMount: true })
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error", message: "Erro ao carregar marcos" })))
    expect(screen.getByText(SALDO_A)).toBeInTheDocument()
    expect(screen.getByText("A conferir")).toBeInTheDocument()
    expect(screen.getByText(/Nenhuma conferência ainda/)).toBeInTheDocument()
  })

  it("erro ao calcular o saldo de hoje (ao abrir) avisa por toast e não libera a gravação", async () => {
    getSaldoCalculado.mockRejectedValue(new Error("boom"))
    await renderPage({ manterMount: true })
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error", message: "Erro ao calcular o saldo de hoje" })))
    digitarSaldoReal("10000")
    expect(screen.queryByText("Diferença")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: GRAVAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Definir saldo inicial" })).not.toBeInTheDocument()
    expect(criarMarco).not.toHaveBeenCalled()
  })

  it("erro ao calcular o saldo de OUTRO dia avisa por toast e não libera a gravação", async () => {
    await renderPage()
    getSaldoCalculado.mockRejectedValue(new Error("boom"))
    clicarDia(DIA_LIVRE)
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error", message: "Erro ao calcular o saldo até esse dia" })))
    digitarSaldoReal("10000")
    expect(screen.queryByText("Diferença")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: GRAVAR })).not.toBeInTheDocument()
    expect(criarMarco).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------- conferir um dia (sem marco)

  it("clicar num dia sem marco busca o saldo calculado até o fim do dia e abre o painel de conferir", async () => {
    await renderPage()
    clicarDia(DIA_LIVRE)
    expect(await screen.findByText("Saldo real da conta")).toBeInTheDocument()
    expect(screen.getByText(dataLabel(DIA_LIVRE), { selector: "strong" })).toBeInTheDocument() // "Conferir DD/MM/YYYY"
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalledWith("c1", fimDoDia(DIA_LIVRE)))
    // ainda não digitou nada: não há comparação nem botão de gravar
    expect(screen.queryByText("Diferença")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: GRAVAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Definir saldo inicial" })).not.toBeInTheDocument()
  })

  // --- bate

  it("conferir hoje: saldo real = calculado mostra 'Confere — gravar marco' e grava via criarMarco (1º marco = baseline)", async () => {
    // depois de gravar a tela recarrega: o 2º listMarcos já traz o marco de hoje
    const gravado = marco(HOJE, { id: "m-novo", tipo: 1, saldoDeclarado: 100, saldoCalculado: 100 })
    listMarcos.mockReset().mockResolvedValueOnce([]).mockResolvedValue([gravado])
    getSaldoCalculado.mockResolvedValue(100)
    await renderPage({ manterMount: true })
    await screen.findByText("Saldo real da conta")
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalled())

    digitarSaldoReal("10000") // 100,00
    expect(await screen.findByText("Calculado (app)")).toBeInTheDocument()
    expect(screen.getByText("Declarado (você)")).toBeInTheDocument()
    expect(screen.getByText("Diferença")).toBeInTheDocument()
    expect(linha("Calculado (app)")).toHaveTextContent(/R\$\s?100,00/)
    expect(linha("Declarado (você)")).toHaveTextContent(/R\$\s?100,00/)
    expect(linha("Diferença")).toHaveTextContent(/R\$\s?0,00/)
    expect(linha("Diferença")).not.toHaveTextContent(/[+-]R\$/)
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "true")
    // bateu: só o botão de gravar; nada de aviso de divergência nem das ações de divergência
    expect(screen.queryByText(/Faltou \(ou sobrou\) lançamento/)).not.toBeInTheDocument()
    expect(screen.queryByText(/1ª conferência da conta/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Ajustar (cria lançamento)" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Lançar o que falta" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Definir saldo inicial" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: GRAVAR }))
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))
    const [dto, idemKey] = criarMarco.mock.calls[0]
    expect(dto).toMatchObject({ contaId: "c1", dataHora: HOJE_CALCULO, tipo: 1 }) // hoje grava com a hora atual; conta sem marco = baseline
    expect(dto.saldoDeclarado).toBeCloseTo(100, 2)
    expect(dto.resolucao).toBeUndefined() // bateu → não cria lançamento de ajuste
    expect(idemKey).toEqual(expect.any(String))
    expect(idemKey).not.toBe("")

    // sucesso: toast, recarrega os marcos e o painel passa a mostrar o marco gravado (hoje)
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: "Conferido — saldo bate ✓" })))
    await waitFor(() => expect(listMarcos).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole("button", { name: "Remover" })).toBeInTheDocument()
    expect(screen.getByText(dataLabel(HOJE), { selector: "strong" })).toBeInTheDocument()
  })

  it("bate numa conta COM marcos: 'Confere — gravar marco' grava como verificação (tipo 2) no fim do dia escolhido", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await abrirDiaLivre()

    digitarSaldoReal("10000") // 100,00 = calculado
    fireEvent.click(await screen.findByRole("button", { name: GRAVAR }))
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))
    const [dto] = criarMarco.mock.calls[0]
    expect(dto).toMatchObject({ contaId: "c1", dataHora: fimDoDia(DIA_LIVRE), tipo: 2 })
    expect(dto.resolucao).toBeUndefined()
  })

  it("diferença abaixo de meio centavo ainda 'bate' (arredondamento não bloqueia o marco)", async () => {
    getSaldoCalculado.mockResolvedValue(100.004)
    await renderPage({ manterMount: true })
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalled())
    digitarSaldoReal("10000")
    expect(await screen.findByRole("button", { name: GRAVAR })).toBeInTheDocument()
  })

  // --- não bate, 1ª conferência (baseline)

  it("não bate em conta SEM marcos: oferece 'Definir saldo inicial' (baseline, tipo 1) e grava o declarado", async () => {
    await renderPage()
    await abrirDiaLivre()

    digitarSaldoReal("15000") // declara 150,00 x calculado 100,00
    const definir = await screen.findByRole("button", { name: "Definir saldo inicial" })
    expect(screen.getByText(/1ª conferência da conta/)).toBeInTheDocument()
    expect(linha("Diferença")).toHaveTextContent(/\+R\$\s?50,00/) // diferença positiva com sinal
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "false")
    // baseline não oferece as ações de verificação
    expect(screen.queryByRole("button", { name: "Ajustar (cria lançamento)" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Lançar o que falta" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: GRAVAR })).not.toBeInTheDocument()

    fireEvent.click(definir)
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))
    const [dto] = criarMarco.mock.calls[0]
    expect(dto).toMatchObject({ contaId: "c1", tipo: 1 })
    expect(dto.saldoDeclarado).toBeCloseTo(150, 2)
    expect(dto.resolucao).toBeUndefined() // baseline assume o declarado, não cria lançamento
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" })))
  })

  // --- não bate, verificação

  it("não bate em conta COM marco: oferece 'Ajustar (cria lançamento)' e grava com resolucao 'ajustar'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await abrirDiaLivre()

    digitarSaldoReal("15000") // 150,00 x 100,00
    const ajustar = await screen.findByRole("button", { name: "Ajustar (cria lançamento)" })
    expect(screen.getByRole("button", { name: "Lançar o que falta" })).toBeInTheDocument()
    // aviso aponta desde quando conferiu pela última vez (dd/mm do último marco)
    expect(screen.getByText(new RegExp(`Faltou \\(ou sobrou\\) lançamento — desde ${diaMes(DIA_MARCO)}`))).toBeInTheDocument()
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "false")
    // verificação não oferece baseline nem "gravar marco" simples
    expect(screen.queryByRole("button", { name: "Definir saldo inicial" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: GRAVAR })).not.toBeInTheDocument()

    fireEvent.click(ajustar)
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))
    const [dto] = criarMarco.mock.calls[0]
    expect(dto).toMatchObject({ contaId: "c1", tipo: 2, resolucao: "ajustar" })
    expect(dto.saldoDeclarado).toBeCloseTo(150, 2)
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: expect.stringContaining("ajuste") })))
  })

  it("diferença negativa (declarou menos que o calculado) também cai em 'Ajustar', com sinal de menos", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await abrirDiaLivre()
    digitarSaldoReal("4000") // 40,00 x 100,00 → -60,00
    expect(await screen.findByRole("button", { name: "Ajustar (cria lançamento)" })).toBeInTheDocument()
    expect(linha("Diferença")).toHaveTextContent(/-R\$\s?60,00/)
    expect(linha("Diferença")).not.toHaveTextContent(/\+R\$/)
  })

  it("'Lançar o que falta' navega pra /transactions sem gravar nada", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await abrirDiaLivre()
    digitarSaldoReal("15000")
    fireEvent.click(await screen.findByRole("button", { name: "Lançar o que falta" }))
    expect(navigateSpy).toHaveBeenCalledWith("/transactions")
    expect(criarMarco).not.toHaveBeenCalled()
  })

  // --- erro ao gravar

  it("erro ao gravar: toast de erro, painel segue aberto e o retry reusa a MESMA Idempotency-Key", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    criarMarco.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(marco(DIA_LIVRE))
    await renderPage()
    await abrirDiaLivre()
    digitarSaldoReal("10000")

    fireEvent.click(await screen.findByRole("button", { name: GRAVAR }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error", message: "Erro ao gravar o marco" })))
    // painel continua aberto pra tentar de novo (nada foi perdido)
    expect(screen.getByText("Saldo real da conta")).toBeInTheDocument()
    expect(screen.getByDisplayValue("100,00")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: GRAVAR }))
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(2))
    expect(criarMarco.mock.calls[1][1]).toBe(criarMarco.mock.calls[0][1]) // mesma operação → mesma chave
    await waitFor(() => expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({ severity: "success" })))
  })

  it("cada abertura de dia gera uma Idempotency-Key nova (dia A e dia B gravam com chaves diferentes)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()

    // dia A
    await abrirDiaLivre()
    digitarSaldoReal("10000")
    fireEvent.click(await screen.findByRole("button", { name: GRAVAR }))
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))

    // dia B (outro dia sem marco): abrir gera chave nova, mesmo sem reabrir "hoje" depois de gravar
    const DIA_B = DIA_LIVRE + 1
    clicarDia(DIA_B)
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenLastCalledWith("c1", fimDoDia(DIA_B)))
    digitarSaldoReal("10000")
    fireEvent.click(await screen.findByRole("button", { name: GRAVAR }))
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(2))

    expect(criarMarco.mock.calls[0][0].dataHora).toBe(fimDoDia(DIA_LIVRE))
    expect(criarMarco.mock.calls[1][0].dataHora).toBe(fimDoDia(DIA_B))
    expect(criarMarco.mock.calls[0][1]).toEqual(expect.any(String))
    expect(criarMarco.mock.calls[1][1]).toEqual(expect.any(String))
    expect(criarMarco.mock.calls[1][1]).not.toBe(criarMarco.mock.calls[0][1])
  })

  // ---------------------------------------------------------------- movimentos desde o marco ANTERIOR ao dia

  it("lista 'Movimentos desde dd/mm' a partir do listTransactionsPage (despesa com − , receita com +)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    listTransactionsPage.mockResolvedValue({
      items: [tx("t1", "Mercado", 50, 1, 16), tx("t2", "Salário", 1000, 2, 18)],
      total: 2,
    })
    await renderPage()
    expect(await screen.findByText(`Movimentos desde ${diaMes(DIA_MARCO)}`)).toBeInTheDocument()
    const mercado = screen.getByText("Mercado")
    expect(mercado).toBeInTheDocument()
    expect(within(mercado).getByText(diaMes(16))).toBeInTheDocument() // data dd/mm do lançamento
    expect(mercado.nextElementSibling).toHaveTextContent(/^−\sR\$\s?50,00$/)
    const salario = screen.getByText("Salário")
    expect(within(salario).getByText(diaMes(18))).toBeInTheDocument()
    expect(salario.nextElementSibling).toHaveTextContent(/^\+\sR\$\s?1\.000,00$/)
    // total == itens mostrados: sem "+N outros lançamentos"
    expect(screen.queryByText(/outros lançamentos/)).not.toBeInTheDocument()
  })

  it("busca os movimentos da conta, do marco anterior ao dia até o dia seguinte ao selecionado, só caixa (6 por vez)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 6, {
      contaId: "c1", from: isoDia(DIA_MARCO), to: isoDia(HOJE + 1), apenasCaixa: true,
    }))
  })

  it("selecionar outro dia refaz a busca até o dia seguinte a ele (e vira o mês: 30/06 → 01/07)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    clicarDia(17)
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 6, expect.objectContaining({ from: isoDia(DIA_MARCO), to: isoDia(18) })))
    clicarDia(30)
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 6, expect.objectContaining({ from: isoDia(DIA_MARCO), to: `${ANO}-07-01` })))
  })

  it("o 'desde' é o marco ANTERIOR ao dia selecionado, não o último marco global (marcos nos dias 5 e 15)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO), marco(5, { tipo: 1 })])
    listTransactionsPage.mockResolvedValue({ items: [tx("t1", "Mercado", 50, 1, 8)], total: 1 })
    await renderPage()
    // dia 10: o marco anterior é o do dia 5 (o do dia 15 ainda não existia)
    clicarDia(DIA_LIVRE)
    expect(await screen.findByText(`Movimentos desde ${diaMes(5)}`)).toBeInTheDocument()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 6, expect.objectContaining({ from: isoDia(5), to: isoDia(DIA_LIVRE + 1) })))
    // dia 20 (hoje): o anterior é o do dia 15
    clicarDia(HOJE)
    expect(await screen.findByText(`Movimentos desde ${diaMes(DIA_MARCO)}`)).toBeInTheDocument()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 6, expect.objectContaining({ from: isoDia(DIA_MARCO), to: isoDia(HOJE + 1) })))
  })

  it("dia ANTERIOR a todos os marcos: busca sem limite inferior e o título é só 'Movimentos'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    listTransactionsPage.mockResolvedValue({ items: [tx("t1", "Mercado", 50, 1, 3)], total: 1 })
    await renderPage()
    expect(await screen.findByText(`Movimentos desde ${diaMes(DIA_MARCO)}`)).toBeInTheDocument() // hoje

    clicarDia(DIA_LIVRE) // 10 < marco do dia 15: não há marco anterior
    await screen.findByText("Saldo real da conta")
    expect(await screen.findByText("Movimentos")).toBeInTheDocument()
    expect(screen.queryByText(/Movimentos desde/)).not.toBeInTheDocument()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 6, expect.objectContaining({ from: undefined, to: isoDia(DIA_LIVRE + 1) })))
    expect(screen.getByText("Mercado")).toBeInTheDocument()
  })

  it("sem nenhum marco: título é só 'Movimentos' (sem 'desde') e a busca não tem limite inferior", async () => {
    listTransactionsPage.mockResolvedValue({ items: [tx("t1", "Compra", 20, 1, 3)], total: 1 })
    await renderPage()
    expect(await screen.findByText("Movimentos")).toBeInTheDocument()
    expect(screen.queryByText(/Movimentos desde/)).not.toBeInTheDocument()
    expect(screen.getByText("Compra")).toBeInTheDocument()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 6, expect.objectContaining({ from: undefined, to: isoDia(HOJE + 1) })))
  })

  it("mais lançamentos que o limite da lista: mostra '+N outros lançamentos'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    listTransactionsPage.mockResolvedValue({
      items: [tx("t1", "Mercado", 50, 1, 16), tx("t2", "Padaria", 12, 1, 17)],
      total: 9,
    })
    await renderPage()
    expect(await screen.findByText("+7 outros lançamentos")).toBeInTheDocument()
  })

  it("sem lançamentos no período: o bloco de movimentos não aparece", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    expect(screen.queryByText(/^Movimentos/)).not.toBeInTheDocument()
    expect(screen.getByText("Saldo real da conta")).toBeInTheDocument() // o painel de conferir segue normal
  })

  it("erro ao buscar os movimentos é silencioso: sem bloco, sem toast, e o painel segue conferível", async () => {
    listTransactionsPage.mockRejectedValue(new Error("boom"))
    await renderPage({ manterMount: true })
    expect(screen.queryByText(/^Movimentos/)).not.toBeInTheDocument()
    expect(notify).not.toHaveBeenCalled()
    expect(screen.getByText("Saldo real da conta")).toBeInTheDocument()
  })

  it("dia COM marco: os movimentos aparecem TAMBÉM junto do marco gravado (desde o marco anterior a ele)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO), marco(5, { tipo: 1 })])
    listTransactionsPage.mockResolvedValue({ items: [tx("t1", "Mercado", 50, 1, 8)], total: 1 })
    await renderPage()

    clicarDia(DIA_MARCO)
    expect(await screen.findByRole("button", { name: "Remover" })).toBeInTheDocument() // painel do marco
    expect(screen.queryByText("Saldo real da conta")).not.toBeInTheDocument()
    // o marco do dia 15 é o dia selecionado; o ANTERIOR a ele é o do dia 5
    expect(await screen.findByText(`Movimentos desde ${diaMes(5)}`)).toBeInTheDocument()
    expect(screen.getByText("Mercado")).toBeInTheDocument()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 6, expect.objectContaining({ from: isoDia(5), to: isoDia(DIA_MARCO + 1) })))
  })

  it("marco DERIVADO também mostra os movimentos do dia (só as ações de alterar/remover somem)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { tipo: 1, derivado: true, saldoDeclarado: 300, saldoCalculado: 300 })])
    listTransactionsPage.mockResolvedValue({ items: [tx("t1", "Mercado", 50, 1, 14)], total: 1 })
    await renderPage()
    clicarDia(DIA_MARCO)
    expect(await screen.findByText("Saldo inicial da conta — pra mudar, edite a conta.")).toBeInTheDocument()
    expect(await screen.findByText("Mercado")).toBeInTheDocument()
    // primeiro marco da conta: não há marco anterior → título sem "desde"
    expect(screen.getByText("Movimentos")).toBeInTheDocument()
  })

  // ---------------------------------------------------------------- histórico de marcos

  it("histórico lista os marcos em ordem (dd/mm + saldo declarado), com a tag 'partida' só no baseline/derivado", async () => {
    listMarcos.mockResolvedValue([
      marco(18, { temAjuste: true, diferenca: 10, saldoDeclarado: 510 }),
      marco(DIA_MARCO, { saldoDeclarado: 500 }),
      marco(5, { tipo: 1, derivado: true, saldoDeclarado: 300, saldoCalculado: 300 }),
    ])
    await renderPage()
    await waitFor(() => expect(within(historico()).getAllByRole("button")).toHaveLength(3))
    const [ajuste, conferido, partida] = within(historico()).getAllByRole("button")
    expect(ajuste).toHaveTextContent(diaMes(18))
    expect(ajuste).toHaveTextContent(/R\$\s?510,00/)
    expect(conferido).toHaveTextContent(diaMes(DIA_MARCO))
    expect(conferido).toHaveTextContent(/R\$\s?500,00/)
    expect(partida).toHaveTextContent(diaMes(5))
    expect(partida).toHaveTextContent(/R\$\s?300,00/)
    expect(partida).toHaveTextContent("partida")
    // só uma linha é "partida"
    expect(within(historico()).getAllByText("partida")).toHaveLength(1)
    expect(ajuste).not.toHaveTextContent("partida")
    expect(conferido).not.toHaveTextContent("partida")
    expect(screen.queryByText(/Nenhuma conferência ainda/)).not.toBeInTheDocument()
  })

  it("sem marcos o histórico mostra o convite pra conferir hoje", async () => {
    await renderPage()
    expect(screen.getByText("Nenhuma conferência ainda. Confira o saldo de hoje pra começar.")).toBeInTheDocument()
  })

  it("clicar numa linha do histórico abre o marco daquele dia (e destaca a linha)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { saldoCalculado: 480, saldoDeclarado: 500, diferenca: 20, temAjuste: true }), marco(5, { tipo: 1, saldoDeclarado: 300 })])
    await renderPage()
    await waitFor(() => expect(within(historico()).getAllByRole("button")).toHaveLength(2))
    const [linhaDoMarco] = within(historico()).getAllByRole("button")
    expect(linhaDoMarco).not.toHaveAttribute("data-sel")

    fireEvent.click(linhaDoMarco)
    expect(await screen.findByText(dataLabel(DIA_MARCO), { selector: "strong" })).toBeInTheDocument() // "Marco de DD/MM/YYYY"
    expect(screen.getByRole("button", { name: "Remover" })).toBeInTheDocument()
    expect(within(historico()).getAllByRole("button")[0]).toHaveAttribute("data-sel", "true")
    expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-sel", "true")
  })

  // ---------------------------------------------------------------- dia com marco

  it("clicar num dia COM marco mostra o marco (calculado/declarado/diferença) no lugar do campo de conferir, com 'Alterar valor' e 'Remover'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { saldoCalculado: 480, saldoDeclarado: 500, diferenca: 20, temAjuste: true })])
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "ajuste"))
    clicarDia(DIA_MARCO)

    expect(await screen.findByText(dataLabel(DIA_MARCO), { selector: "strong" })).toBeInTheDocument() // "Marco de DD/MM/YYYY"
    expect(linha("Calculado (app)")).toHaveTextContent(/R\$\s?480,00/)
    expect(linha("Declarado (você)")).toHaveTextContent(/R\$\s?500,00/)
    expect(linha("Diferença")).toHaveTextContent(/\+R\$\s?20,00/)
    expect(screen.getByText("lançamento de ajuste criado")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remover" })).toBeInTheDocument()
    // o marco gravado é mostrado como foi gravado: sem campo pra conferir de novo
    expect(screen.queryByText("Saldo real da conta")).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText("0,00")).not.toBeInTheDocument()
  })

  it("marco sem ajuste não mostra a tag de 'lançamento de ajuste criado' (e marco comum não é 'saldo inicial derivado')", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu"))
    clicarDia(DIA_MARCO)
    await screen.findByRole("button", { name: "Remover" })
    expect(screen.queryByText("lançamento de ajuste criado")).not.toBeInTheDocument()
    expect(screen.queryByText(/edite a conta/)).not.toBeInTheDocument()
  })

  it("marco DERIVADO (saldo inicial da conta): mostra a nota 'edite a conta' e NÃO oferece 'Alterar valor' nem 'Remover'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { tipo: 1, derivado: true, saldoDeclarado: 300, saldoCalculado: 300 })])
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "inicial"))
    clicarDia(DIA_MARCO)

    expect(await screen.findByText("Saldo inicial da conta — pra mudar, edite a conta.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Alterar valor" })).not.toBeInTheDocument()
    // o resto do marco continua visível (só as ações de alterar/remover somem)
    expect(screen.getByText("Calculado (app)")).toBeInTheDocument()
    expect(screen.getByText("Declarado (você)")).toBeInTheDocument()
    expect(screen.getByText(dataLabel(DIA_MARCO), { selector: "strong" })).toBeInTheDocument()
    // e sem botão não há como abrir o dialog de remoção
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(removerMarco).not.toHaveBeenCalled()
  })

  it("remover marco: confirma no dialog, chama removerMarco(id), avisa e recarrega", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu"))
    clicarDia(DIA_MARCO)
    fireEvent.click(await screen.findByRole("button", { name: "Remover" }))

    const dialog = await screen.findByRole("alertdialog", { name: "Remover marco?" })
    expect(within(dialog).getByText(/sem ajuste vinculado/)).toBeInTheDocument()
    expect(removerMarco).not.toHaveBeenCalled() // só abrir o dialog não remove
    fireEvent.click(within(dialog).getByRole("button", { name: "Remover" }))

    await waitFor(() => expect(removerMarco).toHaveBeenCalledWith(`m-${DIA_MARCO}`))
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: "Marco removido" })))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    await waitFor(() => expect(listMarcos).toHaveBeenCalledTimes(2))
  })

  it("remover marco COM ajuste avisa no dialog que o lançamento de ajuste também será cancelado", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { temAjuste: true, diferenca: 20 })])
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "ajuste"))
    clicarDia(DIA_MARCO)
    fireEvent.click(await screen.findByRole("button", { name: "Remover" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Remover marco?" })
    expect(within(dialog).getByText(/o lançamento de ajuste também será cancelado/)).toBeInTheDocument()
  })

  it("cancelar o dialog de remoção não chama removerMarco e fecha o dialog", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu"))
    clicarDia(DIA_MARCO)
    fireEvent.click(await screen.findByRole("button", { name: "Remover" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Remover marco?" })
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    expect(removerMarco).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Remover" })).toBeInTheDocument() // marco segue selecionado
  })

  it("erro ao remover: toast de erro e o dialog fecha sem recarregar", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    removerMarco.mockRejectedValue(new Error("boom"))
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu"))
    clicarDia(DIA_MARCO)
    fireEvent.click(await screen.findByRole("button", { name: "Remover" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Remover marco?" })
    fireEvent.click(within(dialog).getByRole("button", { name: "Remover" }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error", message: "Erro ao remover o marco" })))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    expect(listMarcos).toHaveBeenCalledTimes(1)
  })

  // ---------------------------------------------------------------- alterar valor de um marco gravado

  it("marco gravado (não derivado) oferece DOIS botões lado a lado: 'Alterar valor' e 'Remover'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu"))
    clicarDia(DIA_MARCO)
    expect(await screen.findByRole("button", { name: "Alterar valor" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remover" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remover marco" })).not.toBeInTheDocument() // rótulo antigo
  })

  it("'Alterar valor': remove o marco (sem confirmação) e reabre o conferir do MESMO dia com o campo de saldo", async () => {
    // 1ª leitura traz o marco; depois de removido, a releitura vem sem ele
    listMarcos.mockReset().mockResolvedValueOnce([marco(DIA_MARCO)]).mockResolvedValue([])
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu"))
    clicarDia(DIA_MARCO)
    fireEvent.click(await screen.findByRole("button", { name: "Alterar valor" }))

    await waitFor(() => expect(removerMarco).toHaveBeenCalledWith(`m-${DIA_MARCO}`))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument() // alterar não pede confirmação
    // painel volta ao modo conferir NAQUELE dia (não em hoje), com o campo de saldo real
    expect(await screen.findByText("Saldo real da conta")).toBeInTheDocument()
    expect(screen.getByText("Conferir")).toBeInTheDocument()
    expect(screen.getByText(dataLabel(DIA_MARCO), { selector: "strong" })).toBeInTheDocument()
    expect(screen.queryByText(`hoje, ${diaMes(HOJE)}`)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Alterar valor" })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText("0,00")).toHaveValue("")
    await waitFor(() => expect(listMarcos).toHaveBeenCalledTimes(2)) // recarregou
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenLastCalledWith("c1", fimDoDia(DIA_MARCO)))
    expect(notify).not.toHaveBeenCalledWith(expect.objectContaining({ severity: "error" }))
  })

  it("erro ao alterar: toast de erro, o marco segue na tela e nada é recarregado", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    removerMarco.mockRejectedValue(new Error("boom"))
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu"))
    clicarDia(DIA_MARCO)
    fireEvent.click(await screen.findByRole("button", { name: "Alterar valor" }))

    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error", message: "Erro ao alterar o marco" })))
    expect(screen.getByRole("button", { name: "Alterar valor" })).toBeInTheDocument() // continua no marco
    expect(screen.queryByText("Saldo real da conta")).not.toBeInTheDocument()
    expect(listMarcos).toHaveBeenCalledTimes(1)
  })
})
