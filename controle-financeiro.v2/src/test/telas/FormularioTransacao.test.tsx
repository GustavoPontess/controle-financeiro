import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("../../services/transactionService", () => ({ createTransaction: vi.fn(), updateTransaction: vi.fn() }))
vi.mock("../../services/transferenciaService", () => ({ createTransferencia: vi.fn() }))
vi.mock("../../services/recorrenteService", () => ({ createRecorrente: vi.fn(), updateRecorrente: vi.fn() }))
import { createTransaction } from "../../services/transactionService"
import { createTransferencia } from "../../services/transferenciaService"
import FormularioTransacao from "../../telas/FormularioTransacao"

const contas = [
  { id: "k1", nome: "Carteira", tipo: 4, tipoDescricao: "", saldoAtual: 0, isCarteira: true },
  { id: "k2", nome: "Nubank", tipo: 1, tipoDescricao: "", saldoAtual: 0, isCarteira: false },
]
const categorias = [{ id: "cat1", descricao: "Alimentação", finalidade: 1, isPadrao: true }]
const renderizar = () => render(
  <FormularioTransacao contas={contas as never} cartoes={[]} categorias={categorias as never} subcategorias={[]} aoSair={vi.fn()} aoSalvo={vi.fn()} />,
)

describe("FormularioTransacao", () => {
  it("submit vazio bloqueia e mostra o erro em cada campo", async () => {
    renderizar()
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }))
    expect(screen.getByText("Informe um valor")).toBeInTheDocument()
    expect(screen.getByText("Informe a descrição")).toBeInTheDocument()
    // O erro mora no <small> do campo (o mesmo texto aparece como placeholder da seleção).
    expect(screen.getByText("Escolha a conta", { selector: "small" })).toBeInTheDocument()
    expect(screen.getByText("Escolha a categoria", { selector: "small" })).toBeInTheDocument()
    expect(createTransaction).not.toHaveBeenCalled()
  })

  it("o erro some ao corrigir o campo", async () => {
    renderizar()
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }))
    await userEvent.type(screen.getByPlaceholderText("Mercado"), "Feira")
    expect(screen.queryByText("Informe a descrição")).not.toBeInTheDocument()
  })

  it("transferência pede origem e destino", async () => {
    renderizar()
    await userEvent.click(screen.getByRole("radio", { name: "Transferência" }))
    await userEvent.click(screen.getByRole("button", { name: "Transferir" }))
    expect(screen.getByText("Escolha a conta de origem")).toBeInTheDocument()
    expect(screen.getByText("Escolha a conta de destino")).toBeInTheDocument()
    expect(createTransferencia).not.toHaveBeenCalled()
  })
})
