import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

const conta = (id: string, nome: string, saldoAtual: number, extra: Record<string, unknown> = {}) =>
  ({ id, nome, saldoAtual, tipo: 1, tipoDescricao: "", isCarteira: false, ...extra })
let saldoDaConta = 300
vi.mock("../../services/contaService", () => ({
  getConta: vi.fn(async () => conta("k1", "Santander", saldoDaConta)),
  getContas: vi.fn(async () => [conta("k1", "Santander", saldoDaConta), conta("k2", "Nubank", 100), conta("k3", "Carteira", 50, { isCarteira: true })]),
  encerrarConta: vi.fn(),
}))
import { encerrarConta } from "../../services/contaService"
import EncerrarConta from "../../telas/EncerrarConta"

const renderizar = () => render(
  <MemoryRouter initialEntries={["/bancos/k1/encerrar"]}>
    <Routes>
      <Route path="/bancos/:id/encerrar" element={<EncerrarConta />} />
      <Route path="/bancos" element={<p>lista de contas</p>} />
    </Routes>
  </MemoryRouter>,
)
const botaoEncerrar = () => screen.getByRole("button", { name: "Encerrar conta" })

describe("EncerrarConta", () => {
  beforeEach(() => { vi.mocked(encerrarConta).mockReset().mockResolvedValue({} as never); saldoDaConta = 300 })

  it("saldo zerado: encerra direto, sem perguntar do dinheiro", async () => {
    saldoDaConta = 0
    renderizar()
    await screen.findByText("Como vai ficar")
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument()
    await userEvent.click(botaoEncerrar())
    expect(encerrarConta).toHaveBeenCalledWith("k1", {}, expect.any(String))
    expect(await screen.findByText("lista de contas")).toBeInTheDocument()
  })

  it("com saldo: transfere pra conta escolhida (a carteira vem sugerida) e manda a chave", async () => {
    renderizar()
    await screen.findByText("Como vai ficar")
    expect(screen.getByRole("combobox", { name: "Pra qual conta foi" })).toHaveTextContent("Carteira")
    await userEvent.click(botaoEncerrar())
    expect(encerrarConta).toHaveBeenCalledWith("k1", expect.objectContaining({ contaDestinoId: "k3" }), expect.any(String))
  })

  it("com saldo: 'no banco já está zerado' vira ajuste", async () => {
    renderizar()
    await screen.findByText("Como vai ficar")
    await userEvent.click(screen.getByRole("radio", { name: "No banco já está zerado" }))
    expect(screen.queryByRole("combobox", { name: "Pra qual conta foi" })).not.toBeInTheDocument()
    await userEvent.click(botaoEncerrar())
    expect(encerrarConta).toHaveBeenCalledWith("k1", expect.objectContaining({ ajustar: true }), expect.any(String))
  })

  it("recusa do servidor aparece e o retry reusa a mesma chave", async () => {
    vi.mocked(encerrarConta).mockReset()
      .mockRejectedValueOnce({ response: { status: 409, data: { message: "Uma conta fixa ainda usa esta conta." } } })
      .mockResolvedValueOnce({} as never)
    renderizar()
    await screen.findByText("Como vai ficar")
    await userEvent.click(botaoEncerrar())
    expect(await screen.findByText("Uma conta fixa ainda usa esta conta.")).toBeInTheDocument()
    await userEvent.click(botaoEncerrar())
    const [primeira, segunda] = vi.mocked(encerrarConta).mock.calls
    expect(segunda[2]).toBe(primeira[2])
  })
})
