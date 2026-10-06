import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import NewContaDialog from "../../components/Contas/NewContaDialog/NewContaDialog"
import { createConta, updateConta } from "../../services/contaService"
import { dataLocalISO } from "../../utils/dateTime"
import type { Conta } from "../../types/Conta"
import type { Banco } from "../../types/Banco"

// NewContaDialog liga o ContaForm ao contaService. Foco: a data de abertura do saldo inicial
// (dataSaldoInicial) chega no createConta, e NUNCA vaza pro updateConta (edição não mexe em saldo inicial).

vi.mock("../../services/contaService", () => ({
  createConta: vi.fn().mockResolvedValue({}),
  updateConta: vi.fn().mockResolvedValue(undefined),
}))

const bancos = [] as Banco[]

function renderDialog(editingConta?: Conta | null) {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  const notify = vi.fn()
  render(
    <NewContaDialog open onClose={onClose} onSaved={onSaved} notify={notify} bancos={bancos} editingConta={editingConta} />
  )
  return { onClose, onSaved, notify }
}

function preencherObrigatorios() {
  fireEvent.change(screen.getByPlaceholderText("Ex: NuConta, Conta Corrente BB"), { target: { value: "Conta do Teste" } })
  fireEvent.click(screen.getByText("Selecione o tipo"))
  fireEvent.click(screen.getByText("Conta Corrente"))
}

describe("NewContaDialog — saldo inicial com data", () => {
  beforeEach(() => vi.clearAllMocks())

  it("criar com saldo inicial repassa saldoInicial + dataSaldoInicial (hoje) pro createConta", async () => {
    const { onClose, onSaved, notify } = renderDialog()
    preencherObrigatorios()
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "25000" } }) // 250,00
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }))

    await waitFor(() => expect(createConta).toHaveBeenCalledTimes(1))
    expect(createConta).toHaveBeenCalledWith(
      expect.objectContaining({ nome: "Conta do Teste", tipo: 1, saldoInicial: 250, dataSaldoInicial: dataLocalISO() })
    )
    expect(updateConta).not.toHaveBeenCalled()
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: "Conta adicionada com sucesso" })))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
  })

  it("criar SEM saldo inicial chama createConta sem dataSaldoInicial", async () => {
    renderDialog()
    preencherObrigatorios()
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }))

    await waitFor(() => expect(createConta).toHaveBeenCalledTimes(1))
    const payload = vi.mocked(createConta).mock.calls[0][0]
    expect(payload.saldoInicial).toBe(0)
    expect(payload.dataSaldoInicial).toBeUndefined()
  })

  it("editar chama updateConta SEM saldoInicial nem dataSaldoInicial no payload", async () => {
    const existente = {
      id: "conta-1", nome: "Nubank", tipo: 1, tipoDescricao: "Conta Corrente", saldoAtual: 2500, isCarteira: false,
    } as Conta
    const { notify } = renderDialog(existente)
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }))

    await waitFor(() => expect(updateConta).toHaveBeenCalledTimes(1))
    const [id, payload] = vi.mocked(updateConta).mock.calls[0]
    expect(id).toBe("conta-1")
    expect(payload).not.toHaveProperty("saldoInicial")
    expect(payload).not.toHaveProperty("dataSaldoInicial")
    expect(createConta).not.toHaveBeenCalled()
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success", message: "Conta atualizada com sucesso" })))
  })

  it("erro do createConta não fecha o modal (usuário corrige e tenta de novo)", async () => {
    vi.mocked(createConta).mockRejectedValueOnce(new Error("data futura"))
    const { onClose, onSaved } = renderDialog()
    preencherObrigatorios()
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "10000" } })
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }))

    await waitFor(() => expect(createConta).toHaveBeenCalledTimes(1))
    expect(onClose).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Adicionar" })).toBeInTheDocument() // form continua aberto
  })
})
