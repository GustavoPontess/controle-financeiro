import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import type { AcertoContas, ContaFixaDaCasa, DespesaCompartilhada, FamiliaDetalhe } from "../../types/Familia"

vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ usuario: { id: "u1", nome: "Gustavo Pontes", email: "" } }) }))
const familia: FamiliaDetalhe = {
  id: "f1", nome: "Casa", criadoPorUsuarioId: "u1", criadoEm: "", ehAdmin: true, modoRateioPadrao: 1, limiteAprovacao: null, convitesPendentes: [],
  membros: [
    { id: "m1", usuarioId: "u1", nomeUsuario: "Gustavo Pontes", emailUsuario: "", papel: "", entrouEm: "", papelPermissao: 1, visibilidadeRenda: 1, rendaVisivelPara: [] },
    { id: "m2", usuarioId: "u2", nomeUsuario: "Gabriel Dev", emailUsuario: "", papel: "", entrouEm: "", papelPermissao: 2, visibilidadeRenda: 1, rendaVisivelPara: null },
  ],
}
const despesa = (extra: Partial<DespesaCompartilhada>): DespesaCompartilhada => ({
  id: "t1", descricao: "Mercado", valor: 200, data: "2026-10-05T00:00:00", categoriaNome: "Alimentação", categoriaId: "c1", pagadorUsuarioId: "u2",
  pagadorNome: "Gabriel Dev", statusAprovacao: 0, aprovadoPorNome: null, responsavelUsuarioId: null, responsavelNome: null, minhaParte: 100, ...extra,
})
const acerto: AcertoContas = {
  id: "a1", deUsuarioId: "u2", deNome: "Gabriel Dev", paraUsuarioId: "u1", paraNome: "Gustavo Pontes", valor: 90, mes: 10, ano: 2026,
  observacao: "Pix da luz", criadoEm: "2026-10-08T12:00:00", data: "2026-10-08", confirmadoEm: "2026-10-08T12:00:00", minhaTransacaoId: null,
}
const contasFixas: ContaFixaDaCasa[] = [
  { recorrenteId: "r1", descricao: "Aluguel", valor: 1500, dia: 5, pagadorUsuarioId: "u1", pagadorNome: "Gustavo Pontes", categoriaNome: "Moradia", ehMinha: true, cobrancaData: "2026-10-05", cobrancaPaga: true, minhaParte: 750 },
  { recorrenteId: "r2", descricao: "Internet", valor: 100, dia: 20, pagadorUsuarioId: "u2", pagadorNome: "Gabriel Dev", categoriaNome: "Casa", ehMinha: false, cobrancaData: "2026-10-20", cobrancaPaga: false, minhaParte: 50 },
]
vi.mock("../../services/familiaService", () => ({
  getFamilia: vi.fn(async () => familia),
  getDespesasFamilia: vi.fn(async () => [despesa({ id: "t1" }), despesa({ id: "t2", descricao: "Luz", categoriaId: "c2", categoriaNome: "Moradia", pagadorUsuarioId: "u1", pagadorNome: "Gustavo Pontes" })]),
  getAcertos: vi.fn(async () => [acerto]),
  getContasFixasFamilia: vi.fn(async () => contasFixas),
  atribuirResponsavel: vi.fn(), cancelarAcerto: vi.fn(), confirmarAcerto: vi.fn(), lancarAcerto: vi.fn(),
  aprovarDespesa: vi.fn(), rejeitarDespesa: vi.fn(),
}))
vi.mock("../../services/contaService", () => ({ getContas: vi.fn(async () => []) }))
import { getAcertos, getDespesasFamilia } from "../../services/familiaService"
import FamiliaTransacoes from "../../telas/FamiliaTransacoes"
import FamiliaContasFixas from "../../telas/FamiliaContasFixas"

const NovaFixa = () => { const { state } = useLocation(); return <p>nova conta fixa {JSON.stringify(state)}</p> }
const abrir = (rota: string) => render(
  <MemoryRouter initialEntries={[rota]}>
    <Routes>
      <Route path="/familias/:id/transacoes" element={<FamiliaTransacoes />} />
      <Route path="/familias/:id/contas-fixas" element={<FamiliaContasFixas />} />
      <Route path="/contas-fixas/nova" element={<NovaFixa />} />
    </Routes>
  </MemoryRouter>,
)

beforeEach(() => vi.clearAllMocks())

describe("Transações da família", () => {
  it("as despesas e o dinheiro entre vocês numa lista só, do mais recente pro mais antigo", async () => {
    abrir("/familias/f1/transacoes")
    const mes = await screen.findByRole("list", { name: "Outubro de 2026" })
    const titulos = within(mes).getAllByRole("listitem").map((li) => li.textContent ?? "")
    expect(titulos[0]).toContain("Gabriel") // o acerto (dia 8) antes das despesas do dia 5
    expect(titulos[0]).toContain("Pix da luz")
    expect(titulos.some((t) => t.includes("Mercado"))).toBe(true)
  })

  it("os filtros vão pro servidor; com categoria, o dinheiro entre vocês sai", async () => {
    abrir("/familias/f1/transacoes")
    await screen.findByRole("list", { name: "Outubro de 2026" })
    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }))
    const painel = screen.getByRole("dialog", { name: "Filtros" })
    await userEvent.click(within(painel).getByRole("combobox", { name: "Quem pagou" }))
    await userEvent.click(screen.getByRole("option", { name: "Gabriel" }))
    await userEvent.click(within(painel).getByRole("combobox", { name: "Categoria" }))
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Qualquer categoria", "Alimentação", "Moradia"])
    await userEvent.click(screen.getByRole("option", { name: "Alimentação" }))
    await userEvent.click(within(painel).getByRole("button", { name: "Aplicar" }))

    await waitFor(() => expect(getDespesasFamilia).toHaveBeenLastCalledWith("f1", expect.any(Number), expect.any(Number),
      { pagadorId: "u2", categoriaId: "c1", situacao: undefined }))
    expect(screen.getByRole("button", { name: /Filtros/ })).toHaveTextContent("2")
    expect(vi.mocked(getAcertos).mock.calls.every((c) => c[3] === undefined)).toBe(true) // com categoria nem pede
  })
})

describe("Contas fixas da casa", () => {
  it("quem paga, se já saiu ou quando vem, e a sua parte; só a minha abre a conta fixa", async () => {
    abrir("/familias/f1/contas-fixas")
    const lista = await screen.findByRole("list", { name: "Outubro de 2026" })
    expect(lista).toHaveTextContent("Você paga · todo dia 5 · Moradia")
    expect(lista).toHaveTextContent("Saiu dia 05/10")
    expect(lista).toHaveTextContent("Gabriel paga · todo dia 20")
    expect(lista).toHaveTextContent("Vem dia 20/10")
    expect(lista.textContent?.replace(/ /g, " ")).toContain("sua parte R$ 50,00")
    await userEvent.click(within(lista).getByRole("button", { name: /Aluguel/ }))
    expect(screen.getByRole("link", { name: "Abrir a conta fixa" })).toHaveAttribute("href", "/contas-fixas/r1")
    await userEvent.click(within(lista).getByRole("button", { name: /Internet/ }))
    expect(screen.getAllByRole("link", { name: "Abrir a conta fixa" })).toHaveLength(1)

    await userEvent.click(screen.getByRole("button", { name: "Nova" }))
    expect(screen.getByText(/nova conta fixa/)).toHaveTextContent('"familiaId":"f1"')
  })
})
