import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { PontesThemeProvider } from "../../components/pontes"
import ParcelamentosPage from "../../pages/Parcelamentos/index"
import type { Parcelamento } from "../../types/Parcelamento"
import type { CartaoCredito } from "../../types/CartaoCredito"

const notifySpy = vi.hoisted(() => vi.fn())
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ notify: notifySpy }),
  useNavigate: () => vi.fn(),
}))

const listarPaginado = vi.fn()
const obterStats = vi.fn().mockResolvedValue({ ativos: 1, totalRestante: 2400, qtdTotal: 1 })
const criar = vi.fn()
const cancelar = vi.fn()
vi.mock("../../services/ParcelamentoService", () => ({
  ParcelamentoService: {
    listarPaginado: (...a: unknown[]) => listarPaginado(...a),
    obterStats: (...a: unknown[]) => obterStats(...a),
    listar: () => Promise.resolve([]),
    criar: (...a: unknown[]) => criar(...a),
    cancelar: (...a: unknown[]) => cancelar(...a),
  },
}))
const paged = <T,>(items: T[]) => ({
  items, total: items.length, page: 1, pageSize: 100, totalPages: 1,
})
vi.mock("../../services/cartaoCreditoService", () => ({
  getCartoes: () => Promise.resolve(cartoes),
}))

const cartoes = [
  { id: "c1", nome: "Nubank", temCredito: true, diaFechamento: 10, diaVencimento: 20 },
] as unknown as CartaoCredito[]

// Fatura que fecha 28/06 e vence 05/07: o card mostra a fatura pelo FECHAMENTO (Junho, como em
// Cartões), não pelo mês do vencimento.
const p1 = {
  id: "p1", descricao: "Notebook", valorOriginal: 3000, valorPago: 600,
  valorRestante: 2400, quantidadeParcelas: 10, parcelasPagas: 2,
  tipo: 0, ativo: true,
  proximaParcela: {
    dataVencimento: "2026-07-05T00:00:00", faturaMesReferencia: "2026-06-28T00:00:00",
    faturaDataVencimento: "2026-07-05T00:00:00", valor: 300,
  },
} as unknown as Parcelamento

function renderPage() {
  return render(
    <MemoryRouter>
      <PontesThemeProvider><ParcelamentosPage /></PontesThemeProvider>
    </MemoryRouter>
  )
}

describe("ParcelamentosPage (#153)", () => {
  beforeEach(() => {
    listarPaginado.mockReset().mockResolvedValue(paged([p1]))
    criar.mockReset().mockResolvedValue(undefined)
    cancelar.mockReset().mockResolvedValue(undefined)
    notifySpy.mockReset()
  })

  it("lista parcelamentos + stats", async () => {
    renderPage()
    expect(await screen.findByText("Notebook")).toBeInTheDocument()
    expect(screen.getByText("Ativos")).toBeInTheDocument()
    expect(screen.getByText("A pagar")).toBeInTheDocument()
    expect(screen.getByText(/Fatura Junho de 2026/)).toBeInTheDocument()
  })

  it("empty state", async () => {
    listarPaginado.mockReset().mockResolvedValue(paged([]))
    renderPage()
    expect(await screen.findByText("Nenhum parcelamento cadastrado")).toBeInTheDocument()
  })

  it("valida form vazio (descrição, valor, cartão)", async () => {
    renderPage()
    await screen.findByText("Notebook")
    fireEvent.click(screen.getByText("Novo Parcelamento"))
    await screen.findByText("Novo parcelamento")
    fireEvent.click(screen.getByText("Criar"))
    expect(await screen.findByText("Informe a descrição")).toBeInTheDocument()
    expect(screen.getByText("Informe o valor")).toBeInTheDocument()
    expect(screen.getAllByText("Selecione o cartão").length).toBeGreaterThan(0)
    expect(criar).not.toHaveBeenCalled()
  })

  // Regressão do 409: o form mandava `taxaJuroMensal: 0` INCONDICIONAL, e o backend rejeita
  // qualquer taxa fora de PIX Crédito → criar Compra Parcelada era impossível pela UI.
  // O mock antigo aceitava qualquer payload e nunca conferia — por isso passava batido.
  it("Compra Parcelada NÃO envia taxaJuroMensal (regressão do 409)", async () => {
    renderPage()
    await screen.findByText("Notebook")
    fireEvent.click(screen.getByText("Novo Parcelamento"))
    await screen.findByText("Novo parcelamento")

    fireEvent.change(screen.getByPlaceholderText("Ex: Notebook, Monitor"), { target: { value: "Geladeira" } })
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "300000" } })
    fireEvent.click(screen.getByText("Selecione o cartão"))
    fireEvent.click(await screen.findByText("Nubank"))
    fireEvent.click(screen.getByText("Criar"))

    await waitFor(() => expect(criar).toHaveBeenCalledTimes(1))
    const payload = criar.mock.calls[0][0] as { tipo: number; taxaJuroMensal?: number }
    expect(payload.tipo).toBe(0)                     // CompraParcelada
    expect(payload.taxaJuroMensal).toBeUndefined()   // não manda 0 → não dispara 409
  })

  // Bug de dinheiro (2026-09-28): a Idempotency-Key nascia a cada clique em "Criar" — se a rede caísse
  // depois de o servidor gravar, tentar de novo criava OUTRO parcelamento. Agora a chave é da janela.
  it("tentar de novo na mesma janela reusa a Idempotency-Key; abrir a janela de novo gera outra", async () => {
    criar.mockReset().mockRejectedValueOnce(new Error("Network Error")).mockResolvedValue(undefined)
    renderPage()
    await screen.findByText("Notebook")
    const preencherECriar = async () => {
      fireEvent.change(screen.getByPlaceholderText("Ex: Notebook, Monitor"), { target: { value: "Geladeira" } })
      fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "300000" } })
      fireEvent.click(screen.getByText("Selecione o cartão"))
      fireEvent.click(await screen.findByText("Nubank"))
      fireEvent.click(screen.getByText("Criar"))
    }
    fireEvent.click(screen.getByText("Novo Parcelamento"))
    await screen.findByText("Novo parcelamento")
    await preencherECriar()
    await waitFor(() => expect(criar).toHaveBeenCalledTimes(1)) // caiu a rede
    fireEvent.click(screen.getByText("Criar"))                  // tenta de novo, mesma janela
    await waitFor(() => expect(criar).toHaveBeenCalledTimes(2))
    const [k1, k2] = criar.mock.calls.map((c) => (c[0] as { idempotencyKey: string }).idempotencyKey)
    expect(k1).toBeTruthy()
    expect(k2).toBe(k1)

    // a 2ª deu certo e fechou a janela; um parcelamento NOVO é outra intenção → outra chave
    await waitFor(() => expect(screen.queryByText("Novo parcelamento")).not.toBeInTheDocument())
    fireEvent.click(screen.getByText("Novo Parcelamento"))
    await screen.findByText("Novo parcelamento")
    await preencherECriar()
    await waitFor(() => expect(criar).toHaveBeenCalledTimes(3))
    expect((criar.mock.calls[2][0] as { idempotencyKey: string }).idempotencyKey).not.toBe(k1)
  })

  it("PIX Crédito continua enviando a taxaJuroMensal informada", async () => {
    renderPage()
    await screen.findByText("Notebook")
    fireEvent.click(screen.getByText("Novo Parcelamento"))
    await screen.findByText("Novo parcelamento")

    fireEvent.change(screen.getByPlaceholderText("Ex: Notebook, Monitor"), { target: { value: "PIX compra" } })
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "300000" } })
    fireEvent.click(screen.getByText("Selecione o cartão"))
    fireEvent.click(await screen.findByText("Nubank"))

    // Tipo → PIX Crédito. O trigger do select mostra "Compra Parcelada" (o padrão). O card da lista
    // não tem mais essa tag, mas pega o último por segurança caso volte a aparecer.
    const triggers = screen.getAllByText("Compra Parcelada")
    fireEvent.click(triggers[triggers.length - 1])
    fireEvent.click(await screen.findByText("PIX Crédito"))

    // Campo de taxa aparece: 2º spinbutton (o 1º é Parcelas).
    const spins = screen.getAllByRole("spinbutton")
    fireEvent.change(spins[spins.length - 1], { target: { value: "2.5" } })
    fireEvent.click(screen.getByText("Criar"))

    await waitFor(() => expect(criar).toHaveBeenCalledTimes(1))
    const payload = criar.mock.calls[0][0] as { tipo: number; taxaJuroMensal?: number }
    expect(payload.tipo).toBe(1)                 // PIXCredito
    expect(payload.taxaJuroMensal).toBe(2.5)
  })

  it("parcelamento cancelado mostra 'Cancelado' escrito (não só o cinza); lista não tem cancelar", async () => {
    listarPaginado.mockReset().mockResolvedValue(paged([p1, { ...p1, id: "p2", descricao: "Livro", ativo: false }]))
    renderPage()
    expect(await screen.findByText("Livro")).toBeInTheDocument()
    expect(screen.getAllByText("Cancelado")).toHaveLength(1)
    // Cancelar mora só no detalhe.
    expect(screen.queryByLabelText("Cancelar parcelamento")).not.toBeInTheDocument()
  })

  it("card da lista não mostra a tag 'Compra Parcelada' (tipo padrão)", async () => {
    renderPage()
    await screen.findByText("Notebook")
    expect(screen.queryByText("Compra Parcelada")).not.toBeInTheDocument()
  })

  // Caso real (dogfooding): parcelamento maior que o limite do cartão. O backend responde 409 com
  // uma mensagem clara; antes a tela mostrava "Erro ao criar parcelamento" em vermelho e escondia o motivo.
  it("limite insuficiente vira AVISO com a mensagem do servidor, não erro genérico", async () => {
    const msg = "Limite insuficiente. Precisa de R$ 1.000.000,00, disponível R$ 1.500,00."
    criar.mockReset().mockRejectedValue({
      response: { status: 409, data: { message: msg, code: "BUSINESS_RULE_VIOLATION" } },
    })
    renderPage()
    await screen.findByText("Notebook")
    fireEvent.click(screen.getByText("Novo Parcelamento"))
    await screen.findByText("Novo parcelamento")
    fireEvent.change(screen.getByPlaceholderText("Ex: Notebook, Monitor"), { target: { value: "Geladeira" } })
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "100000000" } })
    fireEvent.click(screen.getByText("Selecione o cartão"))
    fireEvent.click(await screen.findByText("Nubank"))
    fireEvent.click(screen.getByText("Criar"))

    await waitFor(() => expect(notifySpy).toHaveBeenCalledWith({ open: true, severity: "warning", message: msg }))
  })

  // Bug de dinheiro (2026-09-28): "primeira parcela: outubro" com compra depois do fechamento caía
  // uma fatura depois. Agora o mês é o da fatura em que ela FECHA, e o campo é o PontesMonthInput
  // (o <input type="month"> abria o seletor nativo do navegador, fora do DS).
  describe("primeira parcela = fatura da compra (mês em que ela fecha)", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] })
      vi.setSystemTime(new Date(2026, 8, 28, 12)) // compra "hoje" = 28/09/2026
    })
    afterEach(() => { vi.useRealTimers() })

    async function abrirForm() {
      renderPage()
      await screen.findByText("Notebook")
      fireEvent.click(screen.getByText("Novo Parcelamento"))
      await screen.findByText("Novo parcelamento")
      fireEvent.change(screen.getByPlaceholderText("Ex: Notebook, Monitor"), { target: { value: "Geladeira" } })
      fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "300000" } })
    }
    const escolherCartao = async () => {
      fireEvent.click(screen.getByText("Selecione o cartão"))
      fireEvent.click(await screen.findByText("Nubank"))
    }

    it("sugere a fatura em que a compra cai no cartão escolhido e envia esse mês", async () => {
      await abrirForm()
      // Sem cartão: mês da compra.
      expect(screen.getByRole("button", { name: "Setembro de 2026" })).toBeInTheDocument()

      // Nubank fecha dia 10: compra de 28/09 já cai na fatura que fecha em outubro.
      await escolherCartao()
      expect(screen.getByRole("button", { name: "Outubro de 2026" })).toBeInTheDocument()

      // Mínimo do seletor = a fatura da compra: setembro aparece desabilitado.
      fireEvent.click(screen.getByRole("button", { name: "Outubro de 2026" }))
      expect(screen.getByRole("button", { name: "Setembro de 2026" })).toBeDisabled()
      fireEvent.click(screen.getByRole("button", { name: "Outubro de 2026", pressed: true }))

      fireEvent.click(screen.getByText("Criar"))
      await waitFor(() => expect(criar).toHaveBeenCalledTimes(1))
      expect(criar.mock.calls[0][0].primeiraParcelaMes).toBe("2026-10")
    })

    it("escolha manual não é sobrescrita ao trocar o cartão; antes da fatura da compra bloqueia no campo", async () => {
      await abrirForm()
      fireEvent.click(screen.getByRole("button", { name: "Setembro de 2026" }))
      fireEvent.click(screen.getByRole("button", { name: "Setembro de 2026", pressed: true }))

      await escolherCartao()
      expect(screen.getByRole("button", { name: "Setembro de 2026" })).toBeInTheDocument()

      fireEvent.click(screen.getByText("Criar"))
      expect(await screen.findByText("Não pode ser antes da fatura da compra (Outubro de 2026)")).toBeInTheDocument()
      expect(criar).not.toHaveBeenCalled()
    })

    // Compra retroativa: a fatura da compra (julho) e as seguintes até setembro já VENCERAM. Parcela
    // nelas nasceria pendente numa fatura vencida (juros/multa) ou já paga — começa na 1ª não vencida.
    const mudarCompraPara15DeJunho = () => {
      fireEvent.click(screen.getByRole("button", { name: "28/09/2026" }))
      for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: "‹" }))
      fireEvent.click(screen.getByRole("button", { name: "15" }))
      expect(screen.getByRole("button", { name: "15/06/2026" })).toBeInTheDocument()
    }

    it("compra antiga: sugere a 1ª fatura não vencida e desabilita as vencidas", async () => {
      await abrirForm()
      mudarCompraPara15DeJunho()
      await escolherCartao()
      expect(screen.getByRole("button", { name: "Outubro de 2026" })).toBeInTheDocument()

      fireEvent.click(screen.getByRole("button", { name: "Outubro de 2026" }))
      expect(screen.getByRole("button", { name: "Julho de 2026" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Setembro de 2026" })).toBeDisabled()
      fireEvent.click(screen.getByRole("button", { name: "Outubro de 2026", pressed: true }))

      fireEvent.click(screen.getByText("Criar"))
      await waitFor(() => expect(criar).toHaveBeenCalledTimes(1))
      expect(criar.mock.calls[0][0].primeiraParcelaMes).toBe("2026-10")
      expect(criar.mock.calls[0][0].dataCompra).toBe("2026-06-15")
    })

    // Compra em andamento ("estou na 4 de 12" → 3 já pagas): só as que faltam entram. O campo do mês vira
    // a PRÓXIMA a pagar; o backend recebe o mês da parcela 1 e quantas já foram pagas.
    const jaPagas = () => screen.getByLabelText("Parcelas já pagas")

    it("compra em andamento: campo vira 'Próxima parcela', sugere a aberta e manda o mês da parcela 1", async () => {
      await abrirForm()
      mudarCompraPara15DeJunho() // fatura de julho
      await escolherCartao()
      fireEvent.change(screen.getByDisplayValue("3"), { target: { value: "12" } }) // parcelas
      fireEvent.change(jaPagas(), { target: { value: "3" } })

      expect(screen.getByText("Próxima parcela (mês)")).toBeInTheDocument()
      expect(screen.queryByText("Primeira parcela (mês)")).not.toBeInTheDocument()
      // Julho + 3 pagas = outubro, que é a aberta (28/09, fecha dia 10).
      fireEvent.click(screen.getByRole("button", { name: "Outubro de 2026" }))
      expect(screen.getByRole("button", { name: "Novembro de 2026" })).toBeDisabled() // depois da aberta
      fireEvent.click(screen.getByRole("button", { name: "Outubro de 2026", pressed: true }))

      fireEvent.click(screen.getByText("Criar"))
      await waitFor(() => expect(criar).toHaveBeenCalledTimes(1))
      expect(criar.mock.calls[0][0]).toMatchObject({
        parcelas: 12, parcelasJaPagas: 3, primeiraParcelaMes: "2026-07", dataCompra: "2026-06-15",
      })
    })

    it("compra de hoje não tem parcela paga: bloqueia nas já pagas", async () => {
      await abrirForm()
      await escolherCartao()
      fireEvent.change(jaPagas(), { target: { value: "1" } })

      fireEvent.click(screen.getByText("Criar"))
      expect(await screen.findByText("Compra dessa data ainda não tem parcela paga")).toBeInTheDocument()
      expect(criar).not.toHaveBeenCalled()
    })

    it("compra antiga com mais já pagas do que faturas desde a compra: diz o máximo", async () => {
      await abrirForm()
      mudarCompraPara15DeJunho() // julho → outubro (aberta): no máximo 3 pagas
      await escolherCartao()
      fireEvent.change(screen.getByDisplayValue("3"), { target: { value: "12" } })
      fireEvent.change(jaPagas(), { target: { value: "4" } })

      fireEvent.click(screen.getByText("Criar"))
      expect(await screen.findByText("Compra dessa data tem no máximo 3 já pagas")).toBeInTheDocument()
      expect(criar).not.toHaveBeenCalled()
    })

    it("já pagas não pode cobrir todas as parcelas", async () => {
      await abrirForm()
      await escolherCartao()
      fireEvent.change(jaPagas(), { target: { value: "3" } }) // 3 de 3

      fireEvent.click(screen.getByText("Criar"))
      expect(await screen.findByText("Precisa sobrar pelo menos 1 parcela")).toBeInTheDocument()
      expect(criar).not.toHaveBeenCalled()
    })

    it("compra nova manda zero já pagas e o próprio mês como o da parcela 1", async () => {
      await abrirForm()
      await escolherCartao()

      fireEvent.click(screen.getByText("Criar"))
      await waitFor(() => expect(criar).toHaveBeenCalledTimes(1))
      expect(criar.mock.calls[0][0]).toMatchObject({ parcelasJaPagas: 0, primeiraParcelaMes: "2026-10" })
    })

    it("compra antiga com mês escolhido numa fatura vencida bloqueia no campo", async () => {
      await abrirForm()
      fireEvent.click(screen.getByRole("button", { name: "Setembro de 2026" }))
      fireEvent.click(screen.getByRole("button", { name: "Setembro de 2026", pressed: true }))
      mudarCompraPara15DeJunho()
      await escolherCartao()

      fireEvent.click(screen.getByText("Criar"))
      expect(await screen.findByText("Não pode ser antes da fatura de Outubro de 2026 — as anteriores já venceram")).toBeInTheDocument()
      expect(criar).not.toHaveBeenCalled()
    })
  })
})
