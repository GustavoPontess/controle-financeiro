import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("../../services/contaService", () => ({ createConta: vi.fn(), updateConta: vi.fn() }))
import { createConta } from "../../services/contaService"
import FormularioConta from "../../telas/FormularioConta"

const bancos = [{ id: "b1", nome: "Nubank", nomeFantasia: "", razaoSocial: "", tipo: 2, tipoDescricao: "", ativo: true }]
const renderizar = (aoSalvo = vi.fn()) => render(<FormularioConta bancos={bancos} aoSair={vi.fn()} aoSalvo={aoSalvo} />)

describe("FormularioConta", () => {
  beforeEach(() => vi.mocked(createConta).mockReset())

  it("submit vazio bloqueia e pede o nome", async () => {
    renderizar()
    await userEvent.click(screen.getByRole("button", { name: "Adicionar conta" }))
    expect(screen.getByText("Dê um nome à conta.")).toBeInTheDocument()
    expect(createConta).not.toHaveBeenCalled()
  })

  it("agência e número: só número (e o hífen do dígito)", async () => {
    renderizar()
    const agencia = screen.getByPlaceholderText("0001")
    await userEvent.type(agencia, "00a1")
    expect(agencia).toHaveValue("001")
    const numero = screen.getByPlaceholderText("12345-6")
    await userEvent.type(numero, "12x34-5")
    expect(numero).toHaveValue("1234-5")
  })

  it("número com o hífen no lugar errado não salva", async () => {
    renderizar()
    await userEvent.type(screen.getByPlaceholderText("Nubank"), "Inter")
    await userEvent.type(screen.getByPlaceholderText("12345-6"), "12-345")
    await userEvent.click(screen.getByRole("button", { name: "Adicionar conta" }))
    expect(screen.getByText(/dígito depois do hífen/)).toBeInTheDocument()
    expect(createConta).not.toHaveBeenCalled()
  })

  it("cria com o saldo de hoje como saldo inicial", async () => {
    vi.mocked(createConta).mockResolvedValue({ id: "nova" })
    const aoSalvo = vi.fn()
    renderizar(aoSalvo)
    await userEvent.type(screen.getByPlaceholderText("Nubank"), "Inter")
    await userEvent.type(screen.getByPlaceholderText("0,00"), "125000")
    await userEvent.click(screen.getByRole("button", { name: "Adicionar conta" }))
    expect(createConta).toHaveBeenCalledWith(expect.objectContaining({ nome: "Inter", tipo: 1, isCarteira: false, saldoInicial: 1250 }))
    expect(aoSalvo).toHaveBeenCalledWith("nova")
  })
})
