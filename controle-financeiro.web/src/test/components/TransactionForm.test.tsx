import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
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

  it("campo Hora aparece com a hora atual por padrão (HH:MM)", () => {
    setup()
    const hora = screen.getByPlaceholderText("HH:MM") as HTMLInputElement
    expect(hora.value).toMatch(/^\d{2}:\d{2}$/)
  })

  it("máscara da hora: digitar '0930' vira '09:30'", () => {
    setup()
    const hora = screen.getByPlaceholderText("HH:MM") as HTMLInputElement
    fireEvent.change(hora, { target: { value: "0930" } })
    expect(hora.value).toBe("09:30")
  })

  it("edição pré-preenche a hora vinda do initial", () => {
    render(
      <TransactionForm
        mode="edit"
        initial={{ natureza: "despesa", tipo: 1, valor: "50,00", descricao: "X", categoriaId: "c1", contaId: "a1", hora: "07:30" }}
        categories={categories} subcategories={subcategories} contas={contas} cartoes={cartoes}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />
    )
    expect((screen.getByPlaceholderText("HH:MM") as HTMLInputElement).value).toBe("07:30")
  })

  it("submit carrega a hora escolhida (transferência)", async () => {
    const onSubmit = setup()
    fireEvent.click(screen.getByText("Transferência"))
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "10000" } })
    fireEvent.change(screen.getByPlaceholderText("HH:MM"), { target: { value: "0815" } })
    fireEvent.click(screen.getByText("De qual conta"))
    fireEvent.click(screen.getByText("Nubank"))
    fireEvent.click(screen.getByText("Para qual conta"))
    fireEvent.click(screen.getByText("Itaú"))
    fireEvent.change(screen.getByPlaceholderText("Ex: Reserva de emergência"), { target: { value: "Mover grana" } })
    fireEvent.click(screen.getByText("Transferir"))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const data = onSubmit.mock.calls[0][0] as TransactionFormData
    expect(data.hora).toBe("08:15")
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

describe("TransactionForm — efetivado (previsto vs realizado)", () => {
  it("despesa única mostra 'Já paguei' marcado por padrão", () => {
    setup()
    expect(screen.getByText("Já paguei")).toBeInTheDocument()
  })

  it("receita troca o rótulo para 'Já recebi'", () => {
    setup()
    fireEvent.click(screen.getByText("Receita"))
    expect(screen.getByText("Já recebi")).toBeInTheDocument()
    expect(screen.queryByText("Já paguei")).not.toBeInTheDocument()
  })

  it("desmarcar revela o hint de previsão", () => {
    setup()
    expect(screen.queryByText(/Fica como previsão/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("Já paguei"))
    expect(screen.getByText(/Fica como previsão/i)).toBeInTheDocument()
  })

  it("recorrente esconde o toggle (já gera previsões)", () => {
    setup()
    fireEvent.click(screen.getByText("Repetir automaticamente (assinatura)"))
    expect(screen.queryByText("Já paguei")).not.toBeInTheDocument()
  })

  it("transferência esconde o toggle", () => {
    setup()
    fireEvent.click(screen.getByText("Transferência"))
    expect(screen.queryByText("Já paguei")).not.toBeInTheDocument()
    expect(screen.queryByText("Já recebi")).not.toBeInTheDocument()
  })
})

describe("TransactionForm — Hora obrigatória (lançamento único e transferência)", () => {
  // Edição de uma despesa JÁ válida (valor, categoria, conta, descrição) — só a hora é o que varia.
  function setupEditValido(hora: string, onSubmit = vi.fn().mockResolvedValue(undefined)) {
    render(
      <TransactionForm
        mode="edit"
        initial={{ natureza: "despesa", tipo: 1, valor: "50,00", descricao: "Mercado", categoriaId: "c1", contaId: "a1", hora }}
        categories={categories} subcategories={subcategories} contas={contas} cartoes={cartoes}
        onSubmit={onSubmit}
      />
    )
    return onSubmit
  }
  const campoHora = () => screen.getByPlaceholderText("HH:MM") as HTMLInputElement
  const limparHora = () => fireEvent.change(campoHora(), { target: { value: "" } })

  it("o rótulo 'Hora' é obrigatório (asterisco) no lançamento único e na transferência", () => {
    setup()
    expect(screen.getByText("Hora").closest("label")).toHaveTextContent("Hora*")
    fireEvent.click(screen.getByText("Transferência"))
    expect(screen.getByText("Hora").closest("label")).toHaveTextContent("Hora*")
  })

  it("submit com a hora vazia BLOQUEIA e mostra 'Informe a hora' no próprio campo (erro por campo, sem chamar onSubmit)", () => {
    const onSubmit = setupEditValido("07:30")
    limparHora()
    expect(campoHora().value).toBe("")

    fireEvent.click(screen.getByText("Salvar"))

    expect(onSubmit).not.toHaveBeenCalled()
    const erro = screen.getByText("Informe a hora")
    expect(erro).toBeInTheDocument()
    expect(campoHora()).toHaveAttribute("data-invalid", "true") // borda vermelha no controle
    // o erro mora dentro do PontesField da Hora (não é toast, não é outro campo)
    expect(erro.closest("div[data-error]")).toContainElement(campoHora())
    // e é SÓ a hora que está errada: nenhum outro erro de campo
    expect(screen.queryByText("Informe um valor")).not.toBeInTheDocument()
    expect(screen.queryByText("Categoria obrigatória")).not.toBeInTheDocument()
    expect(screen.queryByText("Informe a descrição")).not.toBeInTheDocument()
  })

  it("submit vazio (despesa, hora apagada) mostra TODOS os erros por campo, incluindo 'Informe a hora'", () => {
    const onSubmit = setup()
    limparHora()
    fireEvent.click(screen.getByText("Adicionar"))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText("Informe um valor")).toBeInTheDocument()
    expect(screen.getByText("Categoria obrigatória")).toBeInTheDocument()
    expect(screen.getByText("Conta obrigatória")).toBeInTheDocument()
    expect(screen.getByText("Informe a descrição")).toBeInTheDocument()
    expect(screen.getByText("Informe a hora")).toBeInTheDocument()
  })

  it("transferência com a hora vazia também bloqueia e mostra 'Informe a hora'", () => {
    const onSubmit = setup()
    fireEvent.click(screen.getByText("Transferência"))
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "10000" } })
    fireEvent.click(screen.getByText("De qual conta"))
    fireEvent.click(screen.getByText("Nubank"))
    fireEvent.click(screen.getByText("Para qual conta"))
    fireEvent.click(screen.getByText("Itaú"))
    fireEvent.change(screen.getByPlaceholderText("Ex: Reserva de emergência"), { target: { value: "Mover grana" } })
    limparHora()

    fireEvent.click(screen.getByText("Transferir"))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText("Informe a hora")).toBeInTheDocument()
    expect(campoHora()).toHaveAttribute("data-invalid", "true")
    // só a hora falhou: origem/destino/valor/descrição estão ok
    expect(screen.queryByText("Selecione a conta de origem")).not.toBeInTheDocument()
    expect(screen.queryByText("Selecione a conta de destino")).not.toBeInTheDocument()
    expect(screen.queryByText("Informe um valor")).not.toBeInTheDocument()
  })

  it("hora incompleta/inválida (25:61) bloqueia com 'Hora inválida (HH:MM)' — diferente do 'Informe a hora' da vazia", () => {
    const onSubmit = setupEditValido("07:30")
    fireEvent.change(campoHora(), { target: { value: "2561" } }) // máscara → 25:61
    expect(campoHora().value).toBe("25:61")
    fireEvent.click(screen.getByText("Salvar"))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText("Hora inválida (HH:MM)")).toBeInTheDocument()
    expect(screen.queryByText("Informe a hora")).not.toBeInTheDocument()

    // meia hora digitada ("093" → "09:3") também não é HH:MM
    fireEvent.change(campoHora(), { target: { value: "093" } })
    fireEvent.click(screen.getByText("Salvar"))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText("Hora inválida (HH:MM)")).toBeInTheDocument()
  })

  it("o erro da hora some assim que a pessoa edita o campo, e aí o submit passa", async () => {
    const onSubmit = setupEditValido("07:30")
    limparHora()
    fireEvent.click(screen.getByText("Salvar"))
    expect(screen.getByText("Informe a hora")).toBeInTheDocument()

    fireEvent.change(campoHora(), { target: { value: "0945" } })
    expect(screen.queryByText("Informe a hora")).not.toBeInTheDocument()
    expect(campoHora()).not.toHaveAttribute("data-invalid")

    fireEvent.click(screen.getByText("Salvar"))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  })

  it("submit válido (lançamento único) chama onSubmit levando a hora digitada em HH:MM", async () => {
    const onSubmit = setupEditValido("07:30")
    fireEvent.change(campoHora(), { target: { value: "2359" } })
    fireEvent.click(screen.getByText("Salvar"))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const data = onSubmit.mock.calls[0][0] as TransactionFormData
    expect(data.hora).toBe("23:59")
    expect(data.natureza).toBe("despesa")
    expect(screen.queryByText("Informe a hora")).not.toBeInTheDocument()
  })

  it("meia-noite '00:00' é uma hora válida (não confunde com vazio)", async () => {
    const onSubmit = setupEditValido("07:30")
    fireEvent.change(campoHora(), { target: { value: "0000" } })
    fireEvent.click(screen.getByText("Salvar"))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect((onSubmit.mock.calls[0][0] as TransactionFormData).hora).toBe("00:00")
  })

  it("recorrente NÃO tem hora: o campo some e o submit não cobra 'Informe a hora' (mesmo com a hora apagada antes)", () => {
    const onSubmit = setup()
    limparHora()
    fireEvent.click(screen.getByText("Repetir automaticamente (assinatura)"))
    expect(screen.queryByPlaceholderText("HH:MM")).not.toBeInTheDocument()
    expect(screen.getByText("Início")).toBeInTheDocument() // recorrente usa "Início" em vez de Data + Hora

    fireEvent.click(screen.getByText("Criar recorrente"))

    expect(onSubmit).not.toHaveBeenCalled() // bloqueado pelos outros campos vazios...
    expect(screen.getByText("Informe um valor")).toBeInTheDocument()
    expect(screen.queryByText("Informe a hora")).not.toBeInTheDocument() // ...mas não pela hora
    expect(screen.queryByText("Hora inválida (HH:MM)")).not.toBeInTheDocument()
  })
})
