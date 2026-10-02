import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import NewTransactionDialog from "../../pages/Transactions/components/NewTransactionDialog/NewTransactionDialog"
import { createTransferencia } from "../../services/transferenciaService"
import { createTransaction } from "../../services/transactionService"
import { dataLocalISO } from "../../utils/dateTime"

vi.mock("../../services/categoryService", () => ({
  getCategories: vi.fn().mockResolvedValue([
    { id: "c1", descricao: "Alimentação", finalidade: 1, isPadrao: true },
  ]),
}))
vi.mock("../../services/subcategoryService", () => ({
  getSubcategories: vi.fn().mockResolvedValue([]),
}))
vi.mock("../../services/contaService", () => ({
  getContas: vi.fn().mockResolvedValue([
    { id: "a1", nome: "Nubank" },
    { id: "a2", nome: "Itaú" },
  ]),
}))
vi.mock("../../services/cartaoCreditoService", () => ({
  getCartoes: vi.fn().mockResolvedValue([]),
}))
vi.mock("../../services/transferenciaService", () => ({
  createTransferencia: vi.fn().mockResolvedValue({}),
}))
vi.mock("../../services/transactionService", () => ({
  createTransaction: vi.fn().mockResolvedValue({}),
}))
vi.mock("../../services/recorrenteService", () => ({
  createRecorrente: vi.fn().mockResolvedValue({}),
}))

function renderDialog() {
  const onClose = vi.fn()
  const notify = vi.fn()
  render(<NewTransactionDialog open onClose={onClose} notify={notify} />)
  return { onClose, notify }
}

describe("NewTransactionDialog — roteamento (#82)", () => {
  beforeEach(() => vi.clearAllMocks())

  it("Transferência chama createTransferencia com origem/destino/valor", async () => {
    const { onClose } = renderDialog()
    // espera carregar contas
    await screen.findByText("Despesa")

    fireEvent.click(screen.getByText("Transferência"))

    // valor
    const valor = screen.getByPlaceholderText("0,00")
    fireEvent.change(valor, { target: { value: "10000" } }) // → 100,00

    // origem / destino
    fireEvent.click(screen.getByText("De qual conta"))
    fireEvent.click(screen.getByText("Nubank"))
    fireEvent.click(screen.getByText("Para qual conta"))
    fireEvent.click(screen.getByText("Itaú"))

    // descrição
    fireEvent.change(screen.getByPlaceholderText("Ex: Reserva de emergência"), {
      target: { value: "Mover grana" },
    })

    fireEvent.click(screen.getByText("Transferir"))

    await waitFor(() => expect(createTransferencia).toHaveBeenCalledTimes(1))
    expect(createTransferencia).toHaveBeenCalledWith(
      expect.objectContaining({ contaOrigemId: "a1", contaDestinoId: "a2", valor: 100 })
    )
    expect(createTransaction).not.toHaveBeenCalled()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it("Transferência com mesma conta origem/destino não envia", async () => {
    renderDialog()
    await screen.findByText("Despesa")
    fireEvent.click(screen.getByText("Transferência"))

    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "5000" } })
    // só origem escolhida (destino vazio) → bloqueia
    fireEvent.click(screen.getByText("De qual conta"))
    fireEvent.click(screen.getByText("Nubank"))
    fireEvent.click(screen.getByText("Transferir"))

    await waitFor(() => expect(createTransferencia).not.toHaveBeenCalled())
  })

  // --- data e hora SEPARADAS no payload (migração que mata o bug de fuso) ---

  async function preencherDespesa(hora?: string) {
    await screen.findByText("Despesa")
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "5000" } }) // 50,00
    if (hora !== undefined) fireEvent.change(screen.getByPlaceholderText("HH:MM"), { target: { value: hora } })
    fireEvent.click(await screen.findByText("Selecione a conta"))
    fireEvent.click(screen.getByText("Nubank"))
    fireEvent.click(screen.getByText("Selecione a categoria"))
    fireEvent.click(await screen.findByText("Alimentação"))
    fireEvent.change(screen.getByPlaceholderText("Ex: Compra no mercado"), { target: { value: "Mercado" } })
  }

  it("despesa única manda data ('YYYY-MM-DD') e hora ('HH:MM:SS') SEPARADAS — nunca um ISO datetime em `data`", async () => {
    const { onClose } = renderDialog()
    await preencherDespesa("0915")

    fireEvent.click(screen.getByText("Adicionar"))

    await waitFor(() => expect(createTransaction).toHaveBeenCalledTimes(1))
    const payload = vi.mocked(createTransaction).mock.calls[0][0]
    expect(payload.data).toBe(dataLocalISO()) // só o dia (hoje por padrão), sem "T" nem fuso
    expect(payload.data).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(payload.hora).toBe("09:15:00") // HH:MM digitado + ":00"
    expect(payload).toMatchObject({ descricao: "Mercado", valor: 50, tipo: 1, contaId: "a1", categoriaId: "c1" })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it("sem mexer na hora, o default (agora, HH:MM) é válido e vai como 'HH:MM:00'", async () => {
    renderDialog()
    await preencherDespesa()

    fireEvent.click(screen.getByText("Adicionar"))

    await waitFor(() => expect(createTransaction).toHaveBeenCalledTimes(1))
    expect(vi.mocked(createTransaction).mock.calls[0][0].hora).toMatch(/^\d{2}:\d{2}:00$/)
  })

  it("hora vazia bloqueia o envio: mostra 'Informe a hora' no campo e NÃO chama createTransaction", async () => {
    renderDialog()
    await preencherDespesa("")

    fireEvent.click(screen.getByText("Adicionar"))

    expect(await screen.findByText("Informe a hora")).toBeInTheDocument()
    expect(createTransaction).not.toHaveBeenCalled()
  })

  it("transferência com a hora vazia também não envia (createTransferencia não é chamado)", async () => {
    renderDialog()
    await screen.findByText("Despesa")
    fireEvent.click(screen.getByText("Transferência"))
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "10000" } })
    fireEvent.change(screen.getByPlaceholderText("HH:MM"), { target: { value: "" } })
    fireEvent.click(screen.getByText("De qual conta"))
    fireEvent.click(screen.getByText("Nubank"))
    fireEvent.click(screen.getByText("Para qual conta"))
    fireEvent.click(screen.getByText("Itaú"))
    fireEvent.change(screen.getByPlaceholderText("Ex: Reserva de emergência"), { target: { value: "Mover grana" } })

    fireEvent.click(screen.getByText("Transferir"))

    expect(await screen.findByText("Informe a hora")).toBeInTheDocument()
    expect(createTransferencia).not.toHaveBeenCalled()
  })
})
