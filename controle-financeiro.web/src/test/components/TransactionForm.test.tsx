import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import TransactionForm from "../../pages/Transactions/components/TransactionForm/TransactionForm"
import type { TransactionFormData } from "../../pages/Transactions/components/TransactionForm/TransactionForm"
import type { Category } from "../../types/Category"
import type { Conta } from "../../types/Conta"
import type { Subcategory } from "../../types/Subcategory"
import type { CartaoCredito } from "../../types/CartaoCredito"

const categories = [
  { id: "c1", descricao: "Alimentação", finalidade: 1, isPadrao: true },
  { id: "c2", descricao: "Salário", finalidade: 2, isPadrao: true },
] as Category[]
const subcategories = [] as Subcategory[]
const contas = [
  { id: "a1", nome: "Nubank" },
  { id: "a2", nome: "Itaú" },
] as Conta[]
const cartoes = [] as CartaoCredito[]

function setup(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(
    <TransactionForm
      categories={categories}
      subcategories={subcategories}
      contas={contas}
      cartoes={cartoes}
      onSubmit={onSubmit}
    />
  )
  return onSubmit
}

function setupEdit(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(
    <TransactionForm
      mode="edit"
      initial={{ natureza: "receita", tipo: 2, valor: "100,00", descricao: "Antigo", categoriaId: "c2", contaId: "a1" }}
      categories={categories}
      subcategories={subcategories}
      contas={contas}
      cartoes={cartoes}
      onSubmit={onSubmit}
    />
  )
  return onSubmit
}

describe("TransactionForm — natureza + regras (#82)", () => {
  it("default Despesa mostra categoria e meio de pagamento", () => {
    setup()
    expect(screen.getByText("Categoria")).toBeInTheDocument()
    expect(screen.getByText("Meio de pagamento")).toBeInTheDocument()
    expect(screen.queryByText("Conta de origem")).not.toBeInTheDocument()
  })

  it("Transferência troca os campos: mostra origem/destino, esconde categoria/meio", () => {
    setup()
    fireEvent.click(screen.getByText("Transferência"))
    expect(screen.getByText("Conta de origem")).toBeInTheDocument()
    expect(screen.getByText("Conta de destino")).toBeInTheDocument()
    expect(screen.queryByText("Categoria")).not.toBeInTheDocument()
    expect(screen.queryByText("Meio de pagamento")).not.toBeInTheDocument()
  })

  it("Receita não oferece Crédito como meio de pagamento", () => {
    setup()
    fireEvent.click(screen.getByText("Receita"))
    // abre o select de meio de pagamento
    const trigger = screen.getByText("Pix")
    fireEvent.click(trigger)
    expect(screen.queryByText("Crédito")).not.toBeInTheDocument()
  })

  it("Transferência submete com natureza e contas corretas", async () => {
    const onSubmit = setup()
    fireEvent.click(screen.getByText("Transferência"))

    // valor
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "10000" } })

    // origem
    fireEvent.click(screen.getByText("De qual conta"))
    fireEvent.click(screen.getByText("Nubank"))
    // destino
    fireEvent.click(screen.getByText("Para qual conta"))
    fireEvent.click(screen.getByText("Itaú"))

    // descrição (obrigatória)
    fireEvent.change(screen.getByPlaceholderText("Ex: Reserva de emergência"), {
      target: { value: "Mover grana" },
    })

    fireEvent.click(screen.getByText("Transferir"))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const data = onSubmit.mock.calls[0][0] as TransactionFormData
    expect(data.natureza).toBe("transferencia")
    expect(data.contaOrigemId).toBe("a1")
    expect(data.contaDestinoId).toBe("a2")
  })

  it("submit vazio mostra erros e não chama onSubmit", () => {
    const onSubmit = setup()
    fireEvent.click(screen.getByText("Adicionar"))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText("Informe um valor")).toBeInTheDocument()
    expect(screen.getByText("Categoria obrigatória")).toBeInTheDocument()
    expect(screen.getByText("Informe a descrição")).toBeInTheDocument()
  })

  it("despesa sem conta mostra 'Conta obrigatória' + borda vermelha", () => {
    setup()
    fireEvent.click(screen.getByText("Adicionar"))
    expect(screen.getByText("Conta obrigatória")).toBeInTheDocument()
    // PontesSelect da conta marca data-invalid
    const invalids = document.querySelectorAll('[data-invalid="true"]')
    expect(invalids.length).toBeGreaterThan(0)
  })

  it("crédito sem cartão mostra 'Cartão obrigatório'", () => {
    setup()
    // troca meio de pagamento para Crédito
    fireEvent.click(screen.getByText("Pix"))
    fireEvent.click(screen.getByText("Crédito"))
    fireEvent.click(screen.getByText("Adicionar"))
    expect(screen.getByText("Cartão obrigatório")).toBeInTheDocument()
    // sem cartão, não some conta nem mostra "Conta obrigatória"
    expect(screen.queryByText("Conta obrigatória")).not.toBeInTheDocument()
  })

  it("transferência vazia mostra erros de origem e destino", () => {
    setup()
    fireEvent.click(screen.getByText("Transferência"))
    fireEvent.click(screen.getByText("Transferir"))
    expect(screen.getByText("Selecione a conta de origem")).toBeInTheDocument()
    expect(screen.getByText("Selecione a conta de destino")).toBeInTheDocument()
    // não pede categoria em transferência
    expect(screen.queryByText("Categoria obrigatória")).not.toBeInTheDocument()
  })

  it("erro limpa ao editar o campo", () => {
    setup()
    fireEvent.click(screen.getByText("Adicionar"))
    expect(screen.getByText("Informe a descrição")).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText("Ex: Compra no mercado"), { target: { value: "Mercado" } })
    expect(screen.queryByText("Informe a descrição")).not.toBeInTheDocument()
  })

  it("modo edit: sem transferência/recorrente/parcelas, botão Salvar, valores iniciais", () => {
    setupEdit()
    expect(screen.queryByText("Transferência")).not.toBeInTheDocument()
    expect(screen.queryByText("Repetir automaticamente (assinatura)")).not.toBeInTheDocument()
    expect(screen.getByText("Salvar")).toBeInTheDocument()
    // valor inicial preenchido
    expect((screen.getByPlaceholderText("0,00") as HTMLInputElement).value).toBe("100,00")
  })

  it("modo edit: submete dados editados", () => {
    const onSubmit = setupEdit()
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "25000" } }) // 250,00
    fireEvent.click(screen.getByText("Salvar"))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    const data = onSubmit.mock.calls[0][0] as TransactionFormData
    expect(data.valor).toBe("250,00")
    expect(data.natureza).toBe("receita")
  })
})
