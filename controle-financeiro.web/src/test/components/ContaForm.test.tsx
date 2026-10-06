import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import ContaForm from "../../components/Contas/ContaForm/ContaForm"
import type { ContaFormData } from "../../components/Contas/ContaForm/ContaForm"
import type { Conta } from "../../types/Conta"
import type { Banco } from "../../types/Banco"
import { dataLocalISO } from "../../utils/dateTime"

// Saldo inicial com DATA de abertura: o campo "Saldo inicial desde" só existe na criação e só quando há
// saldo inicial > 0; default = hoje; max = hoje; vai no submit como "YYYY-MM-DD". Também cobre o padrão
// obrigatório de form (submit vazio bloqueia + erro POR CAMPO, nunca toast).

const bancos = [] as Banco[]

const LABEL_DATA = "Saldo inicial desde"
const hojeBR = () => new Date().toLocaleDateString("pt-BR") // mesmo formato do PontesDateInput

function setup(props: { editingConta?: Conta | null } = {}) {
  const onSubmit = vi.fn()
  render(<ContaForm bancos={bancos} onSubmit={onSubmit} onCancel={vi.fn()} {...props} />)
  return onSubmit
}

// Digita em centavos no campo de saldo ("10000" -> "100,00").
const digitarSaldo = (centavos: string) =>
  fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: centavos } })

function preencherObrigatorios() {
  fireEvent.change(screen.getByPlaceholderText("Ex: NuConta, Conta Corrente BB"), { target: { value: "Conta do Teste" } })
  fireEvent.click(screen.getByText("Selecione o tipo"))
  fireEvent.click(screen.getByText("Conta Corrente"))
}

// Abre o popover do PontesDateInput ("Saldo inicial desde") e devolve o dialog do calendário.
function abrirCalendario() {
  fireEvent.click(screen.getByRole("button", { name: hojeBR() }))
  return screen.getByRole("dialog", { name: "Escolher data" })
}

describe("ContaForm — validação por campo (padrão de form)", () => {
  it("submit vazio bloqueia e mostra erro POR CAMPO (nome e tipo), sem chamar onSubmit", () => {
    const onSubmit = setup()
    expect(screen.queryByText("Informe o nome da conta")).not.toBeInTheDocument()
    // "Selecione o tipo" é, hoje, o placeholder E a mensagem de erro do campo Tipo (mesmo texto):
    // antes do submit só o placeholder existe (1); depois do submit placeholder + erro (2).
    expect(screen.getAllByText("Selecione o tipo")).toHaveLength(1)

    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText("Informe o nome da conta")).toBeInTheDocument()
    expect(screen.getAllByText("Selecione o tipo")).toHaveLength(2)
  })

  it("o erro do campo some ao editá-lo", () => {
    setup()
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }))
    expect(screen.getByText("Informe o nome da conta")).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText("Ex: NuConta, Conta Corrente BB"), { target: { value: "Nubank" } })
    expect(screen.queryByText("Informe o nome da conta")).not.toBeInTheDocument()
  })
})

describe("ContaForm — saldo inicial desde (data de abertura)", () => {
  it("NÃO mostra o campo de data com o saldo inicial vazio", () => {
    setup()
    expect(screen.getByText("Saldo inicial")).toBeInTheDocument() // o campo de saldo existe
    expect(screen.queryByText(LABEL_DATA)).not.toBeInTheDocument()
  })

  it("NÃO mostra o campo de data com saldo inicial 0,00", () => {
    setup()
    digitarSaldo("0")
    expect(screen.getByPlaceholderText("0,00")).toHaveValue("0,00")
    expect(screen.queryByText(LABEL_DATA)).not.toBeInTheDocument()
  })

  it("mostra o campo ao digitar saldo > 0, com HOJE como data padrão", () => {
    setup()
    digitarSaldo("10000") // 100,00
    expect(screen.getByText(LABEL_DATA)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: hojeBR() })).toBeInTheDocument()
  })

  it("o campo some de novo quando o saldo é apagado", () => {
    setup()
    digitarSaldo("10000")
    expect(screen.getByText(LABEL_DATA)).toBeInTheDocument()
    digitarSaldo("")
    expect(screen.queryByText(LABEL_DATA)).not.toBeInTheDocument()
  })

  it("onSubmit entrega dataSaldoInicial (hoje por padrão, YYYY-MM-DD) quando há saldo inicial", () => {
    const onSubmit = setup()
    preencherObrigatorios()
    digitarSaldo("150000") // 1.500,00
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const data = onSubmit.mock.calls[0][0] as ContaFormData
    expect(data.saldoInicial).toBe(1500)
    expect(data.dataSaldoInicial).toBe(dataLocalISO())
    expect(data.dataSaldoInicial).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("onSubmit SEM saldo inicial não envia dataSaldoInicial", () => {
    const onSubmit = setup()
    preencherObrigatorios()
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const data = onSubmit.mock.calls[0][0] as ContaFormData
    expect(data.saldoInicial).toBe(0)
    expect(data.dataSaldoInicial).toBeUndefined()
  })

  it("saldo digitado e depois zerado não manda data (sem saldo, sem data de abertura)", () => {
    const onSubmit = setup()
    preencherObrigatorios()
    digitarSaldo("10000")
    digitarSaldo("")
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }))

    const data = onSubmit.mock.calls[0][0] as ContaFormData
    expect(data.dataSaldoInicial).toBeUndefined()
  })

  it("data retroativa escolhida no calendário vai no submit", () => {
    const onSubmit = setup()
    preencherObrigatorios()
    digitarSaldo("50000")

    const dialog = abrirCalendario()
    fireEvent.click(within(dialog).getByRole("button", { name: "‹" })) // mês anterior
    fireEvent.click(within(dialog).getByRole("button", { name: "1" })) // dia 1

    const agora = new Date()
    const diaUmDoMesPassado = dataLocalISO(new Date(agora.getFullYear(), agora.getMonth() - 1, 1))
    // popover fecha e o campo passa a mostrar a data escolhida
    expect(screen.queryByRole("dialog", { name: "Escolher data" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: new Date(agora.getFullYear(), agora.getMonth() - 1, 1).toLocaleDateString("pt-BR") })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }))
    const data = onSubmit.mock.calls[0][0] as ContaFormData
    expect(data.dataSaldoInicial).toBe(diaUmDoMesPassado)
    expect(data.saldoInicial).toBe(500)
  })

  it("dia FUTURO no calendário é ignorado (max = hoje): a data segue sendo hoje", () => {
    const onSubmit = setup()
    preencherObrigatorios()
    digitarSaldo("50000")

    const dialog = abrirCalendario()
    fireEvent.click(within(dialog).getByRole("button", { name: "›" })) // mês seguinte: tudo é futuro
    fireEvent.click(within(dialog).getByRole("button", { name: "15" }))

    // não aceitou: popover continua aberto e o valor não mudou
    expect(screen.getByRole("dialog", { name: "Escolher data" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }))
    const data = onSubmit.mock.calls[0][0] as ContaFormData
    expect(data.dataSaldoInicial).toBe(dataLocalISO())
  })
})

describe("ContaForm — edição", () => {
  const contaExistente = {
    id: "conta-1", nome: "Nubank", tipo: 1, tipoDescricao: "Conta Corrente", saldoAtual: 2500, isCarteira: false,
  } as Conta

  it("não oferece saldo inicial nem a data de abertura ao editar", () => {
    setup({ editingConta: contaExistente })
    expect(screen.getByRole("button", { name: "Atualizar" })).toBeInTheDocument()
    expect(screen.queryByText("Saldo inicial")).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText("0,00")).not.toBeInTheDocument()
    expect(screen.queryByText(LABEL_DATA)).not.toBeInTheDocument()
  })

  it("submit da edição não envia saldoInicial nem dataSaldoInicial", () => {
    const onSubmit = setup({ editingConta: contaExistente })
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const data = onSubmit.mock.calls[0][0] as ContaFormData
    expect(data.nome).toBe("Nubank")
    expect(data.saldoInicial).toBeUndefined()
    expect(data.dataSaldoInicial).toBeUndefined()
  })
})
