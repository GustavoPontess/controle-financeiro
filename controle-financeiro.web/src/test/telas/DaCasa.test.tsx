import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

vi.mock("../../services/familiaService", () => ({ getFamilias: vi.fn(), getFamilia: vi.fn(async () => null) }))
vi.mock("../../services/transactionService", () => ({ createTransaction: vi.fn(async () => ({})), updateTransaction: vi.fn(), avisoDeCompra: vi.fn(async () => null) }))
vi.mock("../../services/transferenciaService", () => ({ createTransferencia: vi.fn() }))
import { getFamilias } from "../../services/familiaService"
import { createTransaction } from "../../services/transactionService"
import DaCasa from "../../telas/DaCasa"
import FormularioTransacao from "../../telas/FormularioTransacao"

const CASA = { id: "f1", nome: "Casa Pontes", criadoPorUsuarioId: "u1", criadoEm: "", ehAdmin: true, totalMembros: 2 }

beforeEach(() => { vi.clearAllMocks(); vi.mocked(getFamilias).mockResolvedValue([CASA]) })

describe("Conta/cartão da casa", () => {
  it("ligar marca a família; desligar manda null", async () => {
    const aoMudar = vi.fn(async () => {})
    render(<DaCasa tipo="cartao" familiaId={null} aoMudar={aoMudar} />)
    const interruptor = await screen.findByRole("switch", { name: "Cartão da casa: as compras já entram divididas com Casa Pontes" })
    await userEvent.click(interruptor)
    expect(aoMudar).toHaveBeenLastCalledWith("f1")
    await waitFor(() => expect(interruptor).toHaveAttribute("aria-checked", "true"))
    await userEvent.click(interruptor)
    expect(aoMudar).toHaveBeenLastCalledWith(null)
  })

  it("sem família não aparece (nem o bloco)", async () => {
    vi.mocked(getFamilias).mockResolvedValue([])
    const { container } = render(<DaCasa tipo="conta" emBloco familiaId={null} aoMudar={vi.fn()} />)
    await waitFor(() => expect(getFamilias).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it("na nova despesa, conta da casa mostra o interruptor ligado e travado e quem divide é o servidor", async () => {
    const contas = [{ id: "k1", nome: "Conjunta", tipo: 1, tipoDescricao: "", saldoAtual: 0, isCarteira: false, familiaId: "f1" }]
    const categorias = [{ id: "cat1", descricao: "Mercado", finalidade: 1, isPadrao: true }]
    render(<MemoryRouter><FormularioTransacao contas={contas as never} cartoes={[]} categorias={categorias as never} subcategorias={[]} aoSair={vi.fn()} aoSalvo={vi.fn()} /></MemoryRouter>)
    await userEvent.type(screen.getByPlaceholderText("0,00"), "5000")
    await userEvent.type(screen.getByPlaceholderText("Mercado"), "Feira")
    await userEvent.click(screen.getByRole("combobox", { name: "Conta" }))
    await userEvent.click(screen.getByRole("option", { name: "Conjunta" }))
    await userEvent.click(screen.getByRole("combobox", { name: "Categoria" }))
    await userEvent.click(screen.getByRole("option", { name: "Mercado" }))
    const interruptor = await screen.findByRole("switch", { name: "Dividir com Casa Pontes (conta da casa)" })
    expect(interruptor).toBeDisabled()
    expect(interruptor).toHaveAttribute("aria-checked", "true")
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }))
    await waitFor(() => expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ familiaId: undefined, contaId: "k1" }), expect.any(String)))
  })
})
