import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import ReconciliacaoPage from "../../pages/Reconciliacao/ReconciliacaoPage"
import type { Conta } from "../../types/Conta"
import type { ReconciliacaoMarco } from "../../types/Reconciliacao"

// Tela nova /reconciliacao: calendário de marcos + painel de conferir (declarado x calculado).
// Cobre: hero (saldo + "Confere até"), abertura JÁ conferindo HOJE (mount e troca de conta), clique em dia
// sem marco (calcula + abre painel), os 3 desfechos (bate = Gravar marco / baseline = Definir saldo inicial /
// verificação = Ajustar + Lançar o que falta), marco existente (mostra + remover com confirmação), marco
// derivado (saldo inicial da conta: sem remover), troca de conta, navegação de mês (limpa a seleção) e os erros.
const { notify, navigateSpy, getContas, listMarcos, getSaldoCalculado, criarMarco, removerMarco } = vi.hoisted(() => ({
  notify: vi.fn(),
  navigateSpy: vi.fn(),
  getContas: vi.fn(),
  listMarcos: vi.fn(),
  getSaldoCalculado: vi.fn(),
  criarMarco: vi.fn(),
  removerMarco: vi.fn(),
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

// --- Datas: a tela abre no mês corrente (data real), então os marcos são semeados nesse mês. ---
const agora = new Date()
const ANO = agora.getFullYear()
const MES = agora.getMonth() // 0-based
const pad2 = (n: number) => String(n).padStart(2, "0")
const DIA_MARCO = 15
// Dia "livre" (sem marco) que nunca é hoje — hoje usa a hora atual, os outros "23:59" (fixo, assertável).
const DIA_LIVRE = agora.getDate() === 10 ? 11 : 10
const isoDia = (dia: number) => `${ANO}-${pad2(MES + 1)}-${pad2(dia)}`
const dataLabel = (dia: number) => `${pad2(dia)}/${pad2(MES + 1)}/${ANO}`
const dataHoraLabel = (dia: number, hhmm = "14:30") => `${dataLabel(dia)} ${hhmm}`
// Hoje: a tela abre já selecionando o dia de hoje e calcula o saldo "até agora" (hora atual, não "23:59").
const HOJE = agora.getDate()
const HOJE_CALCULO = expect.stringMatching(new RegExp(`^${isoDia(HOJE)}T\\d{2}:\\d{2}:00\\.000Z$`))

const contaA = { id: "c1", nome: "Conta Corrente", saldoAtual: 1234.56 } as unknown as Conta
const contaB = { id: "c2", nome: "Poupança", saldoAtual: 99 } as unknown as Conta
const SALDO_A = /R\$\s?1\.234,56/

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

// O dia é um <button> cujo nome começa com o número (marco acrescenta o saldo colado: "15R$ 500,00" no
// jsdom, que não aplica o CSS de bloco). `(?!\d)` impede "1" de casar com "15".
const botaoDia = (n: number) => screen.getByRole("button", { name: new RegExp(`^${n}(?!\\d)`) })
const clicarDia = (n: number) => fireEvent.click(botaoDia(n))
// Digita em centavos no PontesMoneyInput ("10000" -> "100,00").
const digitarSaldoReal = (centavos: string) =>
  fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: centavos } })

describe("ReconciliacaoPage", () => {
  beforeEach(() => {
    notify.mockReset()
    navigateSpy.mockReset()
    getContas.mockReset().mockResolvedValue([contaA, contaB])
    listMarcos.mockReset().mockResolvedValue([])
    getSaldoCalculado.mockReset().mockResolvedValue(100)
    criarMarco.mockReset().mockResolvedValue(marco(DIA_LIVRE))
    removerMarco.mockReset().mockResolvedValue(undefined)
  })

  // ---------------------------------------------------------------- hero

  it("hero mostra o saldo da 1ª conta e 'nenhuma conferência ainda' quando não há marcos", async () => {
    await renderPage()
    expect(screen.getByText("Saldo em conta")).toBeInTheDocument()
    expect(screen.getByText(SALDO_A)).toBeInTheDocument()
    expect(screen.queryByText(/R\$\s?99,00/)).not.toBeInTheDocument() // saldo da 2ª conta não aparece
    expect(screen.getByText("Conta Corrente")).toBeInTheDocument() // seletor já vem na 1ª conta
    expect(screen.getByText("Confere até")).toBeInTheDocument()
    expect(screen.getByText("nenhuma conferência ainda")).toBeInTheDocument()
    expect(listMarcos).toHaveBeenCalledWith("c1")
  })

  it("'Confere até' mostra a data/hora do marco mais recente (o 1º da lista)", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO), marco(5, { tipo: 1 })]) // backend devolve mais recente primeiro
    await renderPage()
    expect(await screen.findByText(dataHoraLabel(DIA_MARCO))).toBeInTheDocument()
    expect(screen.queryByText("nenhuma conferência ainda")).not.toBeInTheDocument()
    expect(screen.queryByText(dataHoraLabel(5))).not.toBeInTheDocument()
  })

  it("sem nenhuma conta: não consulta marcos e mostra saldo zerado", async () => {
    getContas.mockResolvedValue([])
    render(<PontesThemeProvider><ReconciliacaoPage /></PontesThemeProvider>)
    await waitFor(() => expect(getContas).toHaveBeenCalled())
    await act(async () => {})
    expect(screen.getByText(/R\$\s?0,00/)).toBeInTheDocument()
    expect(listMarcos).not.toHaveBeenCalled()
    // sem conta não há o que conferir: nada de cálculo de hoje, painel pede pra escolher um dia
    expect(getSaldoCalculado).not.toHaveBeenCalled()
    expect(screen.getByText(/Escolha um dia no calendário/)).toBeInTheDocument()
  })

  it("trocar a conta no seletor recarrega os marcos, mostra o saldo dela e volta a conferir HOJE na nova conta", async () => {
    await renderPage()
    fireEvent.click(screen.getByRole("button", { name: "Conta Corrente" }))
    fireEvent.click(await screen.findByRole("button", { name: "Poupança" }))
    await waitFor(() => expect(listMarcos).toHaveBeenLastCalledWith("c2"))
    expect(await screen.findByText(/R\$\s?99,00/)).toBeInTheDocument()
    expect(screen.queryByText(SALDO_A)).not.toBeInTheDocument()
    // painel reabre em "Conferir <hoje>" já calculando o saldo da NOVA conta
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenLastCalledWith("c2", HOJE_CALCULO))
    expect(await screen.findByText(dataLabel(HOJE))).toBeInTheDocument()
    expect(screen.getByText("Saldo real da conta")).toBeInTheDocument()
  })

  // ---------------------------------------------------------------- calendário

  it("marca no calendário cada tipo de marco (inicial / conferido / ajuste) e mostra o saldo declarado", async () => {
    listMarcos.mockResolvedValue([
      marco(20, { temAjuste: true, diferenca: 10, saldoDeclarado: 510 }),
      marco(DIA_MARCO),
      marco(5, { tipo: 1, saldoDeclarado: 300 }),
    ])
    await renderPage()
    await screen.findByText(dataHoraLabel(20))
    expect(botaoDia(5)).toHaveAttribute("data-marco", "inicial")
    expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu")
    expect(botaoDia(20)).toHaveAttribute("data-marco", "ajuste")
    expect(botaoDia(DIA_LIVRE)).not.toHaveAttribute("data-marco")
    expect(within(botaoDia(DIA_MARCO)).getByText(/R\$\s?500,00/)).toBeInTheDocument()
  })

  it("dias depois do último marco até hoje ficam 'a conferir' (marco do mês passado → dia 1 pendente)", async () => {
    listMarcos.mockResolvedValue([marco(15, {}, -1)])
    await renderPage()
    await screen.findByText(/^\d{2}\/\d{2}\/\d{4} 14:30$/)
    expect(botaoDia(1)).toHaveAttribute("data-pendente", "true")
  })

  it("navegar de mês esconde os marcos do mês corrente e volta a mostrá-los", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await screen.findByText(dataHoraLabel(DIA_MARCO))
    expect(within(botaoDia(DIA_MARCO)).getByText(/R\$\s?500,00/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }))
    expect(botaoDia(DIA_MARCO)).not.toHaveAttribute("data-marco")
    expect(screen.queryByText(/R\$\s?500,00/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }))
    expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "bateu")
  })

  // ---------------------------------------------------------------- conferir um dia (sem marco)

  it("ao abrir, a tela já seleciona HOJE: painel 'Conferir <hoje>' com o saldo real e o cálculo até agora", async () => {
    await renderPage({ manterMount: true })
    // não nasce vazio
    expect(screen.queryByText(/Escolha um dia no calendário/)).not.toBeInTheDocument()
    expect(screen.getByText(dataLabel(HOJE))).toBeInTheDocument() // "Conferir DD/MM/YYYY" (hoje)
    expect(screen.getByText("Saldo real da conta")).toBeInTheDocument()
    // calcula o saldo de hoje com a hora atual (não o "23:59" dos outros dias), 1x, da conta selecionada
    expect(getSaldoCalculado).toHaveBeenCalledTimes(1)
    expect(getSaldoCalculado).toHaveBeenCalledWith("c1", HOJE_CALCULO)
    expect(botaoDia(HOJE)).toHaveAttribute("data-hoje", "true")
    expect(botaoDia(HOJE)).toHaveAttribute("data-sel", "true")
  })

  it("o dia de hoje já aberto é conferível sem clicar em nada (digitou → compara e oferece gravar)", async () => {
    getSaldoCalculado.mockResolvedValue(100)
    await renderPage({ manterMount: true })
    digitarSaldoReal("10000")
    expect(await screen.findByText("Calculado (app)")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Gravar marco" })) // bateu (100 = 100)
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))
    const [dto] = criarMarco.mock.calls[0]
    expect(dto.contaId).toBe("c1")
    expect(dto.dataHora).toEqual(HOJE_CALCULO) // hoje grava com a hora atual, não "23:59"
  })

  it("hoje já tem marco: ao abrir, o painel mostra o marco de hoje (e não o campo de conferir)", async () => {
    listMarcos.mockResolvedValue([marco(HOJE)])
    await renderPage({ manterMount: true })
    expect(await screen.findByRole("button", { name: "Remover marco" })).toBeInTheDocument()
    expect(screen.getByText(dataLabel(HOJE), { selector: "strong" })).toBeInTheDocument() // "Marco de DD/MM/YYYY"
    expect(screen.queryByText("Saldo real da conta")).not.toBeInTheDocument()
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
    clicarDia(DIA_LIVRE) // "Conferir DD/<mês atual>"
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalledTimes(1))
    digitarSaldoReal("10000")
    await screen.findByText("Calculado (app)")

    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }))
    // antes do fix o painel virava "Marco de <mês atual>" exibindo o marco do mês seguinte
    expect(screen.queryByRole("button", { name: "Remover marco" })).not.toBeInTheDocument()
    expect(screen.queryByText(/R\$\s?777,00/, { selector: "strong" })).not.toBeInTheDocument()
    expect(screen.getByText(/Escolha um dia no calendário/)).toBeInTheDocument()

    // clicando no dia do mês seguinte aí sim aparece o marco dele, com a data certa
    fireEvent.click(botaoDia(DIA_LIVRE))
    const proximo = new Date(ANO, MES + 1, 1)
    const rotulo = `${pad2(DIA_LIVRE)}/${pad2(proximo.getMonth() + 1)}/${proximo.getFullYear()}`
    expect(await screen.findByText(rotulo, { selector: "strong" })).toBeInTheDocument()
    expect(screen.getAllByText(/R\$\s?777,00/).length).toBeGreaterThan(0)
  })

  it("erro ao carregar as contas avisa por toast", async () => {
    getContas.mockRejectedValue(new Error("boom"))
    render(<PontesThemeProvider><ReconciliacaoPage /></PontesThemeProvider>)
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error", message: "Erro ao carregar contas" })))
    expect(listMarcos).not.toHaveBeenCalled()
  })

  it("erro ao carregar os marcos avisa por toast (e o hero segue com o saldo da conta)", async () => {
    listMarcos.mockRejectedValue(new Error("boom"))
    await renderPage({ manterMount: true })
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error", message: "Erro ao carregar marcos" })))
    expect(screen.getByText(SALDO_A)).toBeInTheDocument()
    expect(screen.getByText("nenhuma conferência ainda")).toBeInTheDocument()
  })

  it("clicar num dia sem marco busca o saldo calculado até o fim do dia e abre o painel de conferir", async () => {
    await renderPage()
    clicarDia(DIA_LIVRE)
    expect(await screen.findByText("Saldo real da conta")).toBeInTheDocument()
    expect(screen.getByText(dataLabel(DIA_LIVRE))).toBeInTheDocument() // "Conferir DD/MM/YYYY"
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalledWith("c1", `${isoDia(DIA_LIVRE)}T23:59:00.000Z`))
    // ainda não digitou nada: não há comparação nem botão de gravar
    expect(screen.queryByText("Diferença")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Gravar marco" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Definir saldo inicial" })).not.toBeInTheDocument()
  })

  it("erro ao calcular o saldo do dia avisa por toast e não libera a gravação", async () => {
    getSaldoCalculado.mockRejectedValue(new Error("boom"))
    await renderPage()
    clicarDia(DIA_LIVRE)
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error" })))
    digitarSaldoReal("10000")
    expect(screen.queryByText("Diferença")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Gravar marco" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Definir saldo inicial" })).not.toBeInTheDocument()
    expect(criarMarco).not.toHaveBeenCalled()
  })

  // --- bate

  it("bate (calculado = declarado): mostra Calculado x Declarado x Diferença e 'Gravar marco' grava como verificação", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)]) // conta já tem marco → próximo é Verificação
    getSaldoCalculado.mockResolvedValue(100)
    await renderPage()
    await screen.findByText(dataHoraLabel(DIA_MARCO))
    clicarDia(DIA_LIVRE)
    await screen.findByText("Saldo real da conta")
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalled())

    digitarSaldoReal("10000") // 100,00
    expect(await screen.findByText("Calculado (app)")).toBeInTheDocument()
    expect(screen.getByText("Declarado (você)")).toBeInTheDocument()
    expect(screen.getByText("Diferença")).toBeInTheDocument()
    // diferença zero: sem aviso de divergência e sem as ações de divergência
    expect(screen.queryByText(/Faltou \(ou sobrou\) lançamento/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Ajustar (cria lançamento)" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Lançar o que falta" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Gravar marco" }))
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))
    const [dto, idemKey] = criarMarco.mock.calls[0]
    expect(dto).toMatchObject({ contaId: "c1", dataHora: `${isoDia(DIA_LIVRE)}T23:59:00.000Z`, tipo: 2 })
    expect(dto.saldoDeclarado).toBeCloseTo(100, 2)
    expect(dto.resolucao).toBeUndefined() // bateu → não cria lançamento de ajuste
    expect(idemKey).toEqual(expect.any(String))
    expect(idemKey).not.toBe("")

    // sucesso: toast, painel volta ao estado inicial e recarrega os marcos
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: expect.stringContaining("Marco gravado") })))
    await waitFor(() => expect(listMarcos).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/Escolha um dia no calendário/)).toBeInTheDocument()
  })

  it("bate numa conta SEM marcos: 'Gravar marco' grava como baseline (tipo 1) sem ajuste", async () => {
    getSaldoCalculado.mockResolvedValue(100)
    await renderPage()
    clicarDia(DIA_LIVRE)
    await screen.findByText("Saldo real da conta")
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalled())
    digitarSaldoReal("10000")
    fireEvent.click(await screen.findByRole("button", { name: "Gravar marco" }))
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))
    expect(criarMarco.mock.calls[0][0]).toMatchObject({ contaId: "c1", tipo: 1 })
    expect(criarMarco.mock.calls[0][0].resolucao).toBeUndefined()
  })

  // --- não bate, 1ª conferência (baseline)

  it("não bate em conta SEM marcos: oferece 'Definir saldo inicial' (baseline, tipo 1) e grava o declarado", async () => {
    getSaldoCalculado.mockResolvedValue(100)
    await renderPage()
    clicarDia(DIA_LIVRE)
    await screen.findByText("Saldo real da conta")
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalled())

    digitarSaldoReal("15000") // declara 150,00 x calculado 100,00
    const definir = await screen.findByRole("button", { name: "Definir saldo inicial" })
    expect(screen.getByText(/1ª conferência da conta/)).toBeInTheDocument()
    expect(screen.getByText(/\+R\$\s?50,00/)).toBeInTheDocument() // diferença positiva com sinal
    // baseline não oferece as ações de verificação
    expect(screen.queryByRole("button", { name: "Ajustar (cria lançamento)" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Lançar o que falta" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Gravar marco" })).not.toBeInTheDocument()

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
    getSaldoCalculado.mockResolvedValue(100)
    await renderPage()
    await screen.findByText(dataHoraLabel(DIA_MARCO))
    clicarDia(DIA_LIVRE)
    await screen.findByText("Saldo real da conta")
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalled())

    digitarSaldoReal("15000") // 150,00 x 100,00
    const ajustar = await screen.findByRole("button", { name: "Ajustar (cria lançamento)" })
    expect(screen.getByRole("button", { name: "Lançar o que falta" })).toBeInTheDocument()
    expect(screen.getByText(/Faltou \(ou sobrou\) lançamento/)).toBeInTheDocument()
    // verificação não oferece baseline nem "gravar marco" simples
    expect(screen.queryByRole("button", { name: "Definir saldo inicial" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Gravar marco" })).not.toBeInTheDocument()

    fireEvent.click(ajustar)
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))
    const [dto] = criarMarco.mock.calls[0]
    expect(dto).toMatchObject({ contaId: "c1", tipo: 2, resolucao: "ajustar" })
    expect(dto.saldoDeclarado).toBeCloseTo(150, 2)
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: expect.stringContaining("ajuste") })))
  })

  it("diferença negativa (declarou menos que o calculado) também cai em 'Ajustar', com sinal de menos", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    getSaldoCalculado.mockResolvedValue(100)
    await renderPage()
    await screen.findByText(dataHoraLabel(DIA_MARCO))
    clicarDia(DIA_LIVRE)
    await screen.findByText("Saldo real da conta")
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalled())
    digitarSaldoReal("4000") // 40,00 x 100,00 → -60,00
    expect(await screen.findByRole("button", { name: "Ajustar (cria lançamento)" })).toBeInTheDocument()
    expect(screen.getByText(/-R\$\s?60,00/)).toBeInTheDocument()
    expect(screen.queryByText(/\+R\$/)).not.toBeInTheDocument()
  })

  it("'Lançar o que falta' navega pra /transactions sem gravar nada", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    getSaldoCalculado.mockResolvedValue(100)
    await renderPage()
    await screen.findByText(dataHoraLabel(DIA_MARCO))
    clicarDia(DIA_LIVRE)
    await screen.findByText("Saldo real da conta")
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalled())
    digitarSaldoReal("15000")
    fireEvent.click(await screen.findByRole("button", { name: "Lançar o que falta" }))
    expect(navigateSpy).toHaveBeenCalledWith("/transactions")
    expect(criarMarco).not.toHaveBeenCalled()
  })

  // --- erro ao gravar

  it("erro ao gravar: toast de erro, painel segue aberto e o retry reusa a MESMA Idempotency-Key", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    getSaldoCalculado.mockResolvedValue(100)
    criarMarco.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(marco(DIA_LIVRE))
    await renderPage()
    await screen.findByText(dataHoraLabel(DIA_MARCO))
    clicarDia(DIA_LIVRE)
    await screen.findByText("Saldo real da conta")
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalled())
    digitarSaldoReal("10000")

    fireEvent.click(await screen.findByRole("button", { name: "Gravar marco" }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error" })))
    // painel continua aberto pra tentar de novo (nada foi perdido)
    expect(screen.getByText("Saldo real da conta")).toBeInTheDocument()
    expect(screen.getByDisplayValue("100,00")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Gravar marco" }))
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(2))
    expect(criarMarco.mock.calls[1][1]).toBe(criarMarco.mock.calls[0][1]) // mesma operação → mesma chave
    await waitFor(() => expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({ severity: "success" })))
  })

  it("cada seleção de dia gera uma Idempotency-Key nova", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    getSaldoCalculado.mockResolvedValue(100)
    await renderPage()
    await screen.findByText(dataHoraLabel(DIA_MARCO))

    clicarDia(DIA_LIVRE)
    await screen.findByText("Saldo real da conta")
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalledTimes(1))
    digitarSaldoReal("10000")
    fireEvent.click(await screen.findByRole("button", { name: "Gravar marco" }))
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(1))
    await screen.findByText(/Escolha um dia no calendário/)

    clicarDia(DIA_LIVRE)
    await screen.findByText("Saldo real da conta")
    await waitFor(() => expect(getSaldoCalculado).toHaveBeenCalledTimes(2))
    digitarSaldoReal("10000")
    fireEvent.click(await screen.findByRole("button", { name: "Gravar marco" }))
    await waitFor(() => expect(criarMarco).toHaveBeenCalledTimes(2))
    expect(criarMarco.mock.calls[1][1]).not.toBe(criarMarco.mock.calls[0][1])
  })

  // ---------------------------------------------------------------- dia com marco

  it("clicar num dia COM marco mostra o marco (calculado/declarado/diferença) sem recalcular e com 'Remover marco'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { saldoCalculado: 480, saldoDeclarado: 500, diferenca: 20, temAjuste: true })])
    await renderPage()
    await screen.findByText(dataHoraLabel(DIA_MARCO))
    clicarDia(DIA_MARCO)

    expect(await screen.findByText(dataLabel(DIA_MARCO), { selector: "strong" })).toBeInTheDocument() // "Marco de DD/MM/YYYY"
    expect(screen.getByText("Calculado (app)")).toBeInTheDocument()
    expect(screen.getByText("Declarado (você)")).toBeInTheDocument()
    expect(screen.getByText("Diferença")).toBeInTheDocument()
    expect(screen.getByText(/R\$\s?480,00/)).toBeInTheDocument()
    expect(screen.getByText(/\+R\$\s?20,00/)).toBeInTheDocument()
    expect(screen.getByText("lançamento de ajuste criado")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remover marco" })).toBeInTheDocument()
    // marco existente não é conferido de novo
    expect(getSaldoCalculado).not.toHaveBeenCalled()
    expect(screen.queryByText("Saldo real da conta")).not.toBeInTheDocument()
  })

  it("marco sem ajuste não mostra a tag de 'lançamento de ajuste criado'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await screen.findByText(dataHoraLabel(DIA_MARCO))
    clicarDia(DIA_MARCO)
    await screen.findByRole("button", { name: "Remover marco" })
    expect(screen.queryByText("lançamento de ajuste criado")).not.toBeInTheDocument()
    expect(screen.queryByText(/edite a conta/)).not.toBeInTheDocument() // marco comum não é "saldo inicial derivado"
  })

  it("marco DERIVADO (saldo inicial da conta): mostra a nota 'edite a conta' e NÃO oferece 'Remover marco'", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { tipo: 1, derivado: true, saldoDeclarado: 300, saldoCalculado: 300 })])
    await renderPage()
    await screen.findByText(dataHoraLabel(DIA_MARCO))
    expect(botaoDia(DIA_MARCO)).toHaveAttribute("data-marco", "inicial")
    clicarDia(DIA_MARCO)

    expect(await screen.findByText("Saldo inicial da conta — pra mudar, edite a conta.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remover marco" })).not.toBeInTheDocument()
    // o resto do marco continua visível (só a remoção some)
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
    await screen.findByText(dataHoraLabel(DIA_MARCO))
    clicarDia(DIA_MARCO)
    fireEvent.click(await screen.findByRole("button", { name: "Remover marco" }))

    const dialog = await screen.findByRole("alertdialog", { name: "Remover marco?" })
    expect(within(dialog).getByText(/sem ajuste vinculado/)).toBeInTheDocument()
    expect(removerMarco).not.toHaveBeenCalled() // só abrir o dialog não remove
    fireEvent.click(within(dialog).getByRole("button", { name: "Remover" }))

    await waitFor(() => expect(removerMarco).toHaveBeenCalledWith("m-15"))
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: "Marco removido" })))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    await waitFor(() => expect(listMarcos).toHaveBeenCalledTimes(2))
  })

  it("remover marco COM ajuste avisa no dialog que o lançamento de ajuste também será cancelado", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO, { temAjuste: true, diferenca: 20 })])
    await renderPage()
    await screen.findByText(dataHoraLabel(DIA_MARCO))
    clicarDia(DIA_MARCO)
    fireEvent.click(await screen.findByRole("button", { name: "Remover marco" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Remover marco?" })
    expect(within(dialog).getByText(/o lançamento de ajuste também será cancelado/)).toBeInTheDocument()
  })

  it("cancelar o dialog de remoção não chama removerMarco e fecha o dialog", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    await renderPage()
    await screen.findByText(dataHoraLabel(DIA_MARCO))
    clicarDia(DIA_MARCO)
    fireEvent.click(await screen.findByRole("button", { name: "Remover marco" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Remover marco?" })
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    expect(removerMarco).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Remover marco" })).toBeInTheDocument() // marco segue selecionado
  })

  it("erro ao remover: toast de erro e o dialog fecha sem recarregar", async () => {
    listMarcos.mockResolvedValue([marco(DIA_MARCO)])
    removerMarco.mockRejectedValue(new Error("boom"))
    await renderPage()
    await screen.findByText(dataHoraLabel(DIA_MARCO))
    clicarDia(DIA_MARCO)
    fireEvent.click(await screen.findByRole("button", { name: "Remover marco" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Remover marco?" })
    fireEvent.click(within(dialog).getByRole("button", { name: "Remover" }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error" })))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    expect(listMarcos).toHaveBeenCalledTimes(1)
  })
})
