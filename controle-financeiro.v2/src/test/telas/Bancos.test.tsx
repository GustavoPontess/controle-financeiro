import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import type { Conta } from "../../types/Conta"

const conta = (id: string, nome: string, saldoAtual: number, extra: Partial<Conta> = {}): Conta =>
  ({ id, nome, saldoAtual, tipo: 1, tipoDescricao: "", isCarteira: false, ...extra })
let contas: Conta[] = []
vi.mock("../../services/cartaoCreditoService", () => ({
  getCartoes: vi.fn(async () => [{ id: "c1", nome: "Nubank gold", bandeira: 2, ultimosDigitos: "0315", temCredito: true, temDebito: true, ehPrePago: false, diaFechamento: 3, diaVencimento: 10, contaId: "k1", ativo: true, bandeiraDescricao: "" }]),
}))
vi.mock("../../services/contaService", () => ({
  getContas: vi.fn(async () => contas),
  deleteConta: vi.fn(async () => {}),
  reabrirConta: vi.fn(async () => {}),
}))
import { deleteConta, reabrirConta } from "../../services/contaService"
import Bancos from "../../telas/Bancos"

const renderizar = (abrir?: string) => render(
  <MemoryRouter initialEntries={[{ pathname: "/bancos", state: abrir ? { abrir } : null }]}>
    <Routes>
      <Route path="/bancos" element={<Bancos />} />
      <Route path="/bancos/:id/editar" element={<p>editar conta</p>} />
      <Route path="/bancos/:id/encerrar" element={<p>encerrar conta</p>} />
      <Route path="/cartoes/:id" element={<p>página do cartão</p>} />
    </Routes>
  </MemoryRouter>,
)
const lista = () => screen.getByRole("list", { name: "Contas" })
const linha = (nome: RegExp) => within(lista()).getByRole("button", { name: nome })

describe("Bancos — lista com a ficha da conta", () => {
  beforeEach(() => {
    contas = [
      conta("k1", "Nubank", 1139.96, { bancoNome: "NU PAGAMENTOS", numeroConta: "12345-6" }),
      conta("k0", "Carteira", 50, { isCarteira: true, tipo: 2 }), // dado antigo: carteira gravada como poupança
      conta("k4", "XP", 5000, { tipo: 6 }),
      conta("k5", "Cofrinho", 200, { tipo: 4 }),
      conta("k3", "Santander", 0, { encerradaEm: "2026-09-10" }),
    ]
    vi.mocked(deleteConta).mockClear(); vi.mocked(reabrirConta).mockClear()
  })

  it("lista as abertas em grupos (em conta, investimentos, dinheiro por último, com o total) e abre a ficha da conta clicada, uma por vez", async () => {
    renderizar()
    await screen.findByRole("list", { name: "Contas" })
    const nomes = within(lista()).getAllByRole("button").map((b) => b.textContent)
    expect(nomes).toHaveLength(4)
    for (const [i, n] of ["Nubank", "XP", "Carteira", "Cofrinho"].entries()) expect(nomes[i]).toContain(n)
    expect(nomes.some((t) => t?.includes("Santander"))).toBe(false)
    expect(within(screen.getByRole("list", { name: "Em conta" })).getAllByRole("button")).toHaveLength(1)
    expect(within(screen.getByRole("list", { name: "Investimentos" })).getAllByRole("button")).toHaveLength(1)
    // A carteira (mesmo gravada como poupança) e o cofrinho são "Dinheiro"; a carteira primeiro.
    expect(within(screen.getByRole("list", { name: "Dinheiro" })).getAllByRole("button")).toHaveLength(2)
    expect(screen.queryByRole("list", { name: "Poupança" })).not.toBeInTheDocument()
    // Saldo total 6.389,96 · Disponível (Nubank + dinheiro) 1.389,96 · Guardado (XP) 5.000,00
    expect(screen.getAllByText(/6\.389,96/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/1\.389,96/).length).toBeGreaterThan(0)
    expect(screen.queryByText("Cartões")).not.toBeInTheDocument()

    await userEvent.click(linha(/Nubank/))
    expect(linha(/Nubank/)).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("NU PAGAMENTOS")).toBeInTheDocument()
    expect(screen.getByText("12345-6")).toBeInTheDocument()
    // Agência não informada aparece dizendo isso, não some (dá pra ver o que falta preencher).
    expect(screen.getByText("Agência").nextElementSibling).toHaveTextContent("Não informada")
    // O cartão ligado à conta aparece na ficha e leva pra página dele.
    expect(screen.getByText("Cartões")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Nubank gold/ })).toHaveAttribute("href", "/cartoes/c1")
    expect(screen.getByText("Mastercard · •••• 0315 · fecha dia 3 · vence dia 10")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Encerrar" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument()

    // Abrir outra fecha a anterior; a carteira não se exclui nem se encerra.
    await userEvent.click(linha(/Carteira/))
    expect(linha(/Nubank/)).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByText("Dinheiro em mãos", { selector: "dd" })).toBeInTheDocument()
    expect(screen.queryByText("Banco")).not.toBeInTheDocument()
    expect(screen.queryByText("Cartões")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument()
    await userEvent.click(linha(/Carteira/))
    expect(linha(/Carteira/)).toHaveAttribute("aria-expanded", "false")
  })

  it("Encerradas: a conta encerrada tem Reabrir; reabrir recarrega e volta pra Abertas", async () => {
    renderizar()
    await screen.findByRole("list", { name: "Contas" })
    await userEvent.click(screen.getByRole("radio", { name: "Encerradas (1)" }))
    await userEvent.click(linha(/Santander/))
    expect(screen.getByText("10/09/2026", { selector: "dd" })).toBeInTheDocument()
    contas = contas.map((c) => (c.id === "k3" ? { ...c, encerradaEm: null } : c))
    await userEvent.click(screen.getByRole("button", { name: "Reabrir" }))
    expect(reabrirConta).toHaveBeenCalledWith("k3")
    expect(await screen.findByRole("radio", { name: "Abertas", checked: true })).toBeInTheDocument()
    expect(linha(/Santander/)).toHaveAttribute("aria-expanded", "true")
  })

  it("Excluir: pede confirmação, exclui e a conta some da lista", async () => {
    renderizar("k1")
    await screen.findByRole("list", { name: "Contas" })
    expect(linha(/Nubank/)).toHaveAttribute("aria-expanded", "true")
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }))
    const dialogo = await screen.findByRole("alertdialog")
    contas = contas.filter((c) => c.id !== "k1")
    await userEvent.click(within(dialogo).getByRole("button", { name: "Excluir" }))
    expect(deleteConta).toHaveBeenCalledWith("k1")
    expect(await within(lista()).findAllByRole("button")).toHaveLength(3)
    expect(within(lista()).queryByRole("button", { name: /Nubank/ })).not.toBeInTheDocument()
  })

  it("chegar com uma conta encerrada pra abrir já mostra a aba Encerradas", async () => {
    renderizar("k3")
    expect(await screen.findByRole("radio", { name: "Encerradas (1)", checked: true })).toBeInTheDocument()
    expect(linha(/Santander/)).toHaveAttribute("aria-expanded", "true")
  })
})
