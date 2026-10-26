import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("../../services/cartaoCreditoService", () => ({ createCartao: vi.fn(), updateCartao: vi.fn() }))
import { createCartao } from "../../services/cartaoCreditoService"
import FormularioCartao from "../../telas/FormularioCartao"

const renderizar = (aoSalvo = vi.fn()) =>
  render(<FormularioCartao bancos={[]} contas={[]} aoSair={vi.fn()} aoSalvo={aoSalvo} />)

describe("FormularioCartao", () => {
  beforeEach(() => vi.mocked(createCartao).mockReset())

  it("submit vazio bloqueia e mostra o erro em cada campo", async () => {
    renderizar()
    await userEvent.click(screen.getByRole("button", { name: "Adicionar cartão" }))
    expect(screen.getByText("Dê um nome ao cartão.")).toBeInTheDocument()
    expect(screen.getByText("Informe o limite do cartão.")).toBeInTheDocument()
    expect(screen.getAllByText("Escolha o dia.")).toHaveLength(2)
    expect(createCartao).not.toHaveBeenCalled()
  })

  it("últimos dígitos: só número e precisa dos 4", async () => {
    renderizar()
    const digitos = screen.getByPlaceholderText("1234")
    await userEvent.type(digitos, "12a")
    expect(digitos).toHaveValue("12")
    await userEvent.click(screen.getByRole("button", { name: "Adicionar cartão" }))
    expect(screen.getByText("São os 4 últimos números do cartão.")).toBeInTheDocument()
  })

  it("sem crédito e sem débito não salva", async () => {
    renderizar()
    await userEvent.type(screen.getByPlaceholderText("Nubank"), "Caixa")
    await userEvent.click(screen.getByRole("switch", { name: "Crédito" }))
    await userEvent.click(screen.getByRole("button", { name: "Adicionar cartão" }))
    expect(screen.getByText("Marque crédito, débito ou os dois.")).toBeInTheDocument()
    expect(createCartao).not.toHaveBeenCalled()
  })

  it("só débito: salva sem limite nem dias", async () => {
    vi.mocked(createCartao).mockResolvedValue({ id: "novo" } as never)
    const aoSalvo = vi.fn()
    renderizar(aoSalvo)
    await userEvent.type(screen.getByPlaceholderText("Nubank"), "Caixa")
    await userEvent.click(screen.getByRole("switch", { name: "Crédito" }))
    await userEvent.click(screen.getByRole("switch", { name: "Débito" }))
    expect(screen.queryByText("Limite")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Adicionar cartão" }))
    expect(createCartao).toHaveBeenCalledWith(expect.objectContaining({
      nome: "Caixa", temCredito: false, temDebito: true, limite: undefined, diaFechamento: undefined, diaVencimento: undefined,
    }))
    expect(aoSalvo).toHaveBeenCalledWith("novo")
  })
})
