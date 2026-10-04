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
//    topbar) → título → input → 3 linhas (Calculado / Declarado / Diferença) → slot de nota (só a nota
//    de partida; SEM cartão de aviso Sobrou/Faltou — a linha Diferença vermelha/verde já diz) → ações no rodapé.
//  - Coluna direita = calendário de marcos + "Última conferência".
//  - Embaixo: PontesTabela full-width SEMPRE visível com os movimentos (do marco ANTERIOR ao dia até o dia).
// Baseline REMOVIDO da tela: o saldo inicial vem só do cadastro da conta (marco derivado); a tela só confere e
// ajusta — e o marco de partida tem "Alterar valor" (edita valor + data do saldo inicial aqui mesmo).
//
// FLUXO EM DOIS PASSOS (o "Ajustar" só existe DEPOIS de a pessoa salvar o saldo do banco):
//  1) dia SEM marco ("Saldo que aparece no seu banco"): digitar só alimenta as linhas (Diferença ao vivo). A
//     única ação é "Salvar saldo do banco" (desabilitada com o campo vazio) → criarMarco SEMPRE como
//     verificação (tipo 2), sem `resolucao`. Nada de aviso Sobrou/Faltou nem Ajustar/Lançar nesse passo.
//  2) dia COM marco gravado ("Saldo do banco", desabilitado): a tela recalcula o saldo do app AO VIVO até a
//     data do marco (getSaldoCalculado) e a diferença mostrada é `declarado − calculadoAgora` (não a gravada).
//     Marco "pendente" (sem ajuste e diferença ≠ 0) → Diferença vermelha + "Lançar o que falta" + "Ajustar (cria
//     lançamento)", que chama fecharDiferenca(marco.id, key). Se a pessoa já lançou o que faltava (agora
//     bate, mas a gravada era ≠ 0) → "Confere — atualizar marco" (também fecharDiferenca).
//
// "Agora" é FIXO (só o Date é falsificado; timers seguem reais pro waitFor): a tela decide pendente/futuro/
// movimentos comparando dia × hoje, então o teste não pode depender do dia em que roda.
const {
  notify, navigateSpy, getContas, atualizarSaldoInicial,
  listMarcos, getSaldoCalculado, criarMarco, fecharDiferenca, removerMarco, listTransactionsPage,
} = vi.hoisted(() => ({
  notify: vi.fn(),
  navigateSpy: vi.fn(),
  getContas: vi.fn(),
  atualizarSaldoInicial: vi.fn(),
  listMarcos: vi.fn(),
  getSaldoCalculado: vi.fn(),
  criarMarco: vi.fn(),
  fecharDiferenca: vi.fn(),
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
  fecharDiferenca: (...a: unknown[]) => fecharDiferenca(...a),
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
const SALVAR = "Salvar saldo do banco"
const AJUSTAR = "Ajustar (cria lançamento)"
const LANCAR = "Lançar o que falta"
const CONFERE_ATUALIZAR = "Confere — atualizar marco"
const GRAVAR_ANTIGO = "Confere — gravar marco" // botão do fluxo antigo: não existe mais
const ROTULO_SALDO_BANCO = "Saldo que aparece no seu banco" // campo do dia SEM marco (digitar)
const ROTULO_SALDO_SALVO = "Saldo do banco" // campo do dia COM marco (só leitura)
const TOAST_BATE = "Conferido — saldo bate ✓"
const TOAST_SALVO = "Saldo do banco salvo"
const TOAST_AJUSTE = "Ajuste lançado — saldo bate ✓"
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

// dataHora que o `marco(dia)` carrega (wall-clock gravado como UTC, 14:30): é o argumento com que a tela
// recalcula o saldo do app AO VIVO quando esse marco é aberto.
const dataHoraMarco = (dia: number) => `${isoDia(dia)}T14:30:00.000Z`
// Faz o recálculo ao vivo de UM marco devolver `valor`; qualquer outra consulta (hoje, fim de outro dia) segue 100.
const calculoAoVivoDoMarco = (dia: number, valor: number) =>
  getSaldoCalculado.mockImplementation(async (_contaId: string, dataHora: string) => (dataHora === dataHoraMarco(dia) ? valor : 100))
// Abre o painel de um dia que JÁ tem marco gravado e espera o recálculo ao vivo chegar e assentar
// (antes dele a tela mostra o calculado gravado no marco — o aviso/botões certos só valem depois).
async function abrirMarcoSalvo(dia: number) {
  await waitFor(() => expect(botaoDia(dia)).toHaveAttribute("data-marco"))
  clicarDia(dia)
  await screen.findByRole("button", { name: "Remover" })
  await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalledWith("c1", dataHoraMarco(dia)))
  await act(async () => {}) // deixa o setCalcMarco assentar
}
// Rodapé de ações do painel de conferir (onde moram Salvar / Ajustar / Alterar / Remover).
const rodapeAcoes = () => painelConferir().querySelector('[class*="_painelFooter_"]') as HTMLElement

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
    fecharDiferenca.mockReset().mockResolvedValue(marco(DIA_MARCO, { temAjuste: true }))
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
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({ contaId: "c2" })))
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

  it("marca no calendário cada tipo de marco (inicial / conferido / ajuste / com diferença)", async () => {
    listMarcos.mockResolvedValue([
      marco(18, { temAjuste: true, diferenca: 10, saldoDeclarado: 510 }),
      marco(DIA_MARCO),
      marco(12, { saldoDeclarado: 525, saldoCalculado: 500, diferenca: 25 }), // salvo e ainda não bate, sem ajuste
      marco(5, { tipo: 1, saldoDeclarado: 300 }),
    ])
    await renderPage()
    await waitFor(() => expect(botaoDia(5)).toHaveAttribute("data-marco", "inicial"))
    expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu")
    expect(botaoDia(18)).toHaveAttribute("data-marco", "ajuste")
    expect(botaoDia(12)).toHaveAttribute("data-marco", "diferenca")
    expect(botaoDia(DIA_LIVRE)).not.toHaveAttribute("data-marco")
  })

  it("tom 'com diferença' do calendário: salvo SEM ajuste e |diferença| >= 0,005 — positiva ou negativa; abaixo do limiar é 'bateu'", async () => {
    listMarcos.mockResolvedValue([
      marco(18, { diferenca: -40, saldoDeclarado: 460 }),
      marco(17, { diferenca: 0.005, saldoDeclarado: 500.005 }),
      marco(16, { diferenca: 0.004, saldoDeclarado: 500.004 }),
      marco(DIA_MARCO, { diferenca: 30, saldoDeclarado: 530 }),
    ])
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "diferenca"))
    expect(botaoDia(18)).toHaveAttribute("data-marco", "diferenca") // negativa também
    expect(botaoDia(17)).toHaveAttribute("data-marco", "diferenca") // exatamente meio centavo já conta
    expect(botaoDia(16)).toHaveAttribute("data-marco", "bateu") // 0,004 é arredondamento
  })

  it("precedência do tom: ponto de partida e ajuste ganham de 'com diferença' (mesmo com diferenca ≠ 0)", async () => {
    listMarcos.mockResolvedValue([
      marco(18, { temAjuste: true, diferenca: 10, saldoDeclarado: 510 }),
      marco(DIA_MARCO, { tipo: 1, derivado: true, diferenca: 30, saldoDeclarado: 530 }),
    ])
    await renderPage()
    await waitFor(() => expect(botaoDia(18)).toHaveAttribute("data-marco", "ajuste"))
    expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "inicial")
  })

  it("a legenda do calendário tem a entrada nova 'com diferença' (com a bolinha 'diferenca') ao lado das demais", async () => {
    await renderPage()
    const entrada = screen.getByText("com diferença")
    expect(entrada.querySelector('[data-t="diferenca"]')).toBeInTheDocument()
    const legenda = entrada.parentElement as HTMLElement
    expect(legenda).toHaveTextContent("conferido")
    expect(legenda).toHaveTextContent("ajuste")
    expect(legenda).toHaveTextContent("com diferença")
    expect(legenda).toHaveTextContent("a conferir")
    for (const t of ["bateu", "ajuste", "diferenca", "pendente"]) {
      expect(legenda.querySelector(`[data-t="${t}"]`)).toBeInTheDocument()
    }
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
    // o "Calculado (app)" já aparece, sem a pessoa digitar nada; "Declarado" e "Diferença" ficam em "—"
    expect(await screen.findByText("Calculado (app)")).toBeInTheDocument()
    expect(linha("Calculado (app)")).toHaveTextContent(/R\$\s?100,00/)
    expect(linha("Declarado (você)")).toHaveTextContent("—")
    expect(linha("Diferença")).toHaveTextContent("—")
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
    expect(screen.queryByRole("button", { name: SALVAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: LANCAR })).not.toBeInTheDocument()

    await act(async () => { resolver(100) })
    expect(await screen.findByText("Calculado (app)")).toBeInTheDocument()
    expect(screen.queryByText("Calculando o saldo do dia…")).not.toBeInTheDocument()
    // chegou o cálculo: a ÚNICA ação é salvar (desabilitada enquanto o campo do banco está vazio)
    expect(screen.getByRole("button", { name: SALVAR })).toBeDisabled()
  })

  it("hoje já tem marco: ao abrir, o painel mostra o marco de hoje ('Saldo do banco', desabilitado) e não o campo de conferir", async () => {
    listMarcos.mockResolvedValue([marco(HOJE)])
    await renderPage({ manterMount: true })
    expect(await screen.findByRole("button", { name: "Remover" })).toBeInTheDocument()
    expect(screen.getByText(dataLabel(HOJE), { selector: "strong" })).toBeInTheDocument() // "Marco de DD/MM/YYYY"
    expect(screen.queryByText(ROTULO_SALDO_BANCO)).not.toBeInTheDocument()
    expect(screen.getByText(ROTULO_SALDO_SALVO)).toBeInTheDocument()
    expect(screen.queryByText("Saldo conferido")).not.toBeInTheDocument() // rótulo antigo
    expect(screen.getByPlaceholderText("0,00")).toBeDisabled()
    expect(screen.getByPlaceholderText("0,00")).toHaveValue("500,00") // o declarado gravado
    // marco gravado → recalcula o saldo do app ao vivo até a data+hora DELE (além do cálculo de "hoje" do mount)
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalledWith("c1", dataHoraMarco(HOJE)))
    // e não oferece mais salvar: o dia já tem saldo do banco salvo
    expect(screen.queryByRole("button", { name: SALVAR })).not.toBeInTheDocument()
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
    // o "Declarado" volta a "—" (o digitado de antes foi descartado)
    await screen.findByText("Calculado (app)")
    expect(linha("Declarado (você)")).toHaveTextContent("—")
    expect(linha("Declarado (você)")).not.toHaveTextContent(/100,00/)
  })

  it("regressão: campo do banco VAZIO não libera salvar nem aviso — clicar antes de digitar não grava o saldo inteiro como se fosse o do banco", async () => {
    getSaldoCalculado.mockResolvedValue(3944.2)
    await renderPage()
    await abrirDiaLivre()
    await screen.findByText("Calculado (app)")
    expect(screen.getByPlaceholderText("0,00")).toHaveValue("")
    // "—" em Declarado/Diferença: vazio não é zero
    expect(linha("Declarado (você)")).toHaveTextContent("—")
    expect(linha("Diferença")).toHaveTextContent("—")
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Lançar o que falta" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Confere/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Faltou|Sobrou/)).not.toBeInTheDocument()
    // a única ação existe, mas está travada — clicar não grava nada
    const salvar = screen.getByRole("button", { name: SALVAR })
    expect(salvar).toBeDisabled()
    fireEvent.click(salvar)
    expect(criarMarco).not.toHaveBeenCalled()
  })

  it("'Salvar saldo do banco' fica DESABILITADO com o campo vazio, habilita ao digitar e volta a travar se a pessoa apaga o valor", async () => {
    await renderPage()
    await abrirDiaLivre()
    expect(screen.getByRole("button", { name: SALVAR })).toBeDisabled()

    digitarSaldoReal("15000")
    expect(screen.getByRole("button", { name: SALVAR })).toBeEnabled()

    digitarSaldoReal("") // apagou o valor: de novo não há o que salvar
    expect(screen.getByPlaceholderText("0,00")).toHaveValue("")
    expect(screen.getByRole("button", { name: SALVAR })).toBeDisabled()
    expect(linha("Declarado (você)")).toHaveTextContent("—")
    expect(criarMarco).not.toHaveBeenCalled()
  })

  it("'0,00' DIGITADO de propósito (banco zerado) vale: habilita 'Salvar saldo do banco' e grava declarado 0 (tipo 2, sem resolucao)", async () => {
    getSaldoCalculado.mockResolvedValue(250)
    await renderPage()
    await abrirDiaLivre()
    digitarSaldoReal("0")
    expect(screen.getByPlaceholderText("0,00")).toHaveValue("0,00")
    expect(linha("Declarado (você)")).toHaveTextContent(/R\$\s?0,00/)
    expect(linha("Diferença")).toHaveTextContent(/-R\$\s?250,00/) // ao vivo, mesmo antes de salvar
    // diferença existe, mas ainda não é hora de aviso/ajuste: isso só depois de salvar
    expect(screen.queryByText(/Faltou/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: SALVAR }))
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))
    const [dto] = criarMarco.mock.calls[0]
    expect(dto).toMatchObject({ contaId: "c1", saldoDeclarado: 0, tipo: 2 })
    expect(dto).not.toHaveProperty("resolucao")
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
    expect(screen.queryByRole("button", { name: SALVAR })).not.toBeInTheDocument()
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
    expect(screen.queryByRole("button", { name: SALVAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
    expect(criarMarco).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------- 1º passo: conferir um dia (sem marco) e SALVAR o saldo do banco

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
    // e o botão do fluxo antigo ("Confere — gravar marco") não existe mais: agora é salvar
    expect(screen.queryByRole("button", { name: GRAVAR_ANTIGO })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: SALVAR })).toBeInTheDocument()
  })

  it("painel UNIFORME ao conferir: título → campo do banco → Calculado/Declarado/Diferença → 'Salvar saldo do banco' no rodapé, nessa ordem", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await abrirDiaLivre()
    digitarSaldoReal("15000") // mesmo diferente do app, o rodapé tem UMA ação só

    expectOrdem(
      screen.getByText("Conta a conferir"),
      screen.getByText(/^Conferir$/), // título
      screen.getByText(ROTULO_SALDO_BANCO),
      screen.getByPlaceholderText("0,00"),
      screen.getByText("Calculado (app)"),
      screen.getByText("Declarado (você)"),
      screen.getByText("Diferença"),
      screen.getByRole("button", { name: SALVAR }),
    )
    const acoes = within(rodapeAcoes()).getAllByRole("button")
    expect(acoes).toHaveLength(1)
    expect(acoes[0]).toHaveTextContent(SALVAR)
  })

  it("PASSO 1 não tem Ajustar: mesmo com o digitado diferente do app não há aviso Sobrou/Faltou nem 'Ajustar'/'Lançar o que falta' — só 'Salvar saldo do banco'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await abrirDiaLivre()
    digitarSaldoReal("15000") // 150,00 x calculado 100,00
    // a diferença aparece AO VIVO na linha (informativa)…
    expect(linha("Diferença")).toHaveTextContent(/\+R\$\s?50,00/)
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "false")
    // …mas nenhuma ação de resolver a diferença existe antes de salvar
    expect(screen.queryByText(/Sobrou|Faltou/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: LANCAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: GRAVAR_ANTIGO })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: CONFERE_ATUALIZAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Definir saldo inicial" })).not.toBeInTheDocument()
    expect(screen.queryByText(/1ª conferência da conta/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: SALVAR })).toBeEnabled()
    expect(criarMarco).not.toHaveBeenCalled()
    expect(fecharDiferenca).not.toHaveBeenCalled()
  })

  // --- bate

  it("conferir hoje: saldo do banco = calculado → 'Salvar saldo do banco' grava via criarMarco SEMPRE como verificação (tipo 2, mesmo na 1ª conferência da conta), sem resolucao", async () => {
    // depois de salvar a tela recarrega: o 2º listMarcos já traz o marco de hoje (e o recálculo ao vivo dele bate)
    const gravado = marco(HOJE, { id: "m-novo", saldoDeclarado: 100, saldoCalculado: 100 })
    listMarcos.mockReset().mockResolvedValueOnce([]).mockResolvedValue([gravado])
    getSaldoCalculado.mockResolvedValue(100)
    await renderPage({ manterMount: true })
    await screen.findByText(ROTULO_SALDO_BANCO)
    await screen.findByText("Calculado (app)")
    expect(screen.getByRole("button", { name: SALVAR })).toBeDisabled() // campo vazio

    digitarSaldoReal("10000") // 100,00
    expect(screen.getByText("Declarado (você)")).toBeInTheDocument()
    expect(screen.getByText("Diferença")).toBeInTheDocument()
    expect(linha("Calculado (app)")).toHaveTextContent(/R\$\s?100,00/)
    expect(linha("Declarado (você)")).toHaveTextContent(/R\$\s?100,00/)
    expect(linha("Diferença")).toHaveTextContent(/R\$\s?0,00/)
    expect(linha("Diferença")).not.toHaveTextContent(/[+-]R\$/)
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "true")
    // bateu: só o botão de salvar; nada de aviso de divergência nem das ações de divergência
    expect(screen.queryByText(/Sobrou|Faltou/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: LANCAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Definir saldo inicial" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: SALVAR })).toBeEnabled()

    fireEvent.click(screen.getByRole("button", { name: SALVAR }))
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))
    const [dto, idemKey] = criarMarco.mock.calls[0]
    // hoje grava com a hora atual; conta SEM marco também é tipo 2 (a regra "1º marco = baseline" acabou)
    expect(dto).toMatchObject({ contaId: "c1", dataHora: HOJE_CALCULO, tipo: 2 })
    expect(dto.saldoDeclarado).toBeCloseTo(100, 2)
    expect(dto).not.toHaveProperty("resolucao") // salvar nunca cria lançamento de ajuste
    expect(idemKey).toEqual(expect.any(String))
    expect(idemKey).not.toBe("")

    // sucesso: toast, recarrega os marcos e o painel passa a mostrar o marco gravado (hoje)
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: TOAST_BATE })))
    await waitFor(() => expect(listMarcos).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole("button", { name: "Remover" })).toBeInTheDocument()
    expect(screen.getByText(dataLabel(HOJE), { selector: "strong" })).toBeInTheDocument()
    expect(screen.getByText(ROTULO_SALDO_SALVO)).toBeInTheDocument()
    // bateu → o marco salvo não oferece Ajustar/Lançar/Confere
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: LANCAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: CONFERE_ATUALIZAR })).not.toBeInTheDocument()
  })

  it("bate numa conta COM marcos: 'Salvar saldo do banco' grava como verificação (tipo 2) no fim do dia escolhido, sem resolucao", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await abrirDiaLivre()

    digitarSaldoReal("10000") // 100,00 = calculado
    fireEvent.click(screen.getByRole("button", { name: SALVAR }))
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))
    const [dto] = criarMarco.mock.calls[0]
    expect(dto).toMatchObject({ contaId: "c1", dataHora: fimDoDia(DIA_LIVRE), tipo: 2 })
    expect(dto).not.toHaveProperty("resolucao")
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: TOAST_BATE })))
  })

  it("diferença abaixo de meio centavo ainda 'bate' (arredondamento não bloqueia o salvar e o toast é o de 'saldo bate')", async () => {
    getSaldoCalculado.mockResolvedValue(100.004)
    await renderPage({ manterMount: true })
    await screen.findByText("Calculado (app)")
    digitarSaldoReal("10000")
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "true")
    fireEvent.click(await screen.findByRole("button", { name: SALVAR }))
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: TOAST_BATE })))
  })

  // --- não bate: o 1º passo só SALVA; o resolver (Lançar / Ajustar) é do 2º passo, no marco salvo

  it("não bate em conta SEM marcos: salvar grava (tipo 2, sem resolucao, toast 'Saldo do banco salvo') e SÓ DEPOIS o marco oferece 'Lançar o que falta' / 'Ajustar', que chama fecharDiferenca", async () => {
    // o saldo do app ATÉ a data do marco: 100 antes do ajuste, 150 depois (o lançamento de ajuste entra na conta)
    let saldoDoMarco = 100
    getSaldoCalculado.mockImplementation(async (_c: string, dataHora: string) => (dataHora === dataHoraMarco(DIA_LIVRE) ? saldoDoMarco : 100))
    const gravado = marco(DIA_LIVRE, { id: "m-novo", saldoDeclarado: 150, saldoCalculado: 100, diferenca: 50 })
    const ajustado = { ...gravado, temAjuste: true }
    listMarcos.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([gravado]).mockResolvedValue([ajustado])
    fecharDiferenca.mockReset().mockImplementation(async () => { saldoDoMarco = 150; return ajustado })
    await renderPage()
    await abrirDiaLivre()

    // passo 1: digita 150,00 x calculado 100,00 → diferença ao vivo, mas SEM ajuste/lançar
    digitarSaldoReal("15000")
    expect(linha("Diferença")).toHaveTextContent(/\+R\$\s?50,00/) // diferença positiva com sinal
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "false")
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: LANCAR })).not.toBeInTheDocument()
    // baseline removido: não há botão de definir saldo inicial nem o aviso de "1ª conferência"
    expect(screen.queryByRole("button", { name: "Definir saldo inicial" })).not.toBeInTheDocument()
    expect(screen.queryByText(/1ª conferência da conta/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: SALVAR }))
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))
    const [dto] = criarMarco.mock.calls[0]
    expect(dto).toMatchObject({ contaId: "c1", dataHora: fimDoDia(DIA_LIVRE), tipo: 2 }) // sem marco anterior segue sendo tipo 2
    expect(dto.saldoDeclarado).toBeCloseTo(150, 2)
    expect(dto).not.toHaveProperty("resolucao")
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: TOAST_SALVO })))
    expect(notify).not.toHaveBeenCalledWith(expect.objectContaining({ message: TOAST_BATE })) // não bateu: não finge que bateu
    expect(fecharDiferenca).not.toHaveBeenCalled() // salvar NÃO ajusta

    // passo 2: o marco salvo (recarregado) agora oferece resolver a diferença
    expect(await screen.findByText(ROTULO_SALDO_SALVO)).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: AJUSTAR })).toBeInTheDocument()
    expect(linha("Diferença")).toHaveTextContent(/\+R\$\s?50,00/)
    expect(screen.queryByText(/Sobrou|Faltou/)).not.toBeInTheDocument() // sem cartão de aviso: a linha Diferença já diz
    expect(screen.getByRole("button", { name: LANCAR })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: SALVAR })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: AJUSTAR }))
    await waitFor(() => expect(fecharDiferenca).toHaveBeenCalledTimes(1))
    expect(fecharDiferenca).toHaveBeenCalledWith("m-novo", expect.any(String))
    expect(criarMarco).toHaveBeenCalledTimes(1) // ajustar NÃO recria o marco
    await waitFor(() => expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({ severity: "success", message: TOAST_AJUSTE })))

    // recarregou: o marco agora tem a linha "Ajuste lançado", a diferença de agora fechou e acabaram as ações de resolver
    await waitFor(() => expect(listMarcos).toHaveBeenCalledTimes(3))
    expect(await screen.findByText("Ajuste lançado")).toBeInTheDocument()
    await waitFor(() => expect(linha("Diferença")).toHaveTextContent(/R\$\s?0,00/))
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: LANCAR })).not.toBeInTheDocument()
  })

  it("não bate em conta COM marco: salvar também grava tipo 2 sem resolucao, e o marco salvo oferece 'Ajustar (cria lançamento)' → fecharDiferenca(id do marco novo)", async () => {
    const gravado = marco(DIA_LIVRE, { id: "m-novo", saldoDeclarado: 40, saldoCalculado: 100, diferenca: -60 })
    listMarcos.mockReset().mockResolvedValueOnce([marco(DIA_MARCO)]).mockResolvedValue([marco(DIA_MARCO), gravado])
    await renderPage()
    await abrirDiaLivre()

    digitarSaldoReal("4000") // 40,00 x 100,00
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument() // ainda não: falta salvar
    fireEvent.click(screen.getByRole("button", { name: SALVAR }))
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))
    const [dto] = criarMarco.mock.calls[0]
    expect(dto).toMatchObject({ contaId: "c1", tipo: 2 })
    expect(dto.saldoDeclarado).toBeCloseTo(40, 2)
    expect(dto).not.toHaveProperty("resolucao")
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: TOAST_SALVO })))

    const ajustar = await screen.findByRole("button", { name: AJUSTAR })
    expect(screen.getByRole("button", { name: LANCAR })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: SALVAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Definir saldo inicial" })).not.toBeInTheDocument()
    fireEvent.click(ajustar)
    await waitFor(() => expect(fecharDiferenca).toHaveBeenCalledWith("m-novo", expect.any(String)))
    expect(criarMarco).toHaveBeenCalledTimes(1)
  })

  it("diferença negativa ao digitar (declarou menos que o calculado): linha Diferença com sinal de menos AO VIVO, sem aviso e sem Ajustar", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await abrirDiaLivre()
    digitarSaldoReal("4000") // 40,00 x 100,00 → -60,00
    expect(linha("Diferença")).toHaveTextContent(/-R\$\s?60,00/)
    expect(linha("Diferença")).not.toHaveTextContent(/\+R\$/)
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "false")
    expect(screen.queryByText(/Faltou|Sobrou/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: SALVAR })).toBeEnabled()
  })

  it("a Diferença acompanha o digitado ao vivo (+50 → 0,00) e NUNCA aparece aviso Sobrou/Faltou durante a digitação", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await abrirDiaLivre()
    digitarSaldoReal("15000")
    expect(linha("Diferença")).toHaveTextContent(/\+R\$\s?50,00/)
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "false")
    expect(screen.queryByText(/Sobrou|Faltou/)).not.toBeInTheDocument()

    digitarSaldoReal("10000") // iguala o calculado
    expect(linha("Diferença")).toHaveTextContent(/R\$\s?0,00/)
    expect(linha("Diferença")).not.toHaveTextContent(/[+-]R\$/)
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "true")
    expect(screen.queryByText(/Sobrou|Faltou/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: SALVAR })).toBeEnabled()
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
  })

  // --- erro ao salvar

  it("erro ao salvar: toast de erro, painel segue aberto e o retry reusa a MESMA Idempotency-Key", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    criarMarco.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(marco(DIA_LIVRE))
    await renderPage()
    await abrirDiaLivre()
    digitarSaldoReal("10000")

    fireEvent.click(await screen.findByRole("button", { name: SALVAR }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error", message: "Erro ao salvar o saldo do banco" })))
    expect(notify).not.toHaveBeenCalledWith(expect.objectContaining({ message: "Erro ao gravar o marco" })) // mensagem antiga
    // painel continua aberto pra tentar de novo (nada foi perdido)
    expect(screen.getByText(ROTULO_SALDO_BANCO)).toBeInTheDocument()
    expect(screen.getByDisplayValue("100,00")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: SALVAR }))
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
    fireEvent.click(await screen.findByRole("button", { name: SALVAR }))
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))

    // dia B (outro dia sem marco): abrir gera chave nova, mesmo sem reabrir "hoje" depois de gravar
    const DIA_B = DIA_LIVRE + 1
    clicarDia(DIA_B)
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenLastCalledWith("c1", fimDoDia(DIA_B)))
    digitarSaldoReal("10000")
    fireEvent.click(await screen.findByRole("button", { name: SALVAR }))
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(2))

    expect(criarMarco.mock.calls[0][0].dataHora).toBe(fimDoDia(DIA_LIVRE))
    expect(criarMarco.mock.calls[1][0].dataHora).toBe(fimDoDia(DIA_B))
    expect(criarMarco.mock.calls[0][1]).toEqual(expect.any(String))
    expect(criarMarco.mock.calls[1][1]).toEqual(expect.any(String))
    expect(criarMarco.mock.calls[1][1]).not.toBe(criarMarco.mock.calls[0][1])
  })

  // ---------------------------------------------------------------- 2º passo: marco salvo com diferença (recálculo ao vivo)

  it("marco salvo: recalcula o saldo do app AO VIVO até a dataHora do marco e a diferença mostrada é declarado − calculadoAgora (não a gravada)", async () => {
    // gravado quando batia (diferenca 0), mas hoje o app calcula 480 até aquela data → sobrou 20
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { saldoDeclarado: 500, saldoCalculado: 500, diferenca: 0 })])
    calculoAoVivoDoMarco(DIA_MARCO, 480)
    await renderPage()
    await abrirMarcoSalvo(DIA_MARCO)

    expect(getSaldoCalculado).toHaveBeenCalledWith("c1", dataHoraMarco(DIA_MARCO))
    expect(linha("Calculado (app)")).toHaveTextContent(/R\$\s?480,00/) // o de agora, não o 500 gravado
    expect(linha("Declarado (você)")).toHaveTextContent(/R\$\s?500,00/)
    expect(linha("Diferença")).toHaveTextContent(/\+R\$\s?20,00/)
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "false")
    // diferença de agora ≠ 0 → pendente: Diferença em vermelho (sem cartão de aviso) + as duas ações
    expect(screen.queryByText(/Sobrou|Faltou/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: LANCAR })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: AJUSTAR })).toBeInTheDocument()
    // o calendário segue pintando pelo que foi GRAVADO (diferenca 0 → conferido)
    expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu")
  })

  it("marco pendente (salvo, sem ajuste, ainda com diferença) mostra a Diferença em vermelho (sem cartão de aviso) + 'Lançar o que falta' + 'Ajustar (cria lançamento)' e esconde 'Salvar'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { saldoDeclarado: 150, saldoCalculado: 100, diferenca: 50 })])
    calculoAoVivoDoMarco(DIA_MARCO, 100)
    await renderPage()
    await abrirMarcoSalvo(DIA_MARCO)

    expect(screen.getByText(ROTULO_SALDO_SALVO)).toBeInTheDocument()
    expect(screen.queryByText(/Sobrou|Faltou/)).not.toBeInTheDocument() // sem cartão de aviso
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "false")
    expect(linha("Diferença")).toHaveTextContent(/\+R\$\s?50,00/)
    expect(screen.getByRole("button", { name: LANCAR })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: AJUSTAR })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: CONFERE_ATUALIZAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: SALVAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: GRAVAR_ANTIGO })).not.toBeInTheDocument()
    // as ações de resolver vêm ANTES de Alterar/Remover no rodapé
    expectOrdem(screen.getByRole("button", { name: LANCAR }), screen.getByRole("button", { name: AJUSTAR }), screen.getByRole("button", { name: "Alterar valor" }), screen.getByRole("button", { name: "Remover" }))
  })

  it("marco salvo com declarado MENOR que o app: sem cartão de aviso; a linha Diferença (vermelha) leva o sinal de menos", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { saldoDeclarado: 40, saldoCalculado: 100, diferenca: -60 })])
    calculoAoVivoDoMarco(DIA_MARCO, 100)
    await renderPage()
    await abrirMarcoSalvo(DIA_MARCO)

    expect(screen.queryByText(/Sobrou|Faltou/)).not.toBeInTheDocument()
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "false")
    expect(linha("Diferença")).toHaveTextContent(/-R\$\s?60,00/)
    expect(linha("Diferença")).not.toHaveTextContent(/\+R\$/)
    expect(screen.getByRole("button", { name: AJUSTAR })).toBeInTheDocument() // negativa também cai em Ajustar
  })

  it("'Lançar o que falta' (marco pendente) navega pra /transactions sem chamar API nenhuma", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { saldoDeclarado: 150, saldoCalculado: 100, diferenca: 50 })])
    calculoAoVivoDoMarco(DIA_MARCO, 100)
    await renderPage()
    await abrirMarcoSalvo(DIA_MARCO)
    fireEvent.click(screen.getByRole("button", { name: LANCAR }))
    expect(navigateSpy).toHaveBeenCalledWith("/transactions")
    expect(criarMarco).not.toHaveBeenCalled()
    expect(fecharDiferenca).not.toHaveBeenCalled()
    expect(removerMarco).not.toHaveBeenCalled()
  })

  it("'Ajustar (cria lançamento)' chama fecharDiferenca(marco.id, Idempotency-Key), avisa 'Ajuste lançado — saldo bate ✓' e recarrega — sem recriar o marco", async () => {
    const pendente = marco(DIA_MARCO, { saldoDeclarado: 150, saldoCalculado: 100, diferenca: 50 })
    const ajustado = { ...pendente, temAjuste: true }
    listMarcos.mockReset().mockResolvedValueOnce([pendente]).mockResolvedValue([ajustado])
    fecharDiferenca.mockReset().mockResolvedValue(ajustado)
    calculoAoVivoDoMarco(DIA_MARCO, 100)
    await renderPage()
    await abrirMarcoSalvo(DIA_MARCO)
    expect(fecharDiferenca).not.toHaveBeenCalled() // só abrir não ajusta

    fireEvent.click(screen.getByRole("button", { name: AJUSTAR }))
    await waitFor(() => expect(fecharDiferenca).toHaveBeenCalledTimes(1))
    const [id, key] = fecharDiferenca.mock.calls[0]
    expect(id).toBe(`m-${DIA_MARCO}`)
    expect(key).toEqual(expect.any(String))
    expect(key).not.toBe("")
    expect(criarMarco).not.toHaveBeenCalled()
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: TOAST_AJUSTE })))
    await waitFor(() => expect(listMarcos).toHaveBeenCalledTimes(2)) // recarregou

    // depois do ajuste: a linha "Ajuste lançado" aparece e as ações de resolver somem
    expect(await screen.findByText("Ajuste lançado")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument())
    expect(screen.queryByRole("button", { name: LANCAR })).not.toBeInTheDocument()
    expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "ajuste")
  })

  it("fecharDiferenca que devolve o marco SEM ajuste (já passou a bater no servidor) avisa só 'Conferido — saldo bate ✓'", async () => {
    const pendente = marco(DIA_MARCO, { saldoDeclarado: 150, saldoCalculado: 100, diferenca: 50 })
    fecharDiferenca.mockReset().mockResolvedValue({ ...pendente, diferenca: 0, saldoCalculado: 150, temAjuste: false })
    listMarcos.mockResolvedValue([pendente])
    calculoAoVivoDoMarco(DIA_MARCO, 100)
    await renderPage()
    await abrirMarcoSalvo(DIA_MARCO)

    fireEvent.click(screen.getByRole("button", { name: AJUSTAR }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: TOAST_BATE })))
    expect(notify).not.toHaveBeenCalledWith(expect.objectContaining({ message: TOAST_AJUSTE }))
  })

  it("erro ao ajustar: toast 'Erro ao ajustar o marco', as ações continuam na tela, nada recarrega e o retry reusa a MESMA Idempotency-Key", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { saldoDeclarado: 150, saldoCalculado: 100, diferenca: 50 })])
    fecharDiferenca.mockReset().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(marco(DIA_MARCO, { temAjuste: true }))
    calculoAoVivoDoMarco(DIA_MARCO, 100)
    await renderPage()
    await abrirMarcoSalvo(DIA_MARCO)

    fireEvent.click(screen.getByRole("button", { name: AJUSTAR }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error", message: "Erro ao ajustar o marco" })))
    expect(screen.getByRole("button", { name: AJUSTAR })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: LANCAR })).toBeInTheDocument()
    expect(listMarcos).toHaveBeenCalledTimes(1) // sem sucesso, sem recarregar
    expect(notify).not.toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))

    fireEvent.click(screen.getByRole("button", { name: AJUSTAR }))
    await waitFor(() => expect(fecharDiferenca).toHaveBeenCalledTimes(2))
    expect(fecharDiferenca.mock.calls[1][1]).toBe(fecharDiferenca.mock.calls[0][1]) // mesma operação → mesma chave
    await waitFor(() => expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({ severity: "success", message: TOAST_AJUSTE })))
  })

  it("'Confere — atualizar marco': gravado com diferença, mas a pessoa já lançou o que faltava (agora bate) → sem aviso, sem Lançar/Ajustar, e o botão chama fecharDiferenca", async () => {
    const gravado = marco(DIA_MARCO, { saldoDeclarado: 150, saldoCalculado: 100, diferenca: 50 })
    const atualizado = { ...gravado, saldoCalculado: 150, diferenca: 0, temAjuste: false }
    listMarcos.mockReset().mockResolvedValueOnce([gravado]).mockResolvedValue([atualizado])
    fecharDiferenca.mockReset().mockResolvedValue(atualizado)
    calculoAoVivoDoMarco(DIA_MARCO, 150) // o lançamento que faltava já está na conta
    await renderPage()
    await abrirMarcoSalvo(DIA_MARCO)

    // o calendário ainda mostra o que está GRAVADO (com diferença) até confirmar
    expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "diferenca")
    expect(linha("Calculado (app)")).toHaveTextContent(/R\$\s?150,00/) // o de agora
    expect(linha("Diferença")).toHaveTextContent(/R\$\s?0,00/)
    expect(linha("Diferença")).not.toHaveTextContent(/[+-]R\$/)
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "true")
    expect(screen.queryByText(/Sobrou|Faltou/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: LANCAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: SALVAR })).not.toBeInTheDocument()
    const confere = screen.getByRole("button", { name: CONFERE_ATUALIZAR })

    fireEvent.click(confere)
    await waitFor(() => expect(fecharDiferenca).toHaveBeenCalledWith(`m-${DIA_MARCO}`, expect.any(String)))
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: TOAST_BATE })))
    await waitFor(() => expect(listMarcos).toHaveBeenCalledTimes(2))
    // atualizado: o botão some e o calendário passa a "conferido"
    await waitFor(() => expect(screen.queryByRole("button", { name: CONFERE_ATUALIZAR })).not.toBeInTheDocument())
    expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu")
  })

  it("marco que bate (gravado 0 e agora 0): sem aviso e sem Ajustar/Lançar/Confere — só Alterar valor e Remover", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    calculoAoVivoDoMarco(DIA_MARCO, 500)
    await renderPage()
    await abrirMarcoSalvo(DIA_MARCO)
    expect(screen.queryByText(/Sobrou|Faltou/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: LANCAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: CONFERE_ATUALIZAR })).not.toBeInTheDocument()
    const acoes = within(rodapeAcoes()).getAllByRole("button").map((b) => b.textContent)
    expect(acoes).toEqual(["Alterar valor", "Remover"])
  })

  it("se o recálculo ao vivo FALHA, o marco cai no calculado gravado (sem toast de erro) e a diferença segue a gravada", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { saldoDeclarado: 150, saldoCalculado: 100, diferenca: 50 })])
    getSaldoCalculado.mockImplementation(async (_c: string, dataHora: string) => {
      if (dataHora === dataHoraMarco(DIA_MARCO)) throw new Error("boom")
      return 100
    })
    await renderPage()
    await abrirMarcoSalvo(DIA_MARCO)
    expect(linha("Calculado (app)")).toHaveTextContent(/R\$\s?100,00/) // o gravado
    expect(linha("Diferença")).toHaveTextContent(/\+R\$\s?50,00/)
    expect(screen.queryByText(/Sobrou|Faltou/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: AJUSTAR })).toBeInTheDocument()
    expect(notify).not.toHaveBeenCalledWith(expect.objectContaining({ severity: "error" }))
  })

  // ---------------------------------------------------------------- movimentos (PontesTabela full-width)

  it("movimentos = PontesTabela com Data/Hora / Lançamento / Valor: hora aparece como 'dd/mm HH:MM' e, sem hora (null), só 'dd/mm'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    listTransactionsPage.mockResolvedValue({
      items: [tx("t1", "Mercado", 50, 1, 16), tx("t2", "Salário", 1000, 2, 18, null)],
      total: 2,
    })
    await renderPage()
    expect(await tituloMov(`Movimentos desde ${diaMes(DIA_MARCO)} até ${diaMes(HOJE)}`)).toBeInTheDocument()
    const tabela = await screen.findByRole("table")
    expect(within(tabela).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Data/Hora", "Lançamento", "Valor"])

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

  it("'Mostrar mais': busca o PRÓXIMO lote no servidor com o mesmo filtro, acumula na lista e some quando não falta nada", async () => {
    const lote1 = Array.from({ length: 20 }, (_, i) => tx(`a${i}`, `Lote1 ${i}`, 10, 1, 3))
    const lote2 = Array.from({ length: 5 }, (_, i) => tx(`b${i}`, `Lote2 ${i}`, 10, 1, 2))
    listTransactionsPage.mockImplementation((page: number) =>
      Promise.resolve(page === 1 ? { items: lote1, total: 25 } : { items: lote2, total: 25 }))
    await renderPage()
    const botao = await screen.findByRole("button", { name: /Mostrar mais/ })
    expect(botao).toHaveTextContent("faltam 5")
    expect(screen.queryByText("Lote2 0")).not.toBeInTheDocument()
    const filtro = listTransactionsPage.mock.calls.at(-1)![2]

    fireEvent.click(botao)

    expect(await screen.findByText("Lote2 4")).toBeInTheDocument()
    expect(screen.getByText("Lote1 0")).toBeInTheDocument() // acumula, não troca
    expect(listTransactionsPage).toHaveBeenLastCalledWith(2, 20, filtro)
    expect(screen.queryByRole("button", { name: /Mostrar mais/ })).not.toBeInTheDocument()
  })

  it("'Mostrar mais' que falha: toast de erro e a lista que já estava fica", async () => {
    const lote1 = Array.from({ length: 20 }, (_, i) => tx(`a${i}`, `Lote1 ${i}`, 10, 1, 3))
    listTransactionsPage.mockImplementation((page: number) =>
      page === 1 ? Promise.resolve({ items: lote1, total: 30 }) : Promise.reject(new Error("boom")))
    await renderPage()
    fireEvent.click(await screen.findByRole("button", { name: /Mostrar mais/ }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: "Não deu pra carregar mais movimentos", severity: "error" })))
    expect(screen.getByText("Lote1 19")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Mostrar mais/ })).toBeEnabled() // dá pra tentar de novo
  })

  it("busca os movimentos da conta, do marco anterior ao dia até o dia seguinte ao selecionado, só caixa (lote de 20 — o resto no 'Mostrar mais')", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 20, {
      contaId: "c1", from: isoDia(DIA_MARCO), to: isoDia(HOJE + 1), apenasCaixa: true,
    }))
  })

  it("selecionar outro dia refaz a busca até o dia seguinte a ele (e vira o mês: 30/06 → 01/07)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    clicarDia(17)
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({ from: isoDia(DIA_MARCO), to: isoDia(18) })))
    clicarDia(30)
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({ from: isoDia(DIA_MARCO), to: `${ANO}-07-01` })))
  })

  it("o 'desde' é o marco ANTERIOR ao dia selecionado, não o último marco global (marcos nos dias 5 e 15)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO), marco(5, { tipo: 1 })])
    listTransactionsPage.mockResolvedValue({ items: [tx("t1", "Mercado", 50, 1, 8)], total: 1 })
    await renderPage()
    // dia 10: o marco anterior é o do dia 5 (o do dia 15 ainda não existia)
    clicarDia(DIA_LIVRE)
    expect(await tituloMov(`Movimentos desde ${diaMes(5)} até ${diaMes(DIA_LIVRE)}`)).toBeInTheDocument()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({ from: isoDia(5), to: isoDia(DIA_LIVRE + 1) })))
    // dia 20 (hoje): o anterior é o do dia 15
    clicarDia(HOJE)
    expect(await tituloMov(`Movimentos desde ${diaMes(DIA_MARCO)} até ${diaMes(HOJE)}`)).toBeInTheDocument()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({ from: isoDia(DIA_MARCO), to: isoDia(HOJE + 1) })))
  })

  it("dia ANTERIOR a todos os marcos: busca sem limite inferior e o título é 'Movimentos desde o começo até dd/mm'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    listTransactionsPage.mockResolvedValue({ items: [tx("t1", "Mercado", 50, 1, 3)], total: 1 })
    await renderPage()
    expect(await tituloMov(`Movimentos desde ${diaMes(DIA_MARCO)} até ${diaMes(HOJE)}`)).toBeInTheDocument() // hoje

    clicarDia(DIA_LIVRE) // 10 < marco do dia 15: não há marco anterior
    await screen.findByText(ROTULO_SALDO_BANCO)
    expect(await tituloMov(`Movimentos desde o começo até ${diaMes(DIA_LIVRE)}`)).toBeInTheDocument()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({ from: undefined, to: isoDia(DIA_LIVRE + 1) })))
    expect(await screen.findByText("Mercado")).toBeInTheDocument()
  })

  it("sem nenhum marco: título 'Movimentos desde o começo até hoje' e a busca não tem limite inferior", async () => {
    listTransactionsPage.mockResolvedValue({ items: [tx("t1", "Compra", 20, 1, 3)], total: 1 })
    await renderPage()
    expect(await tituloMov(`Movimentos desde o começo até ${diaMes(HOJE)}`)).toBeInTheDocument()
    expect(await screen.findByText("Compra")).toBeInTheDocument()
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({ from: undefined, to: isoDia(HOJE + 1) })))
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
    await waitFor(() => expect(listTransactionsPage).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({ from: isoDia(5), to: isoDia(DIA_MARCO + 1) })))
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

  it("clicar num dia COM marco com ajuste mostra o marco (calculado/declarado/'Ajuste lançado'/diferença) no lugar do campo de conferir, com 'Alterar valor' e 'Remover'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { saldoCalculado: 480, saldoDeclarado: 500, diferenca: 20, temAjuste: true })])
    calculoAoVivoDoMarco(DIA_MARCO, 500) // com o lançamento de ajuste na conta, o app agora calcula o declarado
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "ajuste"))
    await abrirMarcoSalvo(DIA_MARCO)

    expect(screen.getByText(dataLabel(DIA_MARCO), { selector: "strong" })).toBeInTheDocument() // "Marco de DD/MM/YYYY"
    // com ajuste, o "Calculado" é o gravado no marco (o de ANTES do ajuste), não o recálculo ao vivo
    expect(linha("Calculado (app)")).toHaveTextContent(/R\$\s?480,00/)
    expect(linha("Declarado (você)")).toHaveTextContent(/R\$\s?500,00/)
    // a ponte entre os dois é uma linha da conta, sem sinal +/− (a cor diz a direção)
    expect(linha("Ajuste lançado")).toHaveTextContent(/^Ajuste lançado\s?R\$\s?20,00$/)
    expect(linha("Ajuste lançado").textContent).not.toMatch(/[+−-]/)
    expect(within(linha("Ajuste lançado")).getByText(/R\$\s?20,00/).className).toMatch(/ajusteEntrada/)
    // e a Diferença de agora fechou (declarado − calculado ao vivo = 0)
    expect(linha("Diferença")).toHaveTextContent(/R\$\s?0,00/)
    expect(linha("Diferença")).not.toHaveTextContent(/[+-]R\$/)
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "true")
    // a etiqueta amarela antiga não existe mais
    expect(screen.queryByText("lançamento de ajuste criado")).not.toBeInTheDocument()
    // marco com ajuste já resolvido: nada de Ajustar/Lançar/Confere
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: LANCAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: CONFERE_ATUALIZAR })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remover" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Alterar valor" })).toBeInTheDocument()
    // o marco gravado é mostrado como foi gravado: o campo vira "Saldo do banco", desabilitado, com o valor declarado
    expect(screen.queryByText(ROTULO_SALDO_BANCO)).not.toBeInTheDocument()
    expect(screen.queryByText("Saldo conferido")).not.toBeInTheDocument() // rótulo antigo
    expect(screen.getByText(ROTULO_SALDO_SALVO)).toBeInTheDocument()
    const campo = screen.getByPlaceholderText("0,00")
    expect(campo).toBeDisabled()
    expect(campo).toHaveValue("500,00")
  })

  it("ajuste de SAÍDA (calculado 520 → declarado 500): a linha 'Ajuste lançado' mostra o valor sem sinal, na cor de saída", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { saldoCalculado: 520, saldoDeclarado: 500, diferenca: -20, temAjuste: true })])
    calculoAoVivoDoMarco(DIA_MARCO, 500)
    await renderPage()
    await abrirMarcoSalvo(DIA_MARCO)
    expect(linha("Calculado (app)")).toHaveTextContent(/R\$\s?520,00/)
    expect(linha("Ajuste lançado")).toHaveTextContent(/^Ajuste lançado\s?R\$\s?20,00$/) // |−20|, sem o "−"
    expect(within(linha("Ajuste lançado")).getByText(/R\$\s?20,00/).className).toMatch(/ajusteSaida/)
    expect(within(linha("Ajuste lançado")).getByText(/R\$\s?20,00/).className).not.toMatch(/ajusteEntrada/)
  })

  it("'Ajuste lançado' fica ENTRE 'Declarado (você)' e 'Diferença' (a ponte da conta: app → declarado → ajuste → diferença)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { saldoCalculado: 480, saldoDeclarado: 500, diferenca: 20, temAjuste: true })])
    calculoAoVivoDoMarco(DIA_MARCO, 500)
    await renderPage()
    await abrirMarcoSalvo(DIA_MARCO)
    expectOrdem(
      screen.getByText("Calculado (app)"),
      screen.getByText("Declarado (você)"),
      screen.getByText("Ajuste lançado"),
      screen.getByText("Diferença"),
    )
  })

  it("painel UNIFORME num marco: mesmo esqueleto do conferir (título → campo → 3 linhas → ações no rodapé)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    calculoAoVivoDoMarco(DIA_MARCO, 500) // bate
    await renderPage()
    await abrirMarcoSalvo(DIA_MARCO)

    expectOrdem(
      screen.getByText("Conta a conferir"),
      screen.getByText(/^Marco de$/),
      screen.getByText(ROTULO_SALDO_SALVO),
      screen.getByPlaceholderText("0,00"),
      screen.getByText("Calculado (app)"),
      screen.getByText("Declarado (você)"),
      screen.getByText("Diferença"),
      screen.getByRole("button", { name: "Alterar valor" }),
      screen.getByRole("button", { name: "Remover" }),
    )
    expect(screen.getByText("Calculado (app)").closest("[data-bate]")).toHaveAttribute("data-bate", "true")
  })

  it("marco sem ajuste não mostra a linha 'Ajuste lançado' nem a etiqueta antiga (e marco comum não é 'ponto de partida')", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    calculoAoVivoDoMarco(DIA_MARCO, 500)
    await renderPage()
    await abrirMarcoSalvo(DIA_MARCO)
    expect(screen.queryByText("Ajuste lançado")).not.toBeInTheDocument()
    expect(screen.queryByText("lançamento de ajuste criado")).not.toBeInTheDocument()
    expect(screen.queryByText("Ponto de partida da conta.")).not.toBeInTheDocument()
  })

  it("'Alterar valor' e 'Remover' ficam LADO A LADO no mesmo wrapper (footerPar), nessa ordem", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    calculoAoVivoDoMarco(DIA_MARCO, 500)
    await renderPage()
    await abrirMarcoSalvo(DIA_MARCO)
    const alterar = screen.getByRole("button", { name: "Alterar valor" })
    const remover = screen.getByRole("button", { name: "Remover" })
    expect(alterar.parentElement).toBe(remover.parentElement)
    expect(alterar.parentElement!.className).toMatch(/footerPar/)
    expectOrdem(alterar, remover)
    expect(within(alterar.parentElement as HTMLElement).getAllByRole("button")).toHaveLength(2)
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

  it("marco DERIVADO não entra no fluxo de ajuste: sem recálculo ao vivo e sem Ajustar/Lançar/Confere, mesmo com diferenca gravada ≠ 0", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { tipo: 1, derivado: true, saldoDeclarado: 300, saldoCalculado: 250, diferenca: 50 })])
    await renderPage()
    await waitFor(() => expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "inicial")) // inicial ganha de 'com diferença'
    clicarDia(DIA_MARCO)
    expect(await screen.findByText("Ponto de partida da conta.")).toBeInTheDocument()
    await act(async () => {})
    // mostra os valores GRAVADOS (não recalcula)
    expect(getSaldoCalculado).not.toHaveBeenCalledWith("c1", dataHoraMarco(DIA_MARCO))
    expect(linha("Calculado (app)")).toHaveTextContent(/R\$\s?250,00/)
    expect(linha("Declarado (você)")).toHaveTextContent(/R\$\s?300,00/)
    expect(linha("Diferença")).toHaveTextContent(/\+R\$\s?50,00/)
    // e nenhuma ação de resolver diferença
    expect(screen.queryByText(/Sobrou|Faltou/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: LANCAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: CONFERE_ATUALIZAR })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: SALVAR })).not.toBeInTheDocument()
    expect(screen.getByText(ROTULO_SALDO_SALVO)).toBeInTheDocument()
    expect(fecharDiferenca).not.toHaveBeenCalled()
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
    calculoAoVivoDoMarco(DIA_MARCO, 500) // marco que bate: só Alterar/Remover no rodapé
    await renderPage()
    await abrirMarcoSalvo(DIA_MARCO)
    getSaldoCalculado.mockClear() // daqui pra frente só interessa o que o 'Alterar valor' dispara
    fireEvent.click(screen.getByRole("button", { name: "Alterar valor" }))

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
    // reabriu o conferir NAQUELE dia: recalcula o saldo do app até o fim do dia (a recontagem ao vivo do marco
    // removido, se ainda disparar, é descartada e não vaza pra tela)
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalledWith("c1", fimDoDia(DIA_MARCO)))
    expect(await screen.findByText("Calculado (app)")).toBeInTheDocument()
    expect(linha("Declarado (você)")).toHaveTextContent("—")
    expect(screen.getByRole("button", { name: SALVAR })).toBeDisabled()
    expect(screen.queryByRole("button", { name: AJUSTAR })).not.toBeInTheDocument()
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
