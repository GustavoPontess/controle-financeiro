import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import type { RendaMes } from "../../types/Renda"

vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ usuario: { id: "u1", nome: "Gabriel Dev", email: "dev@pontes.app" } }) }))
let renda: RendaMes = {
  ano: 2026, mes: 10, previsto: 4450, fixas: 3250, variavelEsperada: 1200, variavelDoMes: false, recebido: 3400, falta: 1050, sugestaoMedia3Meses: 3900,
  entradas: [
    { id: "t1", data: "2026-10-05", descricao: "Salário", valor: 3000, subcategoria: "Salário", recebida: true, contaFixa: true },
    { id: "t2", data: "2026-10-12", descricao: "Comissão de vendas", valor: 400, subcategoria: "Comissão e variável", recebida: true, contaFixa: false },
    { id: "t3", data: "2026-10-01", descricao: "Aluguel da garagem", valor: 250, subcategoria: "Aluguel recebido", recebida: false, contaFixa: true },
  ],
}
vi.mock("../../services/rendaService", () => ({
  getRendaMes: vi.fn(async () => renda),
  definirVariavelEsperada: vi.fn(async (_a: number, _m: number, v: number | null) => ({ ...renda, variavelEsperada: v ?? 1200, variavelDoMes: v !== null, previsto: 3250 + (v ?? 1200) })),
  definirVisibilidadeRenda: vi.fn(async () => {}),
}))
vi.mock("../../services/familiaService", () => ({
  getFamilias: vi.fn(async () => [{ id: "f1", nome: "Casa Dev", criadoPorUsuarioId: "u1", criadoEm: "", ehAdmin: true, totalMembros: 3 }]),
  getFamilia: vi.fn(async () => ({ id: "f1", nome: "Casa Dev", criadoPorUsuarioId: "u1", criadoEm: "", ehAdmin: true, modoRateioPadrao: 2, limiteAprovacao: null, convitesPendentes: [],
    membros: [
      { id: "m1", usuarioId: "u1", nomeUsuario: "Gabriel Dev", emailUsuario: "", papel: "", entrouEm: "", papelPermissao: 1, visibilidadeRenda: 1, rendaVisivelPara: [] },
      { id: "m2", usuarioId: "u2", nomeUsuario: "Marina Dev", emailUsuario: "", papel: "", entrouEm: "", papelPermissao: 2, visibilidadeRenda: 1, rendaVisivelPara: null },
      { id: "m3", usuarioId: "u3", nomeUsuario: "Theo Dev", emailUsuario: "", papel: "", entrouEm: "", papelPermissao: 3, visibilidadeRenda: 1, rendaVisivelPara: null },
    ] })),
}))
import { definirVariavelEsperada, definirVisibilidadeRenda } from "../../services/rendaService"
import Renda from "../../telas/Renda"

const renderizar = () => render(<MemoryRouter><Renda /></MemoryRouter>)

describe("Renda", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("mostra previsto × recebido, de onde vem o previsto (fixas + variável herdada) e as entradas do mês", async () => {
    renderizar()
    expect(await screen.findByText("Previsto")).toBeInTheDocument()
    expect(screen.getByText("Previsto").nextSibling).toHaveTextContent("4.450,00")
    expect(screen.getByText("Recebido").nextSibling).toHaveTextContent("3.400,00")
    expect(screen.getByText("Falta").nextSibling).toHaveTextContent("1.050,00")
    const composicao = screen.getByLabelText("De onde vem o previsto")
    expect(composicao).toHaveTextContent("3.250,00")
    expect(composicao).toHaveTextContent("vale a do mês anterior")
    const entradas = screen.getByRole("list", { name: "Entradas do mês" })
    expect(within(entradas).getAllByRole("listitem")).toHaveLength(3)
    expect(entradas).toHaveTextContent("ainda vai cair")
  })

  it("salva a variável esperada do mês e limpa (volta a herdar)", async () => {
    renderizar()
    await screen.findByText("Previsto")
    const campo = screen.getByRole("textbox", { name: "Quanto você espera de comissão, bico, extra" })
    expect(campo).toHaveValue("1.200,00")
    await userEvent.clear(campo)
    await userEvent.type(campo, "200000")
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(definirVariavelEsperada).toHaveBeenCalledWith(2026, expect.any(Number), 2000)
    expect(await screen.findByRole("button", { name: "Limpar" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Limpar" }))
    expect(definirVariavelEsperada).toHaveBeenLastCalledWith(2026, expect.any(Number), null)
  })

  it("quem vê a sua renda: por família, o nível; 'pra quem eu marcar' lista as outras pessoas", async () => {
    renderizar()
    const lista = await screen.findByRole("list", { name: "Famílias" })
    expect(lista).toHaveTextContent("Casa Dev")
    await userEvent.click(screen.getByRole("combobox", { name: "O que Casa Dev vê da sua renda" }))
    await userEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: /O valor, pra quem eu marcar/ }))
    expect(definirVisibilidadeRenda).toHaveBeenCalledWith("f1", "m1", 2, [])
    const quem = screen.getByRole("group", { name: "Quem vê o valor em Casa Dev" })
    expect(within(quem).queryByText(/Gabriel/)).not.toBeInTheDocument() // a própria pessoa não aparece
    await userEvent.click(within(quem).getByRole("checkbox", { name: /Marina/ }))
    expect(definirVisibilidadeRenda).toHaveBeenLastCalledWith("f1", "m1", 2, ["u2"])
    expect(quem).toHaveTextContent("só vê a família, não vê renda") // o Theo, que só vê
  })
})
