import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import EstornarPagamentoDialog from "../../pages/CreditCards/EstornarPagamentoDialog"

const estornarPagamento = vi.fn()
vi.mock("../../services/faturaService", () => ({ estornarPagamento: (...a: unknown[]) => estornarPagamento(...a) }))

const notify = vi.fn()
const onClose = vi.fn()
const onEstornado = vi.fn()

function renderDialog(pagamento: { id: string; valor: number } | null = { id: "p1", valor: 2239.87 }) {
  return render(
    <PontesThemeProvider>
      <EstornarPagamentoDialog pagamento={pagamento} onClose={onClose} onEstornado={onEstornado} notify={notify} />
    </PontesThemeProvider>,
  )
}

describe("EstornarPagamentoDialog", () => {
  beforeEach(() => {
    estornarPagamento.mockReset()
    notify.mockReset()
    onClose.mockReset()
    onEstornado.mockReset()
  })

  it("fechado não mostra nada", () => {
    renderDialog(null)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("409 (ex.: já estornado) avisa com a mensagem do servidor, fecha e recarrega", async () => {
    estornarPagamento.mockRejectedValue({ response: { status: 409, data: { message: "Este pagamento já foi estornado." } } })
    renderDialog()

    fireEvent.click(screen.getByRole("button", { name: "Estornar" }))

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: "Este pagamento já foi estornado.", severity: "warning" })))
    expect(onClose).toHaveBeenCalled()
    expect(onEstornado).toHaveBeenCalled()
  })

  it("duplo clique não estorna duas vezes", async () => {
    let resolver: (v: unknown) => void = () => {}
    estornarPagamento.mockReturnValue(new Promise((r) => { resolver = r }))
    renderDialog()

    const botao = screen.getByRole("button", { name: "Estornar" })
    fireEvent.click(botao)
    fireEvent.click(botao)
    resolver({})

    await waitFor(() => expect(onEstornado).toHaveBeenCalledTimes(1))
    expect(estornarPagamento).toHaveBeenCalledTimes(1)
  })

  it("reabrir pra outro pagamento gera chave nova", async () => {
    estornarPagamento.mockResolvedValue({})
    const { rerender } = renderDialog({ id: "p1", valor: 10 })
    fireEvent.click(screen.getByRole("button", { name: "Estornar" }))
    await waitFor(() => expect(estornarPagamento).toHaveBeenCalledTimes(1))

    rerender(
      <PontesThemeProvider>
        <EstornarPagamentoDialog pagamento={{ id: "p2", valor: 20 }} onClose={onClose} onEstornado={onEstornado} notify={notify} />
      </PontesThemeProvider>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Estornar" }))
    await waitFor(() => expect(estornarPagamento).toHaveBeenCalledTimes(2))

    expect(estornarPagamento.mock.calls[1][0]).toBe("p2")
    expect(estornarPagamento.mock.calls[1][1]).not.toBe(estornarPagamento.mock.calls[0][1])
  })
})
