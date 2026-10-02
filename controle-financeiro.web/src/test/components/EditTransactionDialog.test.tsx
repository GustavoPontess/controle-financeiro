import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import EditTransactionDialog from "../../pages/Transactions/components/EditTransactionDialog/EditTransactionDialog"
import type { EditableTransaction } from "../../pages/Transactions/components/EditTransactionDialog/EditTransactionDialog"
import { updateTransaction } from "../../services/transactionService"

vi.mock("../../services/categoryService", () => ({
  getCategories: vi.fn().mockResolvedValue([
    { id: "c1", descricao: "Alimentação", finalidade: 1, isPadrao: true },
  ]),
}))
vi.mock("../../services/subcategoryService", () => ({
  getSubcategories: vi.fn().mockResolvedValue([]),
}))
vi.mock("../../services/contaService", () => ({
  getContas: vi.fn().mockResolvedValue([{ id: "a1", nome: "Nubank" }]),
}))
vi.mock("../../services/cartaoCreditoService", () => ({
  getCartoes: vi.fn().mockResolvedValue([]),
}))
vi.mock("../../services/transactionService", () => ({
  updateTransaction: vi.fn().mockResolvedValue(undefined),
}))

// Lançamento com data ("YYYY-MM-DD") e hora ("HH:MM:SS" | null) SEPARADAS — o shape novo da Transaction.
const base: EditableTransaction = {
  id: "t1", descricao: "Mercado", valor: 250, tipo: 1, categoriaId: "c1", contaId: "a1",
  meioPagamento: 2, data: "2026-05-21", hora: "14:32:00",
}

function renderDialog(transaction: EditableTransaction = base) {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  const notify = vi.fn()
  render(<EditTransactionDialog transaction={transaction} onClose={onClose} onSaved={onSaved} notify={notify} />)
  return { onClose, onSaved, notify }
}

const campoHora = () => screen.getByPlaceholderText("HH:MM") as HTMLInputElement

describe("EditTransactionDialog — data e hora separadas", () => {
  beforeEach(() => {
    vi.mocked(updateTransaction).mockReset().mockResolvedValue(undefined)
  })

  it("abre com o dia e a hora do lançamento (14:32:00 → '14:32', sem segundos nem fuso)", async () => {
    renderDialog()
    await screen.findByText("Alimentação") // categorias carregaram
    expect(campoHora().value).toBe("14:32")
    expect(screen.getByRole("button", { name: "21/05/2026" })).toBeInTheDocument()
    expect(screen.getByDisplayValue("Mercado")).toBeInTheDocument()
  })

  it("salvar sem mexer na data/hora reenvia EXATAMENTE o que veio: data 'YYYY-MM-DD' + hora 'HH:MM:SS' (regressão do bug de fuso)", async () => {
    const { onSaved, onClose, notify } = renderDialog()
    await screen.findByText("Alimentação")

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))

    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(1))
    const [id, payload] = vi.mocked(updateTransaction).mock.calls[0]
    expect(id).toBe("t1")
    expect(payload.data).toBe("2026-05-21") // o dia não recua nem avança, e não vira ISO com "T"
    expect(payload.hora).toBe("14:32:00")
    expect(payload).toMatchObject({ descricao: "Mercado", valor: 250, tipo: 1, categoriaId: "c1", contaId: "a1" })
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: "Transação atualizada" })))
    expect(onSaved).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it("trocar a hora (0905) manda 'HH:MM:00' com o dia intacto", async () => {
    renderDialog()
    await screen.findByText("Alimentação")
    fireEvent.change(campoHora(), { target: { value: "0905" } })
    expect(campoHora().value).toBe("09:05")

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))

    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(1))
    const payload = vi.mocked(updateTransaction).mock.calls[0][1]
    expect(payload.hora).toBe("09:05:00")
    expect(payload.data).toBe("2026-05-21")
  })

  it("lançamento SEM hora (null): o campo abre vazio, o submit é bloqueado com 'Informe a hora' e, preenchida, salva", async () => {
    const { onSaved } = renderDialog({ ...base, hora: null })
    await screen.findByText("Alimentação")
    expect(campoHora().value).toBe("")

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(await screen.findByText("Informe a hora")).toBeInTheDocument()
    expect(updateTransaction).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()

    fireEvent.change(campoHora(), { target: { value: "1830" } })
    expect(screen.queryByText("Informe a hora")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(1))
    expect(vi.mocked(updateTransaction).mock.calls[0][1]).toMatchObject({ data: "2026-05-21", hora: "18:30:00" })
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it("erro do servidor: toast de erro e o dialog não fecha nem avisa 'salvo'", async () => {
    vi.mocked(updateTransaction).mockRejectedValue(new Error("boom"))
    const { onSaved, onClose, notify } = renderDialog()
    await screen.findByText("Alimentação")

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))

    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error", message: "Erro ao atualizar transação" })))
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(within(screen.getByRole("dialog", { name: "Editar transação" })).getByRole("button", { name: "Salvar" })).toBeInTheDocument()
  })
})
