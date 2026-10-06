import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import AccountsPage from "../../pages/Accounts/AccountsPage"
import type { Banco } from "../../types/Banco"
import type { Conta } from "../../types/Conta"
import type { ReconciliacaoMarco } from "../../types/Reconciliacao"

// ── Router mock ──────────────────────────────────────────────────────────────
const mockNotify = vi.fn()
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ notify: mockNotify }),
}))

// ── Service mocks ────────────────────────────────────────────────────────────
const getBancos = vi.fn()
const getContas = vi.fn()
const deleteConta = vi.fn()
const atualizarSaldoInicial = vi.fn()
const listMarcos = vi.fn()

vi.mock("../../services/bancoService", () => ({
  getBancos: (...a: unknown[]) => getBancos(...a),
}))
vi.mock("../../services/contaService", () => ({
  getContas: (...a: unknown[]) => getContas(...a),
  deleteConta: (...a: unknown[]) => deleteConta(...a),
  atualizarSaldoInicial: (...a: unknown[]) => atualizarSaldoInicial(...a),
}))
vi.mock("../../services/reconciliacaoService", () => ({
  listMarcos: (...a: unknown[]) => listMarcos(...a),
}))

// NewContaDialog e legado — mockamos para isolar a page
vi.mock("../../components/Contas/NewContaDialog/NewContaDialog", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="new-conta-dialog">Dialog</div> : null,
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeBanco(overrides: Partial<Banco> = {}): Banco {
  return {
    id: "banco-001",
    nome: "Banco Nubank S.A.",
    nomeFantasia: "Nubank",
    razaoSocial: "Banco Nubank S.A.",
    codigoBanco: "260",
    tipo: 1,
    tipoDescricao: "Banco",
    ativo: true,
    logoUrl: "https://www.google.com/s2/favicons?domain=nubank.com.br&sz=128",
    cor: "#820AD1",
    ...overrides,
  }
}

function makeConta(overrides: Partial<Conta> = {}): Conta {
  return {
    id: "conta-001",
    nome: "Nubank Corrente",
    tipo: 1,
    tipoDescricao: "Corrente",
    saldoAtual: 2500.0,
    isCarteira: false,
    bancoId: "banco-001",
    bancoNome: "Nubank",
    ...overrides,
  }
}

function makeCarteira(overrides: Partial<Conta> = {}): Conta {
  return {
    id: "carteira-001",
    nome: "Carteira",
    tipo: 1,
    tipoDescricao: "Carteira",
    saldoAtual: 150.0,
    isCarteira: true,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <PontesThemeProvider>
      <AccountsPage />
    </PontesThemeProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AccountsPage", () => {
  // ── Empty state ──

  it("mostra empty state quando nao ha contas bancarias", async () => {
    getBancos.mockResolvedValue([])
    getContas.mockResolvedValue([makeCarteira()])
    renderPage()
    expect(await screen.findByText("Nenhuma conta bancária cadastrada")).toBeInTheDocument()
  })

  // ── Listagem e stats ──

  it("exibe nome e banco da conta", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeCarteira(), makeConta()])
    renderPage()
    expect(await screen.findByText("Nubank Corrente")).toBeInTheDocument()
    expect(screen.getAllByText("Nubank").length).toBeGreaterThanOrEqual(1)
  })

  it("exibe stats: Saldo Total, Contas Bancarias, Carteira Fisica", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeCarteira(), makeConta()])
    renderPage()
    await screen.findByText("Nubank Corrente")
    expect(screen.getByText("Saldo Total")).toBeInTheDocument()
    expect(screen.getByText("Contas Bancárias")).toBeInTheDocument()
    expect(screen.getByText("Carteira Física")).toBeInTheDocument()
  })

  it("exibe carteira automatica com saldo", async () => {
    getBancos.mockResolvedValue([])
    getContas.mockResolvedValue([makeCarteira()])
    renderPage()
    expect(await screen.findByText("Carteira automática")).toBeInTheDocument()
    expect(screen.getByText("Carteira")).toBeInTheDocument()
  })

  it("exibe badge de tipo na conta", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeConta()])
    renderPage()
    await screen.findByText("Nubank Corrente")
    expect(screen.getByText("Corrente")).toBeInTheDocument()
  })

  // ── Abrir dialog ──

  it("abre NewContaDialog ao clicar Nova Conta", async () => {
    getBancos.mockResolvedValue([])
    getContas.mockResolvedValue([])
    renderPage()
    await screen.findByText("Nenhuma conta bancária cadastrada")
    fireEvent.click(screen.getAllByText("Nova Conta")[0])
    expect(await screen.findByTestId("new-conta-dialog")).toBeInTheDocument()
  })

  it("abre dialog de edicao ao clicar Editar", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeConta()])
    renderPage()
    await screen.findByText("Nubank Corrente")
    fireEvent.click(screen.getByTitle("Editar"))
    expect(await screen.findByTestId("new-conta-dialog")).toBeInTheDocument()
  })

  // ── Excluir conta ──

  it("abre confirm dialog ao clicar excluir", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeConta()])
    renderPage()
    await screen.findByText("Nubank Corrente")
    fireEvent.click(screen.getByTitle("Excluir"))
    expect(await screen.findByText("Excluir conta")).toBeInTheDocument()
    expect(screen.getByText(/Remover "Nubank Corrente"/)).toBeInTheDocument()
  })

  it("chama deleteConta ao confirmar exclusao", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeConta()])
    deleteConta.mockResolvedValue(undefined)
    renderPage()
    await screen.findByText("Nubank Corrente")
    fireEvent.click(screen.getByTitle("Excluir"))
    await screen.findByText("Excluir conta")
    fireEvent.click(screen.getByText("Confirmar"))
    await waitFor(() => {
      expect(deleteConta).toHaveBeenCalledWith("conta-001")
    })
  })

  it("cancela exclusao sem chamar deleteConta", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeConta()])
    renderPage()
    await screen.findByText("Nubank Corrente")
    fireEvent.click(screen.getByTitle("Excluir"))
    await screen.findByText("Excluir conta")
    fireEvent.click(screen.getByText("Cancelar"))
    expect(deleteConta).not.toHaveBeenCalled()
  })

  // ── PontesBankBadge ──

  it("exibe logo do banco quando logoUrl presente", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeConta()])
    renderPage()
    await screen.findByText("Nubank Corrente")
    const img = document.querySelector("img[alt='Nubank']")
    expect(img).toBeInTheDocument()
    expect((img as HTMLImageElement).src).toContain("nubank.com.br")
  })

  it("exibe iniciais quando banco sem logo", async () => {
    getBancos.mockResolvedValue([makeBanco({ logoUrl: undefined })])
    getContas.mockResolvedValue([makeConta()])
    renderPage()
    await screen.findByText("Nubank Corrente")
    expect(screen.getAllByText("NU").length).toBeGreaterThanOrEqual(1)
  })

  it("exibe iniciais quando conta sem banco vinculado", async () => {
    getBancos.mockResolvedValue([])
    getContas.mockResolvedValue([makeConta({ bancoId: undefined, bancoNome: undefined })])
    renderPage()
    await screen.findByText("Nubank Corrente")
    expect(screen.getByText("Sem banco vinculado")).toBeInTheDocument()
  })
})

// ── Saldo inicial ────────────────────────────────────────────────────────────
// Ação "Saldo inicial" em TODA conta (inclusive a Carteira, que nasce zerada e não passa pelo formulário de
// conta). Abre um modal com Valor (obrigatório, máscara de centavos) + Desde (máx. hoje) e, ao abrir, pré-preenche
// com o marco DERIVADO (o saldo inicial já gravado) vindo de listMarcos.
//
// "Agora" é FIXO (só o Date é falsificado; timers seguem reais pro waitFor): o Desde padrão é "hoje".

describe("AccountsPage — Saldo inicial", () => {
  const HOJE_ISO = "2026-06-20"
  const HOJE_LABEL = "20/06/2026"
  const contaB = makeConta({
    id: "conta-002", nome: "Itaú Poupança", tipo: 2, tipoDescricao: "Poupança", saldoAtual: 800, bancoId: undefined, bancoNome: undefined,
  })

  // Marco de partida (derivado do saldo inicial da conta). dataHora com hora de parede encodada como UTC.
  function marcoPartida(over: Partial<ReconciliacaoMarco> = {}): ReconciliacaoMarco {
    return {
      id: "m-partida",
      contaId: "conta-001",
      dataHora: "2026-03-10T14:30:00.000Z",
      saldoDeclarado: 2500,
      saldoCalculado: 2500,
      diferenca: 0,
      tipo: 1,
      temAjuste: false,
      derivado: true,
      criadoEm: "2026-03-10T14:31:00.000Z",
      ...over,
    }
  }

  function adiado<T>() {
    let resolver!: (v: T) => void
    let rejeitar!: (e: unknown) => void
    const promessa = new Promise<T>((res, rej) => { resolver = res; rejeitar = rej })
    return { promessa, resolver, rejeitar }
  }

  const botaoSaldoCarteira = () => screen.getByRole("button", { name: "Saldo inicial" })
  const botaoSaldoConta = (nome: string) => screen.getByRole("button", { name: `Saldo inicial de ${nome}` })
  const modal = (nome: string) => screen.findByRole("dialog", { name: `Saldo inicial — ${nome}` })
  const modalAberto = () => screen.getByRole("dialog", { name: /^Saldo inicial — / })
  const campoValor = () => within(modalAberto()).getByPlaceholderText("0,00") as HTMLInputElement
  const botaoSalvar = () => within(modalAberto()).getByRole("button", { name: "Salvar" })
  const botaoDesde = (label: string) => within(modalAberto()).getByRole("button", { name: label })
  const digitarValor = (centavos: string) => fireEvent.change(campoValor(), { target: { value: centavos } })

  async function abrirPagina() {
    renderPage()
    await screen.findByText("Nubank Corrente")
  }

  // Abre o modal de uma conta bancária e espera a busca do marco terminar (campos habilitados).
  async function abrirModalConta(nome = "Nubank Corrente") {
    fireEvent.click(botaoSaldoConta(nome))
    await modal(nome)
    await waitFor(() => expect(botaoSalvar()).toBeEnabled())
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 5, 20, 10, 30, 0))
    mockNotify.mockReset()
    getBancos.mockReset().mockResolvedValue([makeBanco()])
    getContas.mockReset().mockResolvedValue([makeCarteira(), makeConta(), contaB])
    deleteConta.mockReset()
    atualizarSaldoInicial.mockReset().mockResolvedValue(undefined)
    listMarcos.mockReset().mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ---------------------------------------------------------------- onde fica a ação

  it("a Carteira tem a ação 'Saldo inicial' e continua SEM Editar/Excluir", async () => {
    await abrirPagina()
    const card = screen.getByText("Carteira automática").closest('[class*="carteiraCard"]') as HTMLElement
    expect(within(card).getByRole("button", { name: "Saldo inicial" })).toBeInTheDocument()
    expect(within(card).queryByTitle("Editar")).not.toBeInTheDocument()
    expect(within(card).queryByTitle("Excluir")).not.toBeInTheDocument()
    // Editar/Excluir existem só nas 2 contas bancárias (nenhum sobrando pra Carteira)
    expect(screen.getAllByTitle("Editar")).toHaveLength(2)
    expect(screen.getAllByTitle("Excluir")).toHaveLength(2)
  })

  it("Carteira sozinha (sem contas bancárias): ainda tem 'Saldo inicial' e nenhum Editar/Excluir na tela", async () => {
    getContas.mockResolvedValue([makeCarteira()])
    renderPage()
    await screen.findByText("Carteira automática")
    expect(botaoSaldoCarteira()).toBeInTheDocument()
    expect(screen.queryByTitle("Editar")).not.toBeInTheDocument()
    expect(screen.queryByTitle("Excluir")).not.toBeInTheDocument()
  })

  it("cada conta bancária tem o botão de ícone 'Saldo inicial' (aria-label com o nome), ao lado de Editar e Excluir", async () => {
    await abrirPagina()
    for (const nome of ["Nubank Corrente", "Itaú Poupança"]) {
      const btn = botaoSaldoConta(nome)
      expect(btn).toHaveAttribute("title", "Saldo inicial")
      const rodape = btn.parentElement as HTMLElement
      expect(within(rodape).getByTitle("Editar")).toBeInTheDocument()
      expect(within(rodape).getByTitle("Excluir")).toBeInTheDocument()
    }
    // o botão de texto "Saldo inicial" é só o da Carteira (os de ícone têm o nome da conta no rótulo)
    expect(screen.getAllByRole("button", { name: /^Saldo inicial/ })).toHaveLength(3)
  })

  // ---------------------------------------------------------------- abrir o modal

  it("clicar na ação da Carteira abre o modal 'Saldo inicial — Carteira' com Valor e Desde", async () => {
    await abrirPagina()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    fireEvent.click(botaoSaldoCarteira())
    const dlg = await modal("Carteira")
    expect(within(dlg).getByText("Valor")).toBeInTheDocument()
    expect(within(dlg).getByText("Desde")).toBeInTheDocument()
    expect(within(dlg).getByRole("button", { name: "Salvar" })).toBeInTheDocument()
    expect(within(dlg).getByRole("button", { name: "Cancelar" })).toBeInTheDocument()
    expect(listMarcos).toHaveBeenCalledWith("carteira-001")
    expect(atualizarSaldoInicial).not.toHaveBeenCalled()
  })

  it("clicar na ação de uma conta bancária abre o modal com o NOME dela no título e busca os marcos DELA", async () => {
    await abrirPagina()
    fireEvent.click(botaoSaldoConta("Itaú Poupança"))
    expect(await modal("Itaú Poupança")).toBeInTheDocument()
    expect(listMarcos).toHaveBeenCalledTimes(1)
    expect(listMarcos).toHaveBeenCalledWith("conta-002")
    // abrir o modal não toca no fluxo de editar/excluir
    expect(screen.queryByTestId("new-conta-dialog")).not.toBeInTheDocument()
    expect(screen.queryByText("Excluir conta")).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------- pré-preenchimento

  it("pré-preenche Valor e Desde a partir do marco DERIVADO e ignora marcos comuns", async () => {
    listMarcos.mockResolvedValue([
      marcoPartida({ id: "m-conferido", derivado: undefined, saldoDeclarado: 999, dataHora: "2026-05-01T12:00:00.000Z" }),
      marcoPartida({ id: "m-outro", derivado: false, saldoDeclarado: 111, dataHora: "2026-04-01T12:00:00.000Z" }),
      marcoPartida(),
    ])
    await abrirPagina()
    fireEvent.click(botaoSaldoConta("Nubank Corrente"))
    await modal("Nubank Corrente")
    await waitFor(() => expect(campoValor()).toHaveValue("2.500,00"))
    expect(botaoDesde("10/03/2026")).toBeInTheDocument()
    expect(campoValor()).toBeEnabled()
    expect(botaoSalvar()).toBeEnabled()
    expect(campoValor()).not.toHaveAttribute("data-invalid")
    expect(atualizarSaldoInicial).not.toHaveBeenCalled()
  })

  it("a data do Desde vem do TEXTO do marco (sem converter fuso): 23:59Z e 00:00Z ficam no mesmo dia", async () => {
    listMarcos.mockResolvedValue([marcoPartida({ dataHora: "2026-03-10T23:59:00.000Z" })])
    await abrirPagina()
    fireEvent.click(botaoSaldoConta("Nubank Corrente"))
    await modal("Nubank Corrente")
    await waitFor(() => expect(campoValor()).toHaveValue("2.500,00"))
    expect(botaoDesde("10/03/2026")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

    listMarcos.mockResolvedValue([marcoPartida({ dataHora: "2026-03-10T00:00:00.000Z" })])
    fireEvent.click(botaoSaldoConta("Nubank Corrente"))
    await modal("Nubank Corrente")
    await waitFor(() => expect(campoValor()).toHaveValue("2.500,00"))
    expect(botaoDesde("10/03/2026")).toBeInTheDocument()
  })

  it("saldo com centavos do marco aparece formatado no campo ('1.234,50')", async () => {
    listMarcos.mockResolvedValue([marcoPartida({ saldoDeclarado: 1234.5 })])
    await abrirPagina()
    fireEvent.click(botaoSaldoConta("Nubank Corrente"))
    await modal("Nubank Corrente")
    await waitFor(() => expect(campoValor()).toHaveValue("1.234,50"))
  })

  it("sem nenhum marco: abre com Valor vazio e Desde = hoje", async () => {
    listMarcos.mockResolvedValue([])
    await abrirPagina()
    await abrirModalConta()
    expect(campoValor()).toHaveValue("")
    expect(botaoDesde(HOJE_LABEL)).toBeInTheDocument()
  })

  it("só marcos comuns (nenhum derivado): abre com Valor vazio e Desde = hoje", async () => {
    listMarcos.mockResolvedValue([marcoPartida({ derivado: false }), marcoPartida({ id: "m2", derivado: undefined })])
    await abrirPagina()
    await abrirModalConta()
    expect(campoValor()).toHaveValue("")
    expect(botaoDesde(HOJE_LABEL)).toBeInTheDocument()
  })

  it("listMarcos rejeita: abre com Valor vazio e Desde = hoje, sem toast, e salvar continua funcionando", async () => {
    listMarcos.mockRejectedValue(new Error("boom"))
    await abrirPagina()
    await abrirModalConta()
    expect(campoValor()).toHaveValue("")
    expect(campoValor()).toBeEnabled()
    expect(botaoDesde(HOJE_LABEL)).toBeInTheDocument()
    expect(mockNotify).not.toHaveBeenCalled()

    digitarValor("30000")
    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(atualizarSaldoInicial).toHaveBeenCalledWith("conta-001", { valor: 300, data: HOJE_ISO }))
  })

  it("enquanto a busca do marco está em voo: Valor e Salvar ficam desabilitados; ao chegar, preenche e libera", async () => {
    const busca = adiado<ReconciliacaoMarco[]>()
    listMarcos.mockReturnValue(busca.promessa)
    await abrirPagina()

    fireEvent.click(botaoSaldoConta("Nubank Corrente"))
    await modal("Nubank Corrente")
    expect(campoValor()).toBeDisabled()
    expect(botaoSalvar()).toBeDisabled()
    // clicar em Salvar com a busca em voo não faz nada
    fireEvent.click(botaoSalvar())
    expect(atualizarSaldoInicial).not.toHaveBeenCalled()
    expect(within(modalAberto()).queryByText("Informe um valor maior que zero")).not.toBeInTheDocument()

    await act(async () => { busca.resolver([marcoPartida()]) })
    expect(campoValor()).toBeEnabled()
    expect(campoValor()).toHaveValue("2.500,00")
    expect(botaoSalvar()).toBeEnabled()
  })

  // ---------------------------------------------------------------- validação por campo (Valor)

  it("Salvar com Valor vazio bloqueia: erro INLINE no campo (sem toast), não chama o serviço e o modal segue aberto", async () => {
    await abrirPagina()
    await abrirModalConta()

    fireEvent.click(botaoSalvar())
    expect(within(modalAberto()).getByText("Informe um valor maior que zero")).toBeInTheDocument()
    expect(campoValor()).toHaveAttribute("data-invalid", "true")
    expect(atualizarSaldoInicial).not.toHaveBeenCalled()
    expect(mockNotify).not.toHaveBeenCalled() // erro de campo nunca é toast
    expect(modalAberto()).toBeInTheDocument()
  })

  it("Valor '0,00' também bloqueia (valor <= 0): erro inline e nenhuma chamada ao serviço", async () => {
    await abrirPagina()
    await abrirModalConta()

    digitarValor("000") // máscara → "0,00"
    expect(campoValor()).toHaveValue("0,00")
    fireEvent.click(botaoSalvar())
    expect(within(modalAberto()).getByText("Informe um valor maior que zero")).toBeInTheDocument()
    expect(atualizarSaldoInicial).not.toHaveBeenCalled()
    expect(mockNotify).not.toHaveBeenCalled()
  })

  it("o erro some assim que a pessoa digita no campo (e o campo deixa de ficar vermelho)", async () => {
    await abrirPagina()
    await abrirModalConta()
    fireEvent.click(botaoSalvar())
    expect(within(modalAberto()).getByText("Informe um valor maior que zero")).toBeInTheDocument()

    digitarValor("5")
    expect(within(modalAberto()).queryByText("Informe um valor maior que zero")).not.toBeInTheDocument()
    expect(campoValor()).not.toHaveAttribute("data-invalid")
    expect(campoValor()).toHaveValue("0,05")

    // corrigido, o envio passa
    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(atualizarSaldoInicial).toHaveBeenCalledWith("conta-001", { valor: 0.05, data: HOJE_ISO }))
  })

  it("o erro não vaza pra próxima abertura do modal", async () => {
    await abrirPagina()
    await abrirModalConta()
    fireEvent.click(botaoSalvar())
    expect(within(modalAberto()).getByText("Informe um valor maior que zero")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

    await abrirModalConta()
    expect(within(modalAberto()).queryByText("Informe um valor maior que zero")).not.toBeInTheDocument()
    expect(campoValor()).not.toHaveAttribute("data-invalid")
  })

  it("a máscara do campo lê dígitos como centavos e descarta o que não é número", async () => {
    await abrirPagina()
    await abrirModalConta()
    digitarValor("394420")
    expect(campoValor()).toHaveValue("3.944,20")
    digitarValor("")
    expect(campoValor()).toHaveValue("")
    digitarValor("abc")
    expect(campoValor()).toHaveValue("")
    digitarValor("-12")
    expect(campoValor()).toHaveValue("0,12") // sem valor negativo: o sinal é descartado
  })

  // ---------------------------------------------------------------- salvar

  it("Salvar válido chama atualizarSaldoInicial(conta, { valor numérico, data }), avisa por toast, fecha o modal e recarrega as contas", async () => {
    // depois de salvar a tela recarrega: o 2º getContas já traz o saldo novo
    getContas
      .mockResolvedValueOnce([makeCarteira(), makeConta(), contaB])
      .mockResolvedValue([makeCarteira(), makeConta({ saldoAtual: 7777 }), contaB])
    await abrirPagina()
    expect(getContas).toHaveBeenCalledTimes(1)
    await abrirModalConta()

    digitarValor("250000")
    expect(campoValor()).toHaveValue("2.500,00")
    fireEvent.click(botaoSalvar())

    await waitFor(() => expect(atualizarSaldoInicial).toHaveBeenCalledTimes(1))
    expect(atualizarSaldoInicial).toHaveBeenCalledWith("conta-001", { valor: 2500, data: HOJE_ISO })
    expect(typeof atualizarSaldoInicial.mock.calls[0][1].valor).toBe("number") // número, não "2.500,00"
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith({ open: true, message: "Saldo inicial salvo", severity: "success" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(getContas).toHaveBeenCalledTimes(2))
    expect((await screen.findAllByText(/R\$\s?7\.777,00/)).length).toBeGreaterThanOrEqual(1)
    expect(mockNotify).toHaveBeenCalledTimes(1) // só o toast de sucesso
  })

  it("com marco derivado, salvar só o Valor mantém o Desde do marco no payload", async () => {
    listMarcos.mockResolvedValue([marcoPartida()])
    await abrirPagina()
    fireEvent.click(botaoSaldoConta("Nubank Corrente"))
    await modal("Nubank Corrente")
    await waitFor(() => expect(campoValor()).toHaveValue("2.500,00"))

    digitarValor("300000") // 3.000,00
    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(atualizarSaldoInicial).toHaveBeenCalledWith("conta-001", { valor: 3000, data: "2026-03-10" }))
  })

  it("salvar sem mexer em nada (marco derivado pré-preenchido) reenvia os valores do marco", async () => {
    listMarcos.mockResolvedValue([marcoPartida()])
    await abrirPagina()
    fireEvent.click(botaoSaldoConta("Nubank Corrente"))
    await modal("Nubank Corrente")
    await waitFor(() => expect(campoValor()).toHaveValue("2.500,00"))

    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(atualizarSaldoInicial).toHaveBeenCalledWith("conta-001", { valor: 2500, data: "2026-03-10" }))
  })

  it("Carteira: salvar chama atualizarSaldoInicial com o id da Carteira, toast de sucesso e saldo novo na tela", async () => {
    getContas
      .mockResolvedValueOnce([makeCarteira({ saldoAtual: 0 }), makeConta(), contaB])
      .mockResolvedValue([makeCarteira({ saldoAtual: 1000 }), makeConta(), contaB])
    await abrirPagina()
    expect(screen.queryByText(/R\$\s?1\.000,00/)).not.toBeInTheDocument()

    fireEvent.click(botaoSaldoCarteira())
    await modal("Carteira")
    await waitFor(() => expect(botaoSalvar()).toBeEnabled())
    digitarValor("100000")
    fireEvent.click(botaoSalvar())

    await waitFor(() => expect(atualizarSaldoInicial).toHaveBeenCalledWith("carteira-001", { valor: 1000, data: HOJE_ISO }))
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: "Saldo inicial salvo" })))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect((await screen.findAllByText(/R\$\s?1\.000,00/)).length).toBeGreaterThanOrEqual(1)
  })

  it("dá pra mudar o Desde pelo calendário e a data nova vai no payload", async () => {
    await abrirPagina()
    await abrirModalConta()
    digitarValor("10000")

    fireEvent.click(botaoDesde(HOJE_LABEL))
    const calendario = await screen.findByRole("dialog", { name: "Escolher data" })
    fireEvent.click(within(calendario).getByRole("button", { name: "12" }))
    expect(botaoDesde("12/06/2026")).toBeInTheDocument()

    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(atualizarSaldoInicial).toHaveBeenCalledWith("conta-001", { valor: 100, data: "2026-06-12" }))
  })

  it("o Desde não aceita data futura (máx. hoje): clicar num dia depois de hoje é ignorado", async () => {
    await abrirPagina()
    await abrirModalConta()
    digitarValor("10000")

    fireEvent.click(botaoDesde(HOJE_LABEL))
    const calendario = await screen.findByRole("dialog", { name: "Escolher data" })
    fireEvent.click(within(calendario).getByRole("button", { name: "25" }))
    expect(botaoDesde(HOJE_LABEL)).toBeInTheDocument() // não mudou

    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(atualizarSaldoInicial).toHaveBeenCalledWith("conta-001", { valor: 100, data: HOJE_ISO }))
  })

  it("Salvar em andamento: botão fica desabilitado (clique duplo não duplica o envio) e o modal fecha quando conclui", async () => {
    const envio = adiado<void>()
    atualizarSaldoInicial.mockReturnValue(envio.promessa)
    await abrirPagina()
    await abrirModalConta()
    digitarValor("10000")

    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(botaoSalvar()).toBeDisabled())
    fireEvent.click(botaoSalvar())
    expect(atualizarSaldoInicial).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("dialog", { name: "Saldo inicial — Nubank Corrente" })).toBeInTheDocument()

    await act(async () => { envio.resolver() })
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(atualizarSaldoInicial).toHaveBeenCalledTimes(1)
  })

  // ---------------------------------------------------------------- erro do servidor

  it("erro do servidor: toast 'Erro ao salvar o saldo inicial', o modal segue aberto com o que foi digitado, sem recarregar", async () => {
    atualizarSaldoInicial.mockRejectedValue(new Error("boom"))
    await abrirPagina()
    await abrirModalConta()
    digitarValor("100000")

    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith({ open: true, message: "Erro ao salvar o saldo inicial", severity: "error" }))
    expect(modalAberto()).toBeInTheDocument()
    expect(campoValor()).toHaveValue("1.000,00") // nada perdido
    expect(botaoDesde(HOJE_LABEL)).toBeInTheDocument()
    await waitFor(() => expect(botaoSalvar()).toBeEnabled()) // dá pra tentar de novo
    expect(getContas).toHaveBeenCalledTimes(1) // não recarregou
    expect(mockNotify).not.toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))
    // erro de servidor é toast, não erro de campo
    expect(within(modalAberto()).queryByText("Informe um valor maior que zero")).not.toBeInTheDocument()
  })

  it("depois de um erro do servidor, tentar de novo funciona e fecha o modal", async () => {
    atualizarSaldoInicial.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined)
    await abrirPagina()
    await abrirModalConta()
    digitarValor("100000")

    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error" })))
    await waitFor(() => expect(botaoSalvar()).toBeEnabled())

    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(atualizarSaldoInicial).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(mockNotify).toHaveBeenLastCalledWith(expect.objectContaining({ severity: "success", message: "Saldo inicial salvo" })))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  // ---------------------------------------------------------------- cancelar / fechar

  it("Cancelar fecha o modal sem salvar e sem toast", async () => {
    await abrirPagina()
    await abrirModalConta()
    digitarValor("99900")

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(atualizarSaldoInicial).not.toHaveBeenCalled()
    expect(mockNotify).not.toHaveBeenCalled()
    expect(getContas).toHaveBeenCalledTimes(1)
  })

  it("o X ('Fechar') e a tecla Esc também fecham sem salvar", async () => {
    await abrirPagina()
    await abrirModalConta()
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

    await abrirModalConta()
    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(atualizarSaldoInicial).not.toHaveBeenCalled()
  })

  it("reabrir depois de cancelar começa limpo: o que foi digitado antes não volta", async () => {
    await abrirPagina()
    await abrirModalConta()
    digitarValor("99900")
    fireEvent.click(botaoDesde(HOJE_LABEL))
    const calendario = await screen.findByRole("dialog", { name: "Escolher data" })
    fireEvent.click(within(calendario).getByRole("button", { name: "12" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

    await abrirModalConta()
    expect(campoValor()).toHaveValue("")
    expect(botaoDesde(HOJE_LABEL)).toBeInTheDocument()
  })

  // ---------------------------------------------------------------- proteção de corrida (A → fecha → B)

  describe("corrida: resposta atrasada de uma conta não vaza pro formulário de outra", () => {
    it("abre A, fecha e abre B: a resposta atrasada de A NÃO preenche o form de B (B já tinha o dele)", async () => {
      const buscaA = adiado<ReconciliacaoMarco[]>()
      const buscaB = adiado<ReconciliacaoMarco[]>()
      listMarcos.mockImplementation((id: string) => (id === "conta-001" ? buscaA.promessa : buscaB.promessa))
      await abrirPagina()

      fireEvent.click(botaoSaldoConta("Nubank Corrente")) // A, busca em voo
      await modal("Nubank Corrente")
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

      fireEvent.click(botaoSaldoConta("Itaú Poupança")) // B
      await modal("Itaú Poupança")
      await act(async () => {
        buscaB.resolver([marcoPartida({ contaId: "conta-002", saldoDeclarado: 1000, dataHora: "2026-02-01T12:00:00.000Z" })])
      })
      await waitFor(() => expect(campoValor()).toHaveValue("1.000,00"))
      expect(botaoDesde("01/02/2026")).toBeInTheDocument()

      // chega a resposta velha de A (2.500,00 em 10/03/2026)
      await act(async () => { buscaA.resolver([marcoPartida()]) })

      expect(modalAberto()).toHaveAccessibleName("Saldo inicial — Itaú Poupança")
      expect(campoValor()).toHaveValue("1.000,00") // continua o de B
      expect(botaoDesde("01/02/2026")).toBeInTheDocument()
      expect(botaoSalvar()).toBeEnabled()

      // e salvar grava na conta B com os valores de B
      fireEvent.click(botaoSalvar())
      await waitFor(() => expect(atualizarSaldoInicial).toHaveBeenCalledTimes(1))
      expect(atualizarSaldoInicial).toHaveBeenCalledWith("conta-002", { valor: 1000, data: "2026-02-01" })
    })

    it("a resposta atrasada de A chega com a busca de B ainda em voo: B segue carregando (vazio e desabilitado) até a dele chegar", async () => {
      const buscaA = adiado<ReconciliacaoMarco[]>()
      const buscaB = adiado<ReconciliacaoMarco[]>()
      listMarcos.mockImplementation((id: string) => (id === "conta-001" ? buscaA.promessa : buscaB.promessa))
      await abrirPagina()

      fireEvent.click(botaoSaldoConta("Nubank Corrente"))
      await modal("Nubank Corrente")
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
      fireEvent.click(botaoSaldoConta("Itaú Poupança"))
      await modal("Itaú Poupança")

      await act(async () => { buscaA.resolver([marcoPartida()]) })
      expect(campoValor()).toHaveValue("") // não herdou 2.500,00 de A
      expect(campoValor()).toBeDisabled() // ainda esperando B
      expect(botaoSalvar()).toBeDisabled()
      expect(botaoDesde(HOJE_LABEL)).toBeInTheDocument() // não herdou 10/03/2026 de A

      await act(async () => {
        buscaB.resolver([marcoPartida({ contaId: "conta-002", saldoDeclarado: 800, dataHora: "2026-01-15T12:00:00.000Z" })])
      })
      await waitFor(() => expect(campoValor()).toHaveValue("800,00"))
      expect(campoValor()).toBeEnabled()
      expect(botaoSalvar()).toBeEnabled()
      expect(botaoDesde("15/01/2026")).toBeInTheDocument()
    })

    it("a busca atrasada de A FALHANDO também não libera o form de B antes da hora", async () => {
      const buscaA = adiado<ReconciliacaoMarco[]>()
      const buscaB = adiado<ReconciliacaoMarco[]>()
      listMarcos.mockImplementation((id: string) => (id === "conta-001" ? buscaA.promessa : buscaB.promessa))
      await abrirPagina()

      fireEvent.click(botaoSaldoConta("Nubank Corrente"))
      await modal("Nubank Corrente")
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
      fireEvent.click(botaoSaldoConta("Itaú Poupança"))
      await modal("Itaú Poupança")

      await act(async () => { buscaA.rejeitar(new Error("boom")) })
      expect(campoValor()).toBeDisabled()
      expect(botaoSalvar()).toBeDisabled()

      await act(async () => { buscaB.resolver([]) })
      await waitFor(() => expect(campoValor()).toBeEnabled())
      expect(botaoSalvar()).toBeEnabled()
    })

    it("a resposta chega DEPOIS de fechar o modal: nada reabre e a próxima abertura começa do zero", async () => {
      const buscaA = adiado<ReconciliacaoMarco[]>()
      listMarcos.mockReturnValueOnce(buscaA.promessa).mockResolvedValue([])
      await abrirPagina()

      fireEvent.click(botaoSaldoConta("Nubank Corrente"))
      await modal("Nubank Corrente")
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

      await act(async () => { buscaA.resolver([marcoPartida()]) })
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

      await abrirModalConta()
      expect(campoValor()).toHaveValue("") // a resposta velha não ficou grudada
      expect(botaoDesde(HOJE_LABEL)).toBeInTheDocument()
    })
  })
})
