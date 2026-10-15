import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("../../services/transactionService", () => ({ createTransaction: vi.fn(), updateTransaction: vi.fn() }))
vi.mock("../../services/transferenciaService", () => ({ createTransferencia: vi.fn() }))
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
    expect(screen.getByText("Escolha a conta", { selector: "small > span" })).toBeInTheDocument()
    expect(screen.getByText("Escolha a categoria", { selector: "small > span" })).toBeInTheDocument()
    expect(createTransaction).not.toHaveBeenCalled()
  })

  it("o erro some ao corrigir o campo", async () => {
    renderizar()
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }))
    await userEvent.type(screen.getByPlaceholderText("Mercado"), "Feira")
    expect(screen.queryByText("Informe a descrição")).not.toBeInTheDocument()
  })

  it("conta fixa não é mais interruptor: o botão leva o que já foi preenchido", async () => {
    const aoVirarContaFixa = vi.fn()
    render(<FormularioTransacao contas={contas as never} cartoes={[]} categorias={categorias as never} subcategorias={[]}
      aoSair={vi.fn()} aoSalvo={vi.fn()} aoVirarContaFixa={aoVirarContaFixa} />)
    expect(screen.queryByRole("switch", { name: "Conta fixa" })).not.toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText("Mercado"), "Academia")
    await userEvent.click(screen.getByRole("button", { name: "Transformar em conta fixa" }))
    expect(aoVirarContaFixa).toHaveBeenCalledWith(expect.objectContaining({ tipo: 1, descricao: "Academia", meio: 4 }))
    expect(createTransaction).not.toHaveBeenCalled()
  })

  it("parcela e ocorrência de conta fixa não oferecem virar conta fixa", () => {
    render(<FormularioTransacao transacao={{ id: "t1", descricao: "Luz", valor: 90, tipo: 1, categoriaId: "cat1", contaId: "k2",
      recorrenteOrigemId: "r1", statusTransacao: 0, data: "2026-10-10" } as never}
      contas={contas as never} cartoes={[]} categorias={categorias as never} subcategorias={[]} aoSair={vi.fn()} aoSalvo={vi.fn()} aoVirarContaFixa={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "Transformar em conta fixa" })).not.toBeInTheDocument()
  })

  it("receita não oferece débito automático nem crédito", async () => {
    renderizar()
    await userEvent.click(screen.getByRole("radio", { name: "Receita" }))
    await userEvent.click(screen.getByRole("combobox", { name: "Recebido por" }))
    const opcoes = screen.getAllByRole("option").map((o) => o.textContent)
    expect(opcoes).not.toContain("Débito automático")
    expect(opcoes).not.toContain("Crédito")
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
