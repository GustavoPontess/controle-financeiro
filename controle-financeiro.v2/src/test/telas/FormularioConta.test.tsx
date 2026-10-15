import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("../../services/contaService", () => ({ createConta: vi.fn(), updateConta: vi.fn(async () => {}), atualizarSaldoInicial: vi.fn(async () => {}) }))
import { atualizarSaldoInicial, createConta, updateConta } from "../../services/contaService"
import FormularioConta from "../../telas/FormularioConta"

const bancos = [{ id: "b1", nome: "Nubank", nomeFantasia: "", razaoSocial: "", tipo: 2, tipoDescricao: "", ativo: true }]
const renderizar = (aoSalvo = vi.fn()) => render(<FormularioConta bancos={bancos} aoSair={vi.fn()} aoSalvo={aoSalvo} />)

const existente = { id: "k1", nome: "Inter", tipo: 1, tipoDescricao: "", isCarteira: false, saldoAtual: 900, saldoInicial: 1250, dataSaldoInicial: "2026-09-01" }

describe("FormularioConta", () => {
  beforeEach(() => { vi.mocked(createConta).mockReset(); vi.mocked(updateConta).mockClear(); vi.mocked(atualizarSaldoInicial).mockClear() })

  it("editar: saldo inicial vem preenchido e só vai pro servidor se mudou", async () => {
    const aoSalvo = vi.fn()
    render(<FormularioConta conta={existente} bancos={bancos} aoSair={vi.fn()} aoSalvo={aoSalvo} />)
    expect(screen.getByPlaceholderText("0,00")).toHaveValue("1.250,00")
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(updateConta).toHaveBeenCalledWith("k1", expect.objectContaining({ nome: "Inter" }))
    expect(atualizarSaldoInicial).not.toHaveBeenCalled()
    expect(aoSalvo).toHaveBeenCalledWith("k1")
  })

  it("editar: mudou o saldo inicial → PUT saldo-inicial com valor e dia", async () => {
    render(<FormularioConta conta={existente} bancos={bancos} aoSair={vi.fn()} aoSalvo={vi.fn()} />)
    const saldo = screen.getByPlaceholderText("0,00")
    await userEvent.clear(saldo)
    await userEvent.type(saldo, "200000")
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(atualizarSaldoInicial).toHaveBeenCalledWith("k1", { valor: 2000, data: "2026-09-01" })
  })

  it("editar: zerar o saldo inicial manda 0 (a conta passa a começar do zero)", async () => {
    render(<FormularioConta conta={existente} bancos={bancos} aoSair={vi.fn()} aoSalvo={vi.fn()} />)
    await userEvent.clear(screen.getByPlaceholderText("0,00"))
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(atualizarSaldoInicial).toHaveBeenCalledWith("k1", expect.objectContaining({ valor: 0 }))
  })

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

  it("Dinheiro: some banco, agência e número, e vai com tipo 4", async () => {
    vi.mocked(createConta).mockResolvedValue({ id: "nova" })
    renderizar()
    await userEvent.type(screen.getByPlaceholderText("0001"), "0001")
    await userEvent.click(screen.getByRole("radio", { name: "Dinheiro" }))
    expect(screen.queryByPlaceholderText("0001")).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Banco" })).not.toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText("Cofrinho"), "Cofrinho")
    await userEvent.click(screen.getByRole("button", { name: "Adicionar conta" }))
    expect(createConta).toHaveBeenCalledWith(expect.objectContaining({ nome: "Cofrinho", tipo: 4, agencia: undefined, bancoId: undefined }))
  })

  it("Investimentos: vai com tipo 6", async () => {
    vi.mocked(createConta).mockResolvedValue({ id: "nova" })
    renderizar()
    await userEvent.click(screen.getByRole("radio", { name: "Investimentos" }))
    await userEvent.type(screen.getByPlaceholderText("XP"), "XP")
    await userEvent.click(screen.getByRole("button", { name: "Adicionar conta" }))
    expect(createConta).toHaveBeenCalledWith(expect.objectContaining({ nome: "XP", tipo: 6 }))
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
