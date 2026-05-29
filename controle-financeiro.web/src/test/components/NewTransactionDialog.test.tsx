import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import NewTransactionDialog from "../../pages/Transactions/components/NewTransactionDialog/NewTransactionDialog"
import { createTransferencia } from "../../services/transferenciaService"
import { createTransaction } from "../../services/transactionService"

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
})
