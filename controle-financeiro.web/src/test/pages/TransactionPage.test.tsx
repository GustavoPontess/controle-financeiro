import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { PontesThemeProvider } from "../../components/pontes"
import TransactionPage from "../../pages/Transactions/TransactionPage"
import { createTransferencia } from "../../services/transferenciaService"
import { createTransaction, deleteTransaction, getTransaction, updateTransaction } from "../../services/transactionService"
import { dataLocalISO } from "../../utils/dateTime"
import type { Transaction } from "../../types/Transaction"

const notify = vi.hoisted(() => vi.fn())
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ notify }),
}))
vi.mock("../../services/categoryService", () => ({
  getCategories: vi.fn().mockResolvedValue([{ id: "c1", descricao: "Alimentação", finalidade: 1, isPadrao: true }]),
}))
vi.mock("../../services/subcategoryService", () => ({ getSubcategories: vi.fn().mockResolvedValue([]) }))
vi.mock("../../services/contaService", () => ({
  getContas: vi.fn().mockResolvedValue([{ id: "a1", nome: "Nubank" }, { id: "a2", nome: "Itaú" }]),
}))
vi.mock("../../services/cartaoCreditoService", () => ({ getCartoes: vi.fn().mockResolvedValue([]) }))
vi.mock("../../services/transferenciaService", () => ({ createTransferencia: vi.fn().mockResolvedValue({}) }))
vi.mock("../../services/recorrenteService", () => ({ createRecorrente: vi.fn().mockResolvedValue({}) }))
vi.mock("../../services/faturaService", () => ({ estornarPagamento: vi.fn().mockResolvedValue({}) }))
vi.mock("../../services/transactionService", () => ({
  createTransaction: vi.fn().mockResolvedValue({}),
  updateTransaction: vi.fn().mockResolvedValue(undefined),
  deleteTransaction: vi.fn().mockResolvedValue(undefined),
  getTransaction: vi.fn(),
}))

// Lançamento com data ("YYYY-MM-DD") e hora ("HH:MM:SS" | null) SEPARADAS — o shape da Transaction.
const base: Transaction = {
  id: "t1", descricao: "Mercado", valor: 250, tipo: 1, categoriaId: "c1", contaId: "a1", contaNome: "Nubank",
  meioPagamento: 2, meioPagamentoDescricao: "Débito", statusTransacao: 1, data: "2026-05-21", hora: "14:32:00",
}

/** A página nas três rotas + destinos de volta (a lista e o dashboard) pra conferir pra onde ela leva. */
function renderEm(caminho: string, state?: object) {
  render(
    <PontesThemeProvider>
      <MemoryRouter initialEntries={[{ pathname: caminho, state }]}>
        <Routes>
          <Route path="/transactions/nova" element={<TransactionPage />} />
          <Route path="/transactions/:id" element={<TransactionPage />} />
          <Route path="/transactions/:id/editar" element={<TransactionPage />} />
          <Route path="/transactions" element={<div>Lista de transações</div>} />
          <Route path="/dashboard" element={<div>Tela do dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </PontesThemeProvider>,
  )
}

const campoHora = () => screen.getByPlaceholderText("HH:MM") as HTMLInputElement

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getTransaction).mockResolvedValue(base)
  vi.mocked(updateTransaction).mockResolvedValue(undefined)
})

describe("TransactionPage — criar (/transactions/nova, substitui o popup)", () => {
  it("Transferência chama createTransferencia com origem/destino/valor e volta pra tela de onde veio", async () => {
    renderEm("/transactions/nova", { voltarPara: "/dashboard" })
    expect(await screen.findByRole("heading", { name: "Nova transação" })).toBeInTheDocument()
    fireEvent.click(screen.getByText("Transferência"))
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "10000" } }) // → 100,00
    fireEvent.click(await screen.findByText("De qual conta"))
    fireEvent.click(screen.getByText("Nubank"))
    fireEvent.click(screen.getByText("Para qual conta"))
    fireEvent.click(screen.getByText("Itaú"))
    fireEvent.change(screen.getByPlaceholderText("Ex: Reserva de emergência"), { target: { value: "Mover grana" } })

    fireEvent.click(screen.getByText("Transferir"))

    await waitFor(() => expect(createTransferencia).toHaveBeenCalledTimes(1))
    expect(createTransferencia).toHaveBeenCalledWith(expect.objectContaining({ contaOrigemId: "a1", contaDestinoId: "a2", valor: 100 }))
    expect(createTransaction).not.toHaveBeenCalled()
    expect(await screen.findByText("Tela do dashboard")).toBeInTheDocument()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: "Transferência criada com sucesso" }))
  })

  it("Transferência só com a origem (destino vazio) não envia", async () => {
    renderEm("/transactions/nova")
    await screen.findByText("Despesa")
    fireEvent.click(screen.getByText("Transferência"))
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "5000" } })
    fireEvent.click(await screen.findByText("De qual conta"))
    fireEvent.click(screen.getByText("Nubank"))
    fireEvent.click(screen.getByText("Transferir"))

    await waitFor(() => expect(createTransferencia).not.toHaveBeenCalled())
  })

  async function preencherDespesa(hora?: string) {
    await screen.findByText("Despesa")
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "5000" } }) // 50,00
    if (hora !== undefined) fireEvent.change(campoHora(), { target: { value: hora } })
    fireEvent.click(await screen.findByText("Selecione a conta"))
    fireEvent.click(screen.getByText("Nubank"))
    fireEvent.click(screen.getByText("Selecione a categoria"))
    fireEvent.click(await screen.findByText("Alimentação"))
    fireEvent.change(screen.getByPlaceholderText("Ex: Compra no mercado"), { target: { value: "Mercado" } })
  }

  it("despesa única manda data ('YYYY-MM-DD') e hora ('HH:MM:SS') SEPARADAS e volta pra lista", async () => {
    renderEm("/transactions/nova")
    await preencherDespesa("0915")

    fireEvent.click(screen.getByText("Adicionar"))

    await waitFor(() => expect(createTransaction).toHaveBeenCalledTimes(1))
    const payload = vi.mocked(createTransaction).mock.calls[0][0]
    expect(payload.data).toBe(dataLocalISO()) // só o dia (hoje por padrão), sem "T" nem fuso
    expect(payload.hora).toBe("09:15:00")
    expect(payload).toMatchObject({ descricao: "Mercado", valor: 50, tipo: 1, contaId: "a1", categoriaId: "c1" })
    expect(await screen.findByText("Lista de transações")).toBeInTheDocument() // sem "voltarPara" → a lista
  })

  it("sem mexer na hora, o default (agora, HH:MM) é válido e vai como 'HH:MM:00'", async () => {
    renderEm("/transactions/nova")
    await preencherDespesa()
    fireEvent.click(screen.getByText("Adicionar"))
    await waitFor(() => expect(createTransaction).toHaveBeenCalledTimes(1))
    expect(vi.mocked(createTransaction).mock.calls[0][0].hora).toMatch(/^\d{2}:\d{2}:00$/)
  })

  it("hora vazia bloqueia o envio: 'Informe a hora' no campo e nada é criado", async () => {
    renderEm("/transactions/nova")
    await preencherDespesa("")
    fireEvent.click(screen.getByText("Adicionar"))
    expect(await screen.findByText("Informe a hora")).toBeInTheDocument()
    expect(createTransaction).not.toHaveBeenCalled()
  })

  it("Cancelar e Voltar levam pra tela de onde veio, sem criar nada", async () => {
    renderEm("/transactions/nova", { voltarPara: "/dashboard" })
    await screen.findByText("Despesa")
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(await screen.findByText("Tela do dashboard")).toBeInTheDocument()
    expect(createTransaction).not.toHaveBeenCalled()
  })

  it("erro do servidor: toast de erro e o formulário fica (não navega)", async () => {
    vi.mocked(createTransaction).mockRejectedValueOnce(new Error("boom"))
    renderEm("/transactions/nova")
    await preencherDespesa()
    fireEvent.click(screen.getByText("Adicionar"))
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error", message: "Erro ao salvar" })))
    expect(screen.getByRole("heading", { name: "Nova transação" })).toBeInTheDocument()
  })
})

describe("TransactionPage — ver (/transactions/:id)", () => {
  it("mostra a transação: valor, data e hora (sem fuso), conta, meio, categoria e os selos", async () => {
    renderEm("/transactions/t1")
    expect(await screen.findByRole("heading", { name: "Mercado" })).toBeInTheDocument()
    expect(screen.getByText(/R\$\s?250,00/)).toBeInTheDocument()
    expect(screen.getByText("21/05/2026 às 14:32")).toBeInTheDocument()
    expect(screen.getByText("Nubank")).toBeInTheDocument()
    expect(screen.getByText("Débito")).toBeInTheDocument()
    expect(await screen.findByText("Alimentação")).toBeInTheDocument()
    expect(screen.getByText("Despesa")).toBeInTheDocument()
    expect(screen.getByText("Efetivado")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Excluir" })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText("HH:MM")).not.toBeInTheDocument() // não é formulário
  })

  it("sem hora (null) mostra só o dia", async () => {
    vi.mocked(getTransaction).mockResolvedValue({ ...base, hora: null })
    renderEm("/transactions/t1")
    expect(await screen.findByText("21/05/2026")).toBeInTheDocument()
  })

  it("excluir pede confirmação, exclui e volta pra lista", async () => {
    renderEm("/transactions/t1")
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }))
    const dialogo = await screen.findByRole("alertdialog", { name: "Excluir transação?" })
    expect(deleteTransaction).not.toHaveBeenCalled()
    fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir" }))
    await waitFor(() => expect(deleteTransaction).toHaveBeenCalledWith("t1"))
    expect(await screen.findByText("Lista de transações")).toBeInTheDocument()
  })

  it("pagamento de fatura: sem Editar nem Excluir — só 'Estornar pagamento'; e /editar nele mostra a tela de ver", async () => {
    vi.mocked(getTransaction).mockResolvedValue({ ...base, ehPagamentoFatura: true, descricao: "Pagamento fatura Nubank" })
    renderEm("/transactions/t1/editar")
    expect(await screen.findByRole("heading", { name: "Pagamento fatura Nubank" })).toBeInTheDocument()
    expect(screen.getByText("Pagamento de fatura")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Estornar pagamento" })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText("HH:MM")).not.toBeInTheDocument()
  })

  it("transação que não existe (ou de outro usuário): 'Transação não encontrada'", async () => {
    vi.mocked(getTransaction).mockRejectedValue({ response: { status: 404 } })
    renderEm("/transactions/xyz")
    expect(await screen.findByRole("heading", { name: "Transação não encontrada" })).toBeInTheDocument()
  })
})

describe("TransactionPage — editar (/transactions/:id/editar, mesma tela)", () => {
  it("'Editar' liga o formulário com o dia e a hora do lançamento (14:32:00 → '14:32')", async () => {
    renderEm("/transactions/t1")
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }))
    expect(await screen.findByRole("heading", { name: "Editar transação" })).toBeInTheDocument()
    expect(campoHora().value).toBe("14:32")
    expect(screen.getByRole("button", { name: "21/05/2026" })).toBeInTheDocument()
    expect(screen.getByDisplayValue("Mercado")).toBeInTheDocument()
  })

  it("salvar sem mexer reenvia EXATAMENTE o que veio (data 'YYYY-MM-DD' + hora 'HH:MM:SS') e volta pro ver", async () => {
    renderEm("/transactions/t1/editar")
    await screen.findByRole("heading", { name: "Editar transação" })
    await screen.findByText("Alimentação")

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))

    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(1))
    const [id, payload] = vi.mocked(updateTransaction).mock.calls[0]
    expect(id).toBe("t1")
    expect(payload.data).toBe("2026-05-21")
    expect(payload.hora).toBe("14:32:00")
    expect(payload).toMatchObject({ descricao: "Mercado", valor: 250, tipo: 1, categoriaId: "c1", contaId: "a1" })
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: "Transação atualizada" }))
    expect(await screen.findByRole("heading", { name: "Mercado" })).toBeInTheDocument() // de volta ao ver
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument()
  })

  it("trocar a hora (0905) manda 'HH:MM:00' com o dia intacto", async () => {
    renderEm("/transactions/t1/editar")
    await screen.findByText("Alimentação")
    fireEvent.change(campoHora(), { target: { value: "0905" } })
    expect(campoHora().value).toBe("09:05")
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(1))
    expect(vi.mocked(updateTransaction).mock.calls[0][1]).toMatchObject({ data: "2026-05-21", hora: "09:05:00" })
  })

  it("lançamento SEM hora: o campo abre vazio, o submit é bloqueado com 'Informe a hora' e, preenchida, salva", async () => {
    vi.mocked(getTransaction).mockResolvedValue({ ...base, hora: null })
    renderEm("/transactions/t1/editar")
    await screen.findByText("Alimentação")
    expect(campoHora().value).toBe("")
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(await screen.findByText("Informe a hora")).toBeInTheDocument()
    expect(updateTransaction).not.toHaveBeenCalled()

    fireEvent.change(campoHora(), { target: { value: "1830" } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(1))
    expect(vi.mocked(updateTransaction).mock.calls[0][1]).toMatchObject({ data: "2026-05-21", hora: "18:30:00" })
  })

  it("erro do servidor: toast de erro e continua editando", async () => {
    vi.mocked(updateTransaction).mockRejectedValue(new Error("boom"))
    renderEm("/transactions/t1/editar")
    await screen.findByText("Alimentação")
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error", message: "Erro ao atualizar transação" })))
    expect(screen.getByRole("heading", { name: "Editar transação" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument()
  })

  it("Cancelar volta pro ver sem salvar", async () => {
    renderEm("/transactions/t1/editar")
    await screen.findByText("Alimentação")
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(await screen.findByRole("heading", { name: "Mercado" })).toBeInTheDocument()
    expect(updateTransaction).not.toHaveBeenCalled()
  })
})
