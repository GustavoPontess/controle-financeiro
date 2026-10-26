import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { FamiliaDetalhe, RateioTransacao } from "../../types/Familia"
import type { Transaction } from "../../types/Transaction"

vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ usuario: { id: "u1", nome: "Gustavo Pontes", email: "" } }) }))
vi.mock("../../services/familiaService", () => ({
  getFamilias: vi.fn(), getFamilia: vi.fn(), getDependentes: vi.fn(), getRateioTransacao: vi.fn(),
  compartilharTransacao: vi.fn(), descompartilharTransacao: vi.fn(), definirRateioTransacao: vi.fn(),
  atribuirDependente: vi.fn(), atribuirResponsavel: vi.fn(),
}))
import {
  compartilharTransacao, definirRateioTransacao, descompartilharTransacao, getDependentes, getFamilia, getFamilias, getRateioTransacao,
} from "../../services/familiaService"
import TransacaoFamilia from "../../telas/TransacaoFamilia"

const familia: FamiliaDetalhe = {
  id: "f1", nome: "Casa Pontes", criadoPorUsuarioId: "u1", criadoEm: "2026-01-01", ehAdmin: true, modoRateioPadrao: 1, limiteAprovacao: null, convitesPendentes: [],
  membros: [
    { id: "m1", usuarioId: "u1", nomeUsuario: "Gustavo Pontes", emailUsuario: "", papel: "", entrouEm: "", papelPermissao: 1, visibilidadeRenda: 1, rendaVisivelPara: [] },
    { id: "m2", usuarioId: "u2", nomeUsuario: "Gabriel Dev", emailUsuario: "", papel: "", entrouEm: "", papelPermissao: 2, visibilidadeRenda: 1, rendaVisivelPara: null },
    { id: "m3", usuarioId: "u3", nomeUsuario: "Marina Dev", emailUsuario: "", papel: "", entrouEm: "", papelPermissao: 3, visibilidadeRenda: 0, rendaVisivelPara: null },
  ],
}
const despesa = (extra: Partial<Transaction> = {}): Transaction => ({ id: "t1", descricao: "Mercado", valor: 100.01, tipo: 1, categoriaId: "c1", data: "2026-10-10", ...extra })
const rateio: RateioTransacao = { modo: 1, familiaId: "f1", membros: [
  { usuarioId: "u1", nome: "Gustavo Pontes", percentual: 50, valor: 50.01, saiuEm: null },
  { usuarioId: "u2", nome: "Gabriel Dev", percentual: 50, valor: 50, saiuEm: null },
  { usuarioId: "u9", nome: "Ana Antiga", percentual: 0, valor: 0, saiuEm: "2026-09-15T10:00:00" },
] }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getFamilias).mockResolvedValue([{ id: "f1", nome: "Casa Pontes", criadoPorUsuarioId: "u1", criadoEm: "", ehAdmin: true, totalMembros: 3 }])
  vi.mocked(getFamilia).mockResolvedValue(familia)
  vi.mocked(getDependentes).mockResolvedValue([{ id: "d1", familiaId: "f1", nome: "Theo", apelido: null, dataNascimento: null, tipo: 1, ativo: true }])
  vi.mocked(getRateioTransacao).mockResolvedValue(rateio)
})

describe("TransacaoFamilia", () => {
  it("despesa só sua: oferece dividir com a família e o pra quem", async () => {
    const aoMudar = vi.fn()
    vi.mocked(compartilharTransacao).mockResolvedValue(undefined as never)
    render(<TransacaoFamilia t={despesa()} aoMudar={aoMudar} />)
    await userEvent.click(await screen.findByRole("button", { name: "Dividir com Casa Pontes" }))
    expect(compartilharTransacao).toHaveBeenCalledWith("t1", "f1")
    await waitFor(() => expect(aoMudar).toHaveBeenCalled())
    expect(await screen.findByRole("combobox", { name: "Pra quem" })).toBeInTheDocument()
  })

  it("sem família não mostra nada", async () => {
    vi.mocked(getFamilias).mockResolvedValue([])
    const { container } = render(<TransacaoFamilia t={despesa()} aoMudar={vi.fn()} />)
    await waitFor(() => expect(getFamilias).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it("dividida: mostra a parte gravada de cada um, quem saiu e quem só vê fora", async () => {
    render(<TransacaoFamilia t={despesa({ familiaId: "f1", statusAprovacao: 0 })} aoMudar={vi.fn()} />)
    const lista = await screen.findByRole("list", { name: "Parte de cada um" })
    const linhas = within(lista).getAllByRole("listitem").map((li) => li.textContent?.replace(/ /g, " "))
    expect(linhas[0]).toBe("Gustavo (você)50%R$ 50,01")
    expect(linhas[1]).toBe("Gabriel50%R$ 50,00")
    expect(linhas[2]).toContain("Ana · saiu em")
    expect(await screen.findByText("Marina só vê: fica fora da divisão.")).toBeInTheDocument()
    expect(screen.getByText("No equilíbrio do mês")).toBeInTheDocument()
  })

  it("do meu jeito: as partes têm que somar 100% antes de salvar", async () => {
    vi.mocked(definirRateioTransacao).mockResolvedValue(undefined as never)
    render(<TransacaoFamilia t={despesa({ familiaId: "f1" })} aoMudar={vi.fn()} />)
    await screen.findByRole("list", { name: "Parte de cada um" })
    await userEvent.click(screen.getByRole("combobox", { name: "Como divide" }))
    await userEvent.click(screen.getByRole("option", { name: /Do meu jeito/ }))
    const gustavo = screen.getByRole("textbox", { name: "Gustavo (você)" })
    await userEvent.clear(gustavo); await userEvent.type(gustavo, "70")
    await userEvent.click(screen.getByRole("button", { name: "Salvar a divisão" }))
    expect(screen.getByRole("alert")).toHaveTextContent("As partes somam 120%; têm que somar 100%.")
    expect(definirRateioTransacao).not.toHaveBeenCalled()

    const gabriel = screen.getByRole("textbox", { name: "Gabriel" })
    await userEvent.clear(gabriel); await userEvent.type(gabriel, "30")
    await userEvent.click(screen.getByRole("button", { name: "Salvar a divisão" }))
    expect(definirRateioTransacao).toHaveBeenCalledWith("t1", 3, [{ usuarioId: "u1", percentual: 70 }, { usuarioId: "u2", percentual: 30 }])
  })

  it("parar de dividir pede confirmação", async () => {
    vi.mocked(descompartilharTransacao).mockResolvedValue(undefined as never)
    render(<TransacaoFamilia t={despesa({ familiaId: "f1", statusAprovacao: 1 })} aoMudar={vi.fn()} />)
    expect(await screen.findByText("Esperando aprovação")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Parar de dividir" }))
    const dialogo = screen.getByRole("alertdialog")
    await userEvent.click(within(dialogo).getByRole("button", { name: "Parar de dividir" }))
    expect(descompartilharTransacao).toHaveBeenCalledWith("t1")
  })
})
