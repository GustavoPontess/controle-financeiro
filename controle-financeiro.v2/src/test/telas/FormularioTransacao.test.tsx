import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import userEvent from "@testing-library/user-event"

vi.mock("../../services/transactionService", () => ({ createTransaction: vi.fn(), updateTransaction: vi.fn(), avisoDeCompra: vi.fn(async () => null) }))
vi.mock("../../services/transferenciaService", () => ({ createTransferencia: vi.fn() }))
import { avisoDeCompra, createTransaction } from "../../services/transactionService"
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

  it("conta fixa não entra aqui: sem interruptor nem atalho (tem formulário próprio)", () => {
    renderizar()
    expect(screen.queryByRole("switch", { name: "Conta fixa" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /conta fixa/i })).not.toBeInTheDocument()
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

  it("despesa nova mostra o aviso do servidor quando a compra aperta uma conta fixa", async () => {
    vi.mocked(avisoDeCompra).mockResolvedValue({
      tom: "alerta", texto: "Se fizer essa compra, falta saldo na conta Nubank pra Aluguel (dia 5, R$ 1.500,00).", acoes: [],
    })
    render(
      <MemoryRouter>
        <FormularioTransacao contas={contas as never} cartoes={[]} categorias={categorias as never} subcategorias={[]} aoSair={vi.fn()} aoSalvo={vi.fn()} />
      </MemoryRouter>,
    )
    await userEvent.type(screen.getByPlaceholderText("0,00"), "30000")
    await userEvent.click(screen.getByRole("combobox", { name: "Conta" }))
    await userEvent.click(screen.getByRole("option", { name: "Nubank" }))

    expect(await screen.findByText(/falta saldo na conta Nubank pra Aluguel/)).toBeInTheDocument()
    await waitFor(() => expect(avisoDeCompra).toHaveBeenLastCalledWith(300, { contaId: "k2" }))
  })
})
