import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import ReconciliacaoPage from "../../pages/Reconciliacao/ReconciliacaoPage"
import type { Conta } from "../../types/Conta"
import type { Transaction } from "../../types/Transaction"
import type { ReconciliacaoMarco } from "../../types/Reconciliacao"

// Tela /reconciliacao (painel redesenhado). Estrutura:
//  - HERO: "Saldo em conta" + chip de confiança HONESTO ("Conferido dd/mm" verde quando o saldo de hoje ainda
//    bate com o último marco, senão "A conferir") + delta desde a última conferência + botão "Conferir hoje".
//  - Coluna esquerda = painel UNIFORME de conferir: seletor "Conta a conferir" (mora DENTRO do painel, não numa
//    topbar) → título → input "Saldo que aparece no seu banco" → 3 linhas (Calculado / Declarado / Diferença) →
//    slot de status (aviso "Sobrou"/"Faltou", nota de partida, tag de ajuste) → ações no rodapé.
//  - Coluna direita = calendário de marcos + "Última conferência".
//  - Embaixo: PontesTabela full-width SEMPRE visível com os movimentos (do marco ANTERIOR ao dia até o dia).
// Baseline REMOVIDO da tela: o saldo inicial vem só do cadastro da conta (marco derivado); a tela só confere e
// ajusta — e o marco de partida tem "Alterar valor" (edita valor + data do saldo inicial aqui mesmo).
//
// "Agora" é FIXO (só o Date é falsificado; timers seguem reais pro waitFor): a tela decide pendente/futuro/
// movimentos comparando dia × hoje, então o teste não pode depender do dia em que roda.
const {
  notify, navigateSpy, getContas, atualizarSaldoInicial,
  listMarcos, getSaldoCalculado, criarMarco, removerMarco, listTransactionsPage,
} = vi.hoisted(() => ({
  notify: vi.fn(),
  navigateSpy: vi.fn(),
  getContas: vi.fn(),
  atualizarSaldoInicial: vi.fn(),
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
vi.mock("../../services/contaService", () => ({
  getContas: (...a: unknown[]) => getContas(...a),
  atualizarSaldoInicial: (...a: unknown[]) => atualizarSaldoInicial(...a),
}))
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
const AJUSTAR = "Ajustar (cria lançamento)"
const LANCAR = "Lançar o que falta"
const ROTULO_SALDO_BANCO = "Saldo que aparece no seu banco"
const MSG_ESCOLHA_DIA = "Escolha um dia no calendário pra conferir o saldo daquele dia."
const MSG_ESCOLHA_DIA_TABELA = "Escolha um dia no calendário pra ver os movimentos até ele."
const MSG_SEM_MOVIMENTOS = "Nenhum movimento neste período"

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

// Transaction com data ("YYYY-MM-DD") e hora ("HH:MM:SS" | null) SEPARADAS — sem fuso, sem ISO combinado.
function tx(id: string, descricao: string, valor: number, tipo: number, dia: number, hora: string | null = "12:00:00"): Transaction {
  return { id, descricao, valor, tipo, categoriaId: null, data: isoDia(dia), hora } as Transaction
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
// pra não casar com a linha da última conferência ("15/06 ...") nem "1" com "15".
const botaoDia = (n: number) => screen.getByRole("button", { name: String(n) })
const clicarDia = (n: number) => fireEvent.click(botaoDia(n))
// Digita em dígitos crus no campo de saldo (PontesInput + máscara: "10000" -> "100,00").
const digitarSaldoReal = (centavos: string) =>
  fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: centavos } })
// Linha "rótulo + valor" do resultado (Calculado / Declarado / Diferença).
const linha = (rotulo: string) => screen.getByText(rotulo).parentElement as HTMLElement
// "Última conferência": título + 1 linha clicável logo depois (só a mais recente, não a lista toda).
const ultimaConferencia = () => screen.getByText("Última conferência").nextElementSibling as HTMLElement
// Painel de conferir (coluna esquerda) e hero — a identificação é pelo nome da classe do CSS Module.
const painelConferir = () => screen.getByText("Conta a conferir").closest('[class*="_painelConf_"]') as HTMLElement
const heroEl = () => screen.getByText("Saldo em conta").closest('[class*="_hero_"]') as HTMLElement
// Tabela de movimentos: linhas de dados (sem o cabeçalho).
const linhasMov = () => within(screen.getByRole("table")).getAllByRole("row").slice(1)
const celulas = (tr: HTMLElement) => within(tr).getAllByRole("cell")
const tituloMov = (txt: string) => screen.findByRole("heading", { name: txt })
// Cada elemento tem que vir DEPOIS do anterior no DOM (ordem do painel uniforme).
function expectOrdem(...els: HTMLElement[]) {
  for (let i = 1; i < els.length; i++) {
    expect(els[i - 1].compareDocumentPosition(els[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }
}
// Abre o painel de conferir no dia livre e espera o cálculo do app chegar.
async function abrirDiaLivre() {
  clicarDia(DIA_LIVRE)
  await screen.findByText(ROTULO_SALDO_BANCO)
  await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalledWith("c1", fimDoDia(DIA_LIVRE)))
  await screen.findByText("Calculado (app)")
}

describe("ReconciliacaoPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(AGORA)
    notify.mockReset()
    navigateSpy.mockReset()
    getContas.mockReset().mockResolvedValue([contaA, contaB])
    atualizarSaldoInicial.mockReset().mockResolvedValue(undefined)
    listMarcos.mockReset().mockResolvedValue([])
    getSaldoCalculado.mockReset().mockResolvedValue(100)
    criarMarco.mockReset().mockResolvedValue(marco(DIA_LIVRE))
    removerMarco.mockReset().mockResolvedValue(undefined)
    listTransactionsPage.mockReset().mockResolvedValue({ items: [], total: 0 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ---------------------------------------------------------------- seletor de conta (dentro do painel)

  it("o seletor 'Conta a conferir' mora DENTRO do painel de conferir (não no hero), já vem na 1ª conta e carrega os marcos dela", async () => {
    await renderPage()
    const painel = painelConferir()
    expect(within(painel).getByText("Conta a conferir")).toBeInTheDocument()
    expect(within(painel).getByText("Tudo nesta tela é desta conta.")).toBeInTheDocument()
    expect(within(painel).getByRole("button", { name: "Conta Corrente" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Poupança" })).not.toBeInTheDocument() // menu fechado
    // o campo de saldo é do MESMO painel que o seletor (painel único, seletor no topo dele)
    expect(within(painel).getByText(ROTULO_SALDO_BANCO)).toBeInTheDocument()
    // e o hero NÃO tem seletor
    const hero = heroEl()
    expect(within(hero).queryByText("Conta a conferir")).not.toBeInTheDocument()
    expect(within(hero).queryByRole("button", { name: "Conta Corrente" })).not.toBeInTheDocument()
    expect(listMarcos).toHaveBeenCalledWith("c1")
  })

  it("o seletor oferece todas as contas do usuário", async () => {
    await renderPage()
    fireEvent.click(screen.getByRole("button", { name: "Conta Corrente" }))
    expect(await screen.findByRole("button", { name: "Poupança" })).toBeInTheDocument()
  })

  it("sem nenhuma conta: não consulta marcos nem movimentos, não mostra a tabela e o saldo fica zerado", async () => {
    getContas.mockResolvedValue([])
    render(<PontesThemeProvider><ReconciliacaoPage /></PontesThemeProvider>)
    await waitFor(() => expect(getContas).toHaveBeenCalled())
    await act(async () => {})
    expect(screen.getByText(/R\$\s?0,00/)).toBeInTheDocument()
    expect(listMarcos).not.toHaveBeenCalled()
    expect(listTransactionsPage).not.toHaveBeenCalled()
    // sem conta não há o que conferir: nada de cálculo de hoje, painel pede pra escolher um dia
    expect(getSaldoCalculado).not.toHaveBeenCalled()
    expect(screen.getByText(MSG_ESCOLHA_DIA)).toBeInTheDocument()
    // e a tabela de movimentos só existe quando há conta
    expect(screen.queryByRole("heading", { name: /Movimentos/ })).not.toBeInTheDocument()
    expect(screen.queryByText(MSG_SEM_MOVIMENTOS)).not.toBeInTheDocument()
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
    // marcos da conta NOVA: última conferência vazia, calendário sem o marco da outra conta, chip "A conferir"
    expect(await screen.findByText(/Nenhuma conferência ainda/)).toBeInTheDocument()
    expect(botaoDia(DIA_MARCO)).not.toHaveAttribute("data-marco")
    expect(screen.getByText("A conferir")).toBeInTheDocument()
    expect(screen.queryByText(`Conferido ${diaMes(DIA_MARCO)}`)).not.toBeInTheDocument()
    // painel reabre em "Conferir hoje" já calculando o saldo da NOVA conta (e buscando os movimentos dela)
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenLastCalledWith("c2", HOJE_CALCULO))
    expect(await screen.findByText(`hoje, ${diaMes(HOJE)}`)).toBeInTheDocument()
    expect(screen.getByText(ROTULO_SALDO_BANCO)).toBeInTheDocument()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 100, expect.objectContaining({ contaId: "c2" })))
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

  it("ao abrir, a tela já seleciona HOJE: painel 'Conferir hoje, dd/mm' com o campo do banco e o cálculo até agora", async () => {
    await renderPage({ manterMount: true })
    // não nasce vazio
    expect(screen.queryByText(MSG_ESCOLHA_DIA)).not.toBeInTheDocument()
    expect(screen.getByText(`hoje, ${diaMes(HOJE)}`, { selector: "strong" })).toBeInTheDocument()
    expect(screen.getByText(ROTULO_SALDO_BANCO)).toBeInTheDocument()
    expect(screen.getByText("Abre o app do seu banco e põe o valor aqui.")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("0,00")).toHaveValue("")
    // o "Calculado (app)" já aparece, sem a pessoa digitar nada; "Declarado" ainda é zero
    expect(await screen.findByText("Calculado (app)")).toBeInTheDocument()
    expect(linha("Calculado (app)")).toHaveTextContent(/R\$\s?100,00/)
    expect(linha("Declarado (você)")).toHaveTextContent(/R\$\s?0,00/)
    // calcula o saldo de hoje com a hora atual (não o "23:59" dos outros dias), 1x, da conta selecionada
    expect(getSaldoCalculado).toHaveBeenCalledTimes(1)
    expect(getSaldoCalculado).toHaveBeenCalledWith("c1", HOJE_CALCULO)
  })

  it("enquanto o saldo do dia calcula: mostra 'Calculando…', sem resultado nem ações; quando chega, libera", async () => {
    let resolver!: (v: number) => void
    getSaldoCalculado.mockReset().mockReturnValue(new Promise<number>((r) => { resolver = r }))
    await renderPage({ manterMount: true })
    expect(screen.getByText("Calculando o saldo do dia…")).toBeInTheDocument()
    expect(screen.queryByText("Calculado (app)")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: GRAVAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: LANCAR })).not.toBeInTheDocument()

    await act(async () => { resolver(100) })
    expect(await screen.findByText("Calculado (app)")).toBeInTheDocument()
    expect(screen.queryByText("Calculando o saldo do dia…")).not.toBeInTheDocument()
  })

  it("hoje já tem marco: ao abrir, o painel mostra o marco de hoje ('Saldo conferido', desabilitado) e não o campo de conferir", async () => {
    listMarcos.mockResolvedValue([marco(HOJE)])
    await renderPage({ manterMount: true })
    expect(await screen.findByRole("button", { name: "Remover" })).toBeInTheDocument()
    expect(screen.getByText(dataLabel(HOJE), { selector: "strong" })).toBeInTheDocument() // "Marco de DD/MM/YYYY"
    expect(screen.queryByText(ROTULO_SALDO_BANCO)).not.toBeInTheDocument()
    expect(screen.getByText("Saldo conferido")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("0,00")).toBeDisabled()
  })

  it("botão 'Conferir hoje' do hero volta pro mês e pro dia de hoje (depois de navegar de mês)", async () => {
    await renderPage()
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }))
    expect(screen.getByText(`Maio ${ANO}`)).toBeInTheDocument()
    expect(screen.getByText(MSG_ESCOLHA_DIA)).toBeInTheDocument()

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
    expect(screen.getByPlaceholderText("0,00")).toHaveValue("100,00")
    expect(linha("Declarado (você)")).toHaveTextContent(/R\$\s?100,00/)

    fireEvent.click(screen.getByRole("button", { name: "Conferir hoje" }))
    expect(await screen.findByText(`hoje, ${diaMes(HOJE)}`)).toBeInTheDocument()
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenLastCalledWith("c1", HOJE_CALCULO))
    expect(screen.getByPlaceholderText("0,00")).toHaveValue("")
    // o "Declarado" volta a zero (o digitado de antes foi descartado)
    await screen.findByText("Calculado (app)")
    expect(linha("Declarado (você)")).toHaveTextContent(/R\$\s?0,00/)
    expect(linha("Declarado (você)")).not.toHaveTextContent(/100,00/)
  })

  it("trocar de mês limpa o dia selecionado: painel volta a pedir um dia e o campo de saldo some", async () => {
    await renderPage()
    expect(screen.getByText(ROTULO_SALDO_BANCO)).toBeInTheDocument() // hoje aberto
    digitarSaldoReal("10000")
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }))
    expect(screen.getByText(MSG_ESCOLHA_DIA)).toBeInTheDocument()
    expect(screen.queryByText(ROTULO_SALDO_BANCO)).not.toBeInTheDocument()
    expect(screen.queryByText("Calculado (app)")).not.toBeInTheDocument()
    // e voltar pro mês de hoje não traz a seleção (nem o valor digitado) de volta
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }))
    expect(screen.getByText(MSG_ESCOLHA_DIA)).toBeInTheDocument()
    expect(botaoDia(HOJE)).not.toHaveAttribute("data-sel")
  })

  it("regressão: dia selecionado + navegar pra mês com marco no MESMO número de dia não mostra o marco do outro mês", async () => {
    // marco só no mês SEGUINTE, no mesmo nº de dia que vamos selecionar
    listMarcos.mockResolvedValue([marco(DIA_LIVRE, { id: "m-next", saldoDeclarado: 777, saldoCalculado: 777 }, 1)])
    await renderPage()
    await abrirDiaLivre()
    digitarSaldoReal("10000")

    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }))
    // antes do fix o painel virava "Marco de <mês atual>" exibindo o marco do mês seguinte
    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument()
    expect(screen.getByText(MSG_ESCOLHA_DIA)).toBeInTheDocument()

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

  it("erro ao calcular o saldo de hoje (ao abrir) avisa por toast e não libera resultado nem gravação", async () => {
    getSaldoCalculado.mockRejectedValue(new Error("boom"))
    await renderPage({ manterMount: true })
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error", message: "Erro ao calcular o saldo de hoje" })))
    digitarSaldoReal("10000")
    expect(screen.queryByText("Diferença")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: GRAVAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: LANCAR })).not.toBeInTheDocument()
    expect(criarMarco).not.toHaveBeenCalled()
  })

  it("erro ao calcular o saldo de OUTRO dia avisa por toast e não libera resultado nem gravação", async () => {
    await renderPage()
    getSaldoCalculado.mockRejectedValue(new Error("boom"))
    clicarDia(DIA_LIVRE)
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error", message: "Erro ao calcular o saldo até esse dia" })))
    digitarSaldoReal("10000")
    expect(screen.queryByText("Diferença")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: GRAVAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
    expect(criarMarco).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------- conferir um dia (sem marco)

  it("clicar num dia sem marco busca o saldo calculado até o fim do dia e abre o painel de conferir", async () => {
    await renderPage()
    clicarDia(DIA_LIVRE)
    expect(await screen.findByText(ROTULO_SALDO_BANCO)).toBeInTheDocument()
    expect(screen.getByText(dataLabel(DIA_LIVRE), { selector: "strong" })).toBeInTheDocument() // "Conferir DD/MM/YYYY"
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalledWith("c1", fimDoDia(DIA_LIVRE)))
    // o calculado do app chega sozinho; o campo do banco começa vazio
    expect(await screen.findByText("Calculado (app)")).toBeInTheDocument()
    expect(linha("Calculado (app)")).toHaveTextContent(/R\$\s?100,00/)
    expect(screen.getByPlaceholderText("0,00")).toHaveValue("")
    // baseline foi removido da tela: não existe mais "Definir saldo inicial"
    expect(screen.queryByRole("button", { name: "Definir saldo inicial" })).not.toBeInTheDocument()
    expect(screen.queryByText("Saldo real da conta")).not.toBeInTheDocument()
  })

  it("painel UNIFORME ao conferir: título → campo do banco → Calculado/Declarado/Diferença → ações no rodapé, nessa ordem", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await abrirDiaLivre()
    digitarSaldoReal("15000") // não bate → 2 ações no rodapé
    await screen.findByRole("button", { name: AJUSTAR })

    expectOrdem(
      screen.getByText("Conta a conferir"),
      screen.getByText(/^Conferir$/), // título
      screen.getByText(ROTULO_SALDO_BANCO),
      screen.getByPlaceholderText("0,00"),
      screen.getByText("Calculado (app)"),
      screen.getByText("Declarado (você)"),
      screen.getByText("Diferença"),
      screen.getByRole("button", { name: LANCAR }),
      screen.getByRole("button", { name: AJUSTAR }),
    )
  })

  // --- bate

  it("conferir hoje: saldo do banco = calculado mostra 'Confere — gravar marco' e grava via criarMarco (1º marco = tipo 1)", async () => {
    // depois de gravar a tela recarrega: o 2º listMarcos já traz o marco de hoje
    const gravado = marco(HOJE, { id: "m-novo", tipo: 1, saldoDeclarado: 100, saldoCalculado: 100 })
    listMarcos.mockReset().mockResolvedValueOnce([]).mockResolvedValue([gravado])
    getSaldoCalculado.mockResolvedValue(100)
    await renderPage({ manterMount: true })
    await screen.findByText(ROTULO_SALDO_BANCO)
    await screen.findByText("Calculado (app)")

    digitarSaldoReal("10000") // 100,00
    expect(screen.getByText("Declarado (você)")).toBeInTheDocument()
    expect(screen.getByText("Diferença")).toBeInTheDocument()
    expect(linha("Calculado (app)")).toHaveTextContent(/R\$\s?100,00/)
    expect(linha("Declarado (você)")).toHaveTextContent(/R\$\s?100,00/)
    expect(linha("Diferença")).toHaveTextContent(/R\$\s?0,00/)
    expect(linha("Diferença")).not.toHaveTextContent(/[+-]R\$/)
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "true")
    // bateu: só o botão de gravar; nada de aviso de divergência nem das ações de divergência
    expect(screen.queryByText(/Sobrou|Faltou/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: LANCAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Definir saldo inicial" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: GRAVAR }))
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))
    const [dto, idemKey] = criarMarco.mock.calls[0]
    expect(dto).toMatchObject({ contaId: "c1", dataHora: HOJE_CALCULO, tipo: 1 }) // hoje grava com a hora atual; conta sem marco = tipo 1
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
    await screen.findByText("Calculado (app)")
    digitarSaldoReal("10000")
    expect(await screen.findByRole("button", { name: GRAVAR })).toBeInTheDocument()
  })

  // --- não bate (o baseline não existe mais: conta sem marco cai nas mesmas ações de uma com marco)

  it("não bate em conta SEM marcos: oferece 'Ajustar' e 'Lançar o que falta' (sem 'Definir saldo inicial') e grava com resolucao 'ajustar'", async () => {
    await renderPage()
    await abrirDiaLivre()

    digitarSaldoReal("15000") // declara 150,00 x calculado 100,00
    const ajustar = await screen.findByRole("button", { name: AJUSTAR })
    expect(screen.getByRole("button", { name: LANCAR })).toBeInTheDocument()
    expect(linha("Diferença")).toHaveTextContent(/\+R\$\s?50,00/) // diferença positiva com sinal
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "false")
    // baseline removido: não há botão de definir saldo inicial nem o aviso de "1ª conferência"
    expect(screen.queryByRole("button", { name: "Definir saldo inicial" })).not.toBeInTheDocument()
    expect(screen.queryByText(/1ª conferência da conta/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: GRAVAR })).not.toBeInTheDocument()

    fireEvent.click(ajustar)
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))
    const [dto] = criarMarco.mock.calls[0]
    expect(dto).toMatchObject({ contaId: "c1", tipo: 1, resolucao: "ajustar" }) // sem marco anterior o tipo segue sendo o 1º
    expect(dto.saldoDeclarado).toBeCloseTo(150, 2)
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: expect.stringContaining("ajuste") })))
  })

  it("não bate em conta COM marco: oferece 'Ajustar (cria lançamento)' e grava com resolucao 'ajustar' (tipo 2)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await abrirDiaLivre()

    digitarSaldoReal("15000") // 150,00 x 100,00
    const ajustar = await screen.findByRole("button", { name: AJUSTAR })
    expect(screen.getByRole("button", { name: LANCAR })).toBeInTheDocument()
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "false")
    // verificação não oferece "gravar marco" simples nem baseline
    expect(screen.queryByRole("button", { name: "Definir saldo inicial" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: GRAVAR })).not.toBeInTheDocument()

    fireEvent.click(ajustar)
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))
    const [dto] = criarMarco.mock.calls[0]
    expect(dto).toMatchObject({ contaId: "c1", tipo: 2, resolucao: "ajustar" })
    expect(dto.saldoDeclarado).toBeCloseTo(150, 2)
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: expect.stringContaining("ajuste") })))
  })

  it("aviso ESPECÍFICO por sinal: declarou mais que o app → 'Sobrou R$ X — tem mais no banco…'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await abrirDiaLivre()
    digitarSaldoReal("15000") // 150,00 x 100,00 → +50,00
    expect(await screen.findByText(/Sobrou R\$\s?50,00 — tem mais no banco do que o app contabilizou\./)).toBeInTheDocument()
    expect(screen.queryByText(/Faltou/)).not.toBeInTheDocument()
  })

  it("aviso ESPECÍFICO por sinal: declarou menos que o app → 'Faltou R$ X — tem menos no banco…' (valor sem sinal, só o texto diz a direção)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await abrirDiaLivre()
    digitarSaldoReal("4000") // 40,00 x 100,00 → -60,00
    expect(await screen.findByText(/Faltou R\$\s?60,00 — tem menos no banco do que o app contabilizou\./)).toBeInTheDocument()
    expect(screen.queryByText(/Sobrou/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Faltou -/)).not.toBeInTheDocument()
  })

  it("diferença negativa (declarou menos que o calculado) também cai em 'Ajustar', com sinal de menos na linha Diferença", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await abrirDiaLivre()
    digitarSaldoReal("4000") // 40,00 x 100,00 → -60,00
    expect(await screen.findByRole("button", { name: AJUSTAR })).toBeInTheDocument()
    expect(linha("Diferença")).toHaveTextContent(/-R\$\s?60,00/)
    expect(linha("Diferença")).not.toHaveTextContent(/\+R\$/)
  })

  it("bateu: o aviso de Sobrou/Faltou some assim que o valor digitado iguala o calculado", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await abrirDiaLivre()
    digitarSaldoReal("15000")
    expect(await screen.findByText(/Sobrou/)).toBeInTheDocument()
    digitarSaldoReal("10000")
    await waitFor(() => expect(screen.queryByText(/Sobrou|Faltou/)).not.toBeInTheDocument())
    expect(screen.getByRole("button", { name: GRAVAR })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
  })

  it("'Lançar o que falta' navega pra /transactions sem gravar nada", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await abrirDiaLivre()
    digitarSaldoReal("15000")
    fireEvent.click(await screen.findByRole("button", { name: LANCAR }))
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
    expect(screen.getByText(ROTULO_SALDO_BANCO)).toBeInTheDocument()
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

  // ---------------------------------------------------------------- movimentos (PontesTabela full-width)

  it("movimentos = PontesTabela com Data / Lançamento / Valor: hora aparece como 'dd/mm HH:MM' e, sem hora (null), só 'dd/mm'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    listTransactionsPage.mockResolvedValue({
      items: [tx("t1", "Mercado", 50, 1, 16), tx("t2", "Salário", 1000, 2, 18, null)],
      total: 2,
    })
    await renderPage()
    expect(await tituloMov(`Movimentos desde ${diaMes(DIA_MARCO)} até ${diaMes(HOJE)}`)).toBeInTheDocument()
    const tabela = await screen.findByRole("table")
    expect(within(tabela).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Data", "Lançamento", "Valor"])

    const [mercado, salario] = linhasMov()
    const [mData, mDesc] = celulas(mercado)
    expect(mData).toHaveTextContent(`${diaMes(16)} 12:00`) // hora "12:00:00" → HH:MM (sem segundos)
    expect(mDesc).toHaveTextContent("Mercado")
    const [sData, sDesc] = celulas(salario)
    expect(sData).toHaveTextContent(new RegExp(`^${diaMes(18)}$`)) // hora null → só o dia, sem inventar 00:00
    expect(sDesc).toHaveTextContent("Salário")
    expect(within(tabela).queryByText(/00:00/)).not.toBeInTheDocument()
  })

  it("coluna Valor SEM +/−: despesa e receita mostram só o valor; a direção vem da COR (classe), não do sinal", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    listTransactionsPage.mockResolvedValue({
      items: [tx("t1", "Mercado", 50, 1, 16), tx("t2", "Salário", 1000, 2, 18)],
      total: 2,
    })
    await renderPage()
    await screen.findByRole("table")
    const [mercado, salario] = linhasMov()
    const valorMercado = celulas(mercado)[2]
    const valorSalario = celulas(salario)[2]
    expect(valorMercado).toHaveTextContent(/^R\$\s?50,00$/)
    expect(valorSalario).toHaveTextContent(/^R\$\s?1\.000,00$/)
    for (const c of [valorMercado, valorSalario]) {
      expect(c.textContent).not.toMatch(/[+−-]/)
      expect(c).toHaveAttribute("data-num", "true") // numérica: alinhada à direita
    }
    expect(valorMercado.firstElementChild!.className).toMatch(/movValorNeg/) // despesa
    expect(valorSalario.firstElementChild!.className).toMatch(/movValorPos/) // receita
    expect(valorMercado.firstElementChild!.className).not.toMatch(/movValorPos/)
    expect(valorSalario.firstElementChild!.className).not.toMatch(/movValorNeg/)
  })

  it("a data do movimento sai do string, sem fuso: 23:30 fica no MESMO dia e a hora 00:00:00 (meia-noite real) aparece", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    listTransactionsPage.mockResolvedValue({
      items: [tx("t1", "Tarde da noite", 10, 1, 16, "23:30:00"), tx("t2", "Virada", 20, 1, 17, "00:00:00")],
      total: 2,
    })
    await renderPage()
    await screen.findByRole("table")
    const [noite, virada] = linhasMov()
    expect(celulas(noite)[0]).toHaveTextContent(`${diaMes(16)} 23:30`)
    expect(celulas(virada)[0]).toHaveTextContent(`${diaMes(17)} 00:00`) // hora "00:00:00" ≠ null → mostra
  })

  it("a tabela é SEMPRE visível (full-width): sem lançamentos mostra o estado vazio do próprio componente, sem toast", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage({ manterMount: true })
    expect(await tituloMov(`Movimentos desde ${diaMes(DIA_MARCO)} até ${diaMes(HOJE)}`)).toBeInTheDocument()
    expect(await screen.findByText(MSG_SEM_MOVIMENTOS)).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.queryByText(MSG_ESCOLHA_DIA_TABELA)).not.toBeInTheDocument() // com dia selecionado não há dica
    expect(notify).not.toHaveBeenCalled()
    expect(screen.getByText(ROTULO_SALDO_BANCO)).toBeInTheDocument() // o painel de conferir segue normal
  })

  it("sem dia selecionado (mês trocado): a tabela segue lá, com título 'Movimentos', lista vazia e a dica de escolher um dia", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    listTransactionsPage.mockResolvedValue({ items: [tx("t1", "Mercado", 50, 1, 16)], total: 1 })
    await renderPage()
    expect(await screen.findByRole("table")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }))
    expect(await tituloMov("Movimentos")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: /Movimentos desde/ })).not.toBeInTheDocument()
    expect(await screen.findByText(MSG_SEM_MOVIMENTOS)).toBeInTheDocument()
    expect(screen.getByText(MSG_ESCOLHA_DIA_TABELA)).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument() // a lista do dia anterior não vaza
  })

  it("busca os movimentos da conta, do marco anterior ao dia até o dia seguinte ao selecionado, só caixa (100 por vez)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 100, {
      contaId: "c1", from: isoDia(DIA_MARCO), to: isoDia(HOJE + 1), apenasCaixa: true,
    }))
  })

  it("selecionar outro dia refaz a busca até o dia seguinte a ele (e vira o mês: 30/06 → 01/07)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    clicarDia(17)
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 100, expect.objectContaining({ from: isoDia(DIA_MARCO), to: isoDia(18) })))
    clicarDia(30)
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 100, expect.objectContaining({ from: isoDia(DIA_MARCO), to: `${ANO}-07-01` })))
  })

  it("o 'desde' é o marco ANTERIOR ao dia selecionado, não o último marco global (marcos nos dias 5 e 15)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO), marco(5, { tipo: 1 })])
    listTransactionsPage.mockResolvedValue({ items: [tx("t1", "Mercado", 50, 1, 8)], total: 1 })
    await renderPage()
    // dia 10: o marco anterior é o do dia 5 (o do dia 15 ainda não existia)
    clicarDia(DIA_LIVRE)
    expect(await tituloMov(`Movimentos desde ${diaMes(5)} até ${diaMes(DIA_LIVRE)}`)).toBeInTheDocument()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 100, expect.objectContaining({ from: isoDia(5), to: isoDia(DIA_LIVRE + 1) })))
    // dia 20 (hoje): o anterior é o do dia 15
    clicarDia(HOJE)
    expect(await tituloMov(`Movimentos desde ${diaMes(DIA_MARCO)} até ${diaMes(HOJE)}`)).toBeInTheDocument()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 100, expect.objectContaining({ from: isoDia(DIA_MARCO), to: isoDia(HOJE + 1) })))
  })

  it("dia ANTERIOR a todos os marcos: busca sem limite inferior e o título é 'Movimentos desde o começo até dd/mm'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    listTransactionsPage.mockResolvedValue({ items: [tx("t1", "Mercado", 50, 1, 3)], total: 1 })
    await renderPage()
    expect(await tituloMov(`Movimentos desde ${diaMes(DIA_MARCO)} até ${diaMes(HOJE)}`)).toBeInTheDocument() // hoje

    clicarDia(DIA_LIVRE) // 10 < marco do dia 15: não há marco anterior
    await screen.findByText(ROTULO_SALDO_BANCO)
    expect(await tituloMov(`Movimentos desde o começo até ${diaMes(DIA_LIVRE)}`)).toBeInTheDocument()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 100, expect.objectContaining({ from: undefined, to: isoDia(DIA_LIVRE + 1) })))
    expect(await screen.findByText("Mercado")).toBeInTheDocument()
  })

  it("sem nenhum marco: título 'Movimentos desde o começo até hoje' e a busca não tem limite inferior", async () => {
    listTransactionsPage.mockResolvedValue({ items: [tx("t1", "Compra", 20, 1, 3)], total: 1 })
    await renderPage()
    expect(await tituloMov(`Movimentos desde o começo até ${diaMes(HOJE)}`)).toBeInTheDocument()
    expect(await screen.findByText("Compra")).toBeInTheDocument()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 100, expect.objectContaining({ from: undefined, to: isoDia(HOJE + 1) })))
  })

  it("erro ao buscar os movimentos é silencioso: sem toast, a tabela cai no estado vazio e o painel segue conferível", async () => {
    listTransactionsPage.mockRejectedValue(new Error("boom"))
    await renderPage({ manterMount: true })
    expect(await screen.findByText(MSG_SEM_MOVIMENTOS)).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(notify).not.toHaveBeenCalled()
    expect(screen.getByText(ROTULO_SALDO_BANCO)).toBeInTheDocument()
  })

  it("dia COM marco: os movimentos aparecem TAMBÉM junto do marco gravado (desde o marco anterior a ele)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO), marco(5, { tipo: 1 })])
    listTransactionsPage.mockResolvedValue({ items: [tx("t1", "Mercado", 50, 1, 8)], total: 1 })
    await renderPage()

    clicarDia(DIA_MARCO)
    expect(await screen.findByRole("button", { name: "Remover" })).toBeInTheDocument() // painel do marco
    expect(screen.queryByText(ROTULO_SALDO_BANCO)).not.toBeInTheDocument()
    // o marco do dia 15 é o dia selecionado; o ANTERIOR a ele é o do dia 5
    expect(await tituloMov(`Movimentos desde ${diaMes(5)} até ${diaMes(DIA_MARCO)}`)).toBeInTheDocument()
    expect(await screen.findByText("Mercado")).toBeInTheDocument()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 100, expect.objectContaining({ from: isoDia(5), to: isoDia(DIA_MARCO + 1) })))
  })

  it("marco DERIVADO também mostra os movimentos do dia (só as ações de remover somem)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { tipo: 1, derivado: true, saldoDeclarado: 300, saldoCalculado: 300 })])
    listTransactionsPage.mockResolvedValue({ items: [tx("t1", "Mercado", 50, 1, 14)], total: 1 })
    await renderPage()
    clicarDia(DIA_MARCO)
    expect(await screen.findByText("Ponto de partida da conta.")).toBeInTheDocument()
    expect(await screen.findByText("Mercado")).toBeInTheDocument()
    // primeiro marco da conta: não há marco anterior → "desde o começo"
    expect(await tituloMov(`Movimentos desde o começo até ${diaMes(DIA_MARCO)}`)).toBeInTheDocument()
  })

  // ---------------------------------------------------------------- última conferência

  it("'Última conferência' mostra SÓ a mais recente (dd/mm + saldo declarado), não a lista inteira de marcos", async () => {
    listMarcos.mockResolvedValue([
      marco(18, { temAjuste: true, diferenca: 10, saldoDeclarado: 510 }),
      marco(DIA_MARCO, { saldoDeclarado: 500 }),
      marco(5, { tipo: 1, derivado: true, saldoDeclarado: 300, saldoCalculado: 300 }),
    ])
    await renderPage()
    await waitFor(() => expect(ultimaConferencia()).toHaveTextContent(diaMes(18)))
    expect(ultimaConferencia()).toHaveTextContent(/R\$\s?510,00/)
    // as linhas antigas (15 e 5) não viram linha de histórico
    expect(ultimaConferencia()).not.toHaveTextContent(diaMes(DIA_MARCO))
    expect(ultimaConferencia()).not.toHaveTextContent(diaMes(5))
    expect(screen.queryByText("Histórico de marcos")).not.toBeInTheDocument()
    expect(screen.queryByText(/Nenhuma conferência ainda/)).not.toBeInTheDocument()
  })

  it("a tag 'partida' só aparece quando o marco mais recente é o baseline (saldo inicial)", async () => {
    listMarcos.mockResolvedValue([marco(5, { tipo: 1, derivado: true, saldoDeclarado: 300, saldoCalculado: 300 })])
    await renderPage()
    await waitFor(() => expect(ultimaConferencia()).toHaveTextContent(diaMes(5)))
    expect(ultimaConferencia()).toHaveTextContent(/R\$\s?300,00/)
    expect(within(ultimaConferencia()).getByText("partida")).toBeInTheDocument()
  })

  it("marco comum (verificação) na última conferência não tem a tag 'partida'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { saldoDeclarado: 500 })])
    await renderPage()
    await waitFor(() => expect(ultimaConferencia()).toHaveTextContent(diaMes(DIA_MARCO)))
    expect(within(ultimaConferencia()).queryByText("partida")).not.toBeInTheDocument()
  })

  it("sem marcos a última conferência mostra o convite pra conferir hoje", async () => {
    await renderPage()
    expect(screen.getByText("Nenhuma conferência ainda. Confira o saldo de hoje pra começar.")).toBeInTheDocument()
  })

  it("clicar na última conferência abre o marco daquele dia (e destaca a linha)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { saldoCalculado: 480, saldoDeclarado: 500, diferenca: 20, temAjuste: true }), marco(5, { tipo: 1, saldoDeclarado: 300 })])
    await renderPage()
    await waitFor(() => expect(ultimaConferencia()).toHaveTextContent(diaMes(DIA_MARCO)))
    expect(ultimaConferencia()).not.toHaveAttribute("data-sel")

    fireEvent.click(ultimaConferencia())
    expect(await screen.findByText(dataLabel(DIA_MARCO), { selector: "strong" })).toBeInTheDocument() // "Marco de DD/MM/YYYY"
    expect(screen.getByRole("button", { name: "Remover" })).toBeInTheDocument()
    expect(ultimaConferencia()).toHaveAttribute("data-sel", "true")
    expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-sel", "true")
  })

  it("clicar na última conferência de OUTRO mês leva o calendário pra esse mês", async () => {
    listMarcos.mockResolvedValue([marco(15, {}, -1)]) // 15/05
    await renderPage()
    await waitFor(() => expect(ultimaConferencia()).toHaveTextContent("15/05"))
    expect(screen.getByText(`Junho ${ANO}`)).toBeInTheDocument()

    fireEvent.click(ultimaConferencia())
    expect(await screen.findByText(`Maio ${ANO}`)).toBeInTheDocument()
    expect(await screen.findByText("15/05/2026", { selector: "strong" })).toBeInTheDocument() // "Marco de 15/05/2026"
    expect(botaoDia(15)).toHaveAttribute("data-sel", "true")
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
    expect(screen.getByRole("button", { name: "Alterar valor" })).toBeInTheDocument()
    // o marco gravado é mostrado como foi gravado: o campo vira "Saldo conferido", desabilitado, com o valor declarado
    expect(screen.queryByText(ROTULO_SALDO_BANCO)).not.toBeInTheDocument()
    expect(screen.getByText("Saldo conferido")).toBeInTheDocument()
    const campo = screen.getByPlaceholderText("0,00")
    expect(campo).toBeDisabled()
    expect(campo).toHaveValue("500,00")
  })

  it("painel UNIFORME num marco: mesmo esqueleto do conferir (título → campo → 3 linhas → ações no rodapé)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu"))
    clicarDia(DIA_MARCO)
    await screen.findByRole("button", { name: "Remover" })

    expectOrdem(
      screen.getByText("Conta a conferir"),
      screen.getByText(/^Marco de$/),
      screen.getByText("Saldo conferido"),
      screen.getByPlaceholderText("0,00"),
      screen.getByText("Calculado (app)"),
      screen.getByText("Declarado (você)"),
      screen.getByText("Diferença"),
      screen.getByRole("button", { name: "Alterar valor" }),
      screen.getByRole("button", { name: "Remover" }),
    )
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "true")
  })

  it("marco sem ajuste não mostra a tag de 'lançamento de ajuste criado' (e marco comum não é 'ponto de partida')", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu"))
    clicarDia(DIA_MARCO)
    await screen.findByRole("button", { name: "Remover" })
    expect(screen.queryByText("lançamento de ajuste criado")).not.toBeInTheDocument()
    expect(screen.queryByText("Ponto de partida da conta.")).not.toBeInTheDocument()
  })

  it("'Remover' é o botão vermelho (variante danger-outline); 'Alterar valor' é o neutro (outline)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu"))
    clicarDia(DIA_MARCO)
    expect(await screen.findByRole("button", { name: "Remover" })).toHaveAttribute("data-variant", "danger-outline")
    expect(screen.getByRole("button", { name: "Alterar valor" })).toHaveAttribute("data-variant", "outline")
  })

  it("marco DERIVADO (ponto de partida): mostra a nota, oferece SÓ 'Alterar valor' e NÃO oferece 'Remover'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { tipo: 1, derivado: true, saldoDeclarado: 300, saldoCalculado: 300 })])
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "inicial"))
    clicarDia(DIA_MARCO)

    expect(await screen.findByText("Ponto de partida da conta.")).toBeInTheDocument()
    expect(screen.queryByText(/pra mudar, edite a conta/)).not.toBeInTheDocument() // nota antiga
    expect(screen.getByRole("button", { name: "Alterar valor" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument()
    // o resto do marco continua visível
    expect(screen.getByText("Calculado (app)")).toBeInTheDocument()
    expect(screen.getByText("Declarado (você)")).toBeInTheDocument()
    expect(screen.getByText(dataLabel(DIA_MARCO), { selector: "strong" })).toBeInTheDocument()
    // e sem botão de remover não há como abrir o dialog de remoção
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

  // ---------------------------------------------------------------- alterar valor de um marco gravado (não derivado)

  it("marco gravado (não derivado) oferece DOIS botões: 'Alterar valor' e 'Remover'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu"))
    clicarDia(DIA_MARCO)
    expect(await screen.findByRole("button", { name: "Alterar valor" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remover" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remover marco" })).not.toBeInTheDocument() // rótulo antigo
  })

  it("'Alterar valor': remove o marco (sem confirmação) e reabre o conferir do MESMO dia com o campo do banco vazio", async () => {
    // 1ª leitura traz o marco; depois de removido, a releitura vem sem ele
    listMarcos.mockReset().mockResolvedValueOnce([marco(DIA_MARCO)]).mockResolvedValue([])
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu"))
    clicarDia(DIA_MARCO)
    fireEvent.click(await screen.findByRole("button", { name: "Alterar valor" }))

    await waitFor(() => expect(removerMarco).toHaveBeenCalledWith(`m-${DIA_MARCO}`))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument() // alterar não pede confirmação
    // painel volta ao modo conferir NAQUELE dia (não em hoje), com o campo do banco
    expect(await screen.findByText(ROTULO_SALDO_BANCO)).toBeInTheDocument()
    expect(screen.getByText("Conferir")).toBeInTheDocument()
    expect(screen.getByText(dataLabel(DIA_MARCO), { selector: "strong" })).toBeInTheDocument()
    expect(screen.queryByText(`hoje, ${diaMes(HOJE)}`)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Alterar valor" })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText("0,00")).toHaveValue("")
    await waitFor(() => expect(listMarcos).toHaveBeenCalledTimes(2)) // recarregou
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenLastCalledWith("c1", fimDoDia(DIA_MARCO)))
    expect(notify).not.toHaveBeenCalledWith(expect.objectContaining({ severity: "error" }))
    // o 'Alterar valor' de marco comum NÃO é a edição do saldo inicial
    expect(atualizarSaldoInicial).not.toHaveBeenCalled()
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
    expect(screen.queryByText(ROTULO_SALDO_BANCO)).not.toBeInTheDocument()
    expect(listMarcos).toHaveBeenCalledTimes(1)
  })

  // ---------------------------------------------------------------- editar o saldo inicial (marco de partida)

  describe("editar o saldo inicial (marco derivado → 'Alterar valor')", () => {
    const PARTIDA = () => marco(DIA_MARCO, { tipo: 1, derivado: true, saldoDeclarado: 300, saldoCalculado: 300 })
    const campoValor = () => screen.getByPlaceholderText("0,00") as HTMLInputElement

    async function abrirEdicaoInicial() {
      listMarcos.mockResolvedValue([PARTIDA()])
      await renderPage()
      await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "inicial"))
      clicarDia(DIA_MARCO)
      fireEvent.click(await screen.findByRole("button", { name: "Alterar valor" }))
      await screen.findByRole("button", { name: "Salvar saldo inicial" })
    }

    it("abre o formulário no painel: título 'Saldo inicial da conta', Valor pré-preenchido, 'Desde' com a data do marco, Salvar/Cancelar", async () => {
      await abrirEdicaoInicial()
      expect(screen.getByText("da conta", { selector: "strong" })).toBeInTheDocument()
      expect(screen.getByText("O ponto de partida da conta — vale a partir desta data.")).toBeInTheDocument()
      expect(screen.getByText("Valor")).toBeInTheDocument()
      expect(campoValor()).toHaveValue("300,00")
      expect(screen.getByText("Desde")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: dataLabel(DIA_MARCO) })).toBeInTheDocument() // PontesDateInput
      expect(screen.getByRole("button", { name: "Salvar saldo inicial" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument()
      // no modo edição o painel NÃO mostra o resultado de conferência nem os botões do marco
      expect(screen.queryByText("Calculado (app)")).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Alterar valor" })).not.toBeInTheDocument()
      expect(atualizarSaldoInicial).not.toHaveBeenCalled()
    })

    it("salvar: chama atualizarSaldoInicial(conta, { valor, data }), avisa por toast, fecha a edição e recarrega contas + marcos", async () => {
      await abrirEdicaoInicial()
      fireEvent.change(campoValor(), { target: { value: "45000" } }) // máscara → 450,00
      expect(campoValor()).toHaveValue("450,00")
      const contasAntes = getContas.mock.calls.length
      const marcosAntes = listMarcos.mock.calls.length

      fireEvent.click(screen.getByRole("button", { name: "Salvar saldo inicial" }))
      await waitFor(() => expect(atualizarSaldoInicial).toHaveBeenCalledTimes(1))
      expect(atualizarSaldoInicial).toHaveBeenCalledWith("c1", { valor: 450, data: isoDia(DIA_MARCO) })
      await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: "Saldo inicial atualizado" })))
      // volta pro painel do marco e recarrega (o saldo do hero e o marco vêm do backend de novo)
      await waitFor(() => expect(screen.queryByRole("button", { name: "Salvar saldo inicial" })).not.toBeInTheDocument())
      expect(await screen.findByText("Ponto de partida da conta.")).toBeInTheDocument()
      await waitFor(() => expect(getContas.mock.calls.length).toBeGreaterThan(contasAntes))
      await waitFor(() => expect(listMarcos.mock.calls.length).toBeGreaterThan(marcosAntes))
    })

    it("dá pra mudar a data ('Desde') pelo calendário e ela vai no payload", async () => {
      await abrirEdicaoInicial()
      fireEvent.click(screen.getByRole("button", { name: dataLabel(DIA_MARCO) }))
      const calendario = await screen.findByRole("dialog", { name: "Escolher data" })
      fireEvent.click(within(calendario).getByRole("button", { name: "12" }))

      fireEvent.click(screen.getByRole("button", { name: "Salvar saldo inicial" }))
      await waitFor(() => expect(atualizarSaldoInicial).toHaveBeenCalledWith("c1", { valor: 300, data: isoDia(12) }))
    })

    it("valor vazio/zero bloqueia: não chama o serviço, avisa e a edição segue aberta", async () => {
      await abrirEdicaoInicial()
      fireEvent.change(campoValor(), { target: { value: "" } })
      expect(campoValor()).toHaveValue("")

      fireEvent.click(screen.getByRole("button", { name: "Salvar saldo inicial" }))
      // contrato ATUAL: o aviso é por toast (o padrão de form do projeto pede erro inline por campo — ver relatório)
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error", message: "Informe um valor maior que zero." }))
      expect(atualizarSaldoInicial).not.toHaveBeenCalled()
      expect(screen.getByRole("button", { name: "Salvar saldo inicial" })).toBeInTheDocument()
    })

    it("erro do servidor: toast de erro, a edição segue aberta (nada perdido) e não recarrega", async () => {
      atualizarSaldoInicial.mockRejectedValue(new Error("boom"))
      await abrirEdicaoInicial()
      const marcosAntes = listMarcos.mock.calls.length

      fireEvent.click(screen.getByRole("button", { name: "Salvar saldo inicial" }))
      await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error", message: "Erro ao salvar o saldo inicial" })))
      expect(screen.getByRole("button", { name: "Salvar saldo inicial" })).toBeInTheDocument()
      expect(campoValor()).toHaveValue("300,00")
      expect(listMarcos.mock.calls.length).toBe(marcosAntes)
      expect(notify).not.toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))
    })

    it("'Cancelar' volta pro painel do marco sem chamar o serviço", async () => {
      await abrirEdicaoInicial()
      fireEvent.change(campoValor(), { target: { value: "99900" } })
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

      expect(await screen.findByText("Ponto de partida da conta.")).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Salvar saldo inicial" })).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Alterar valor" })).toBeInTheDocument()
      expect(campoValor()).toBeDisabled() // o marco continua com o valor original, desabilitado
      expect(campoValor()).toHaveValue("300,00")
      expect(atualizarSaldoInicial).not.toHaveBeenCalled()
    })

    it("escolher outro dia no calendário sai da edição e abre o dia clicado", async () => {
      await abrirEdicaoInicial()
      clicarDia(DIA_LIVRE)
      expect(await screen.findByText(ROTULO_SALDO_BANCO)).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Salvar saldo inicial" })).not.toBeInTheDocument()
      expect(atualizarSaldoInicial).not.toHaveBeenCalled()
    })

    it("trocar a conta sai da edição (o formulário não vaza pra outra conta)", async () => {
      await abrirEdicaoInicial()
      fireEvent.click(screen.getByRole("button", { name: "Conta Corrente" }))
      fireEvent.click(await screen.findByRole("button", { name: "Poupança" }))
      await waitFor(() => expect(listMarcos).toHaveBeenLastCalledWith("c2"))
      await waitFor(() => expect(screen.queryByRole("button", { name: "Salvar saldo inicial" })).not.toBeInTheDocument())
      expect(atualizarSaldoInicial).not.toHaveBeenCalled()
    })
  })
})
