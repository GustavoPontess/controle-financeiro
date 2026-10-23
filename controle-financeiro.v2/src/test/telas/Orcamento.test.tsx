import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import type { FontesDoMes, OrcamentoDoMes } from "../../types/Orcamento"
import type { LimitesDoMes } from "../../types/Limite"

const base: OrcamentoDoMes = {
  ano: 2026, mes: 10, rendaEsperada: 5000, rendaRecebida: 3000, despesasPlanejadas: 2500, despesasGastas: 1800,
  investimentosPlanejados: 300, investido: 100,
  aAlocar: 2200,
  resposta: { tom: "neutro", texto: "Faltam R$ 2.200,00 da renda de outubro sem destino: planeje numa categoria ou guarde numa meta.", acoes: [] },
}
let orcamento: OrcamentoDoMes = base
const receitas: FontesDoMes = {
  ano: 2026, mes: 10, editavel: true, totalPlanejado: 5000, totalRealizado: 3000, totalAindaVem: 0,
  fontes: [{ categoriaId: "renda", subcategoriaId: "salario", nome: "Salário", categoria: "Renda", planejado: 5000, realizado: 3000, aindaVem: 0, desdeAno: 2026, desdeMes: 10 }],
  semPlanejado: [],
}
const despesas: LimitesDoMes = { ano: 2026, mes: 10, editavel: true, totalLimite: 2500, totalGasto: 1800, totalPrevisto: 0, limites: [], semLimite: [] }

vi.mock("../../services/orcamentoService", () => ({ getOrcamentoDoMes: vi.fn(async () => orcamento) }))
vi.mock("../../services/limiteService", () => ({
  getLimitesDoMes: vi.fn(async () => despesas), tirarLimite: vi.fn(),
  getFontesDoMes: vi.fn(async (lado: string) => (lado === "receitas" ? receitas : { ...receitas, totalPlanejado: 0, totalRealizado: 0, fontes: [] })),
  definirFonte: vi.fn(async () => ({ ...receitas, totalPlanejado: 5500 })), tirarFonte: vi.fn(),
}))
import { getOrcamentoDoMes } from "../../services/orcamentoService"
import { getLimitesDoMes } from "../../services/limiteService"
import Orcamento from "../../telas/Orcamento"

const Onde = () => { const l = useLocation(); return <p>em {l.pathname} {JSON.stringify(l.state)}</p> }
const renderizar = (estado?: unknown) => render(
  <MemoryRouter initialEntries={[{ pathname: "/orcamento", state: estado }]}>
    <Routes>
      <Route path="/orcamento" element={<Orcamento />} />
      <Route path="*" element={<Onde />} />
    </Routes>
  </MemoryRouter>,
)

describe("Orçamento", () => {
  beforeEach(() => { vi.clearAllMocks(); orcamento = base })

  it("mostra o a ser alocado, os números que o formam, a resposta e as três seções", async () => {
    renderizar({ ano: 2026, mes: 10 })
    expect(await screen.findByRole("group", { name: "Orçamento de outubro de 2026" })).toHaveTextContent("Outubro de 2026")
    expect(getOrcamentoDoMes).toHaveBeenCalledWith(2026, 10)
    expect(await screen.findByText("A ser alocado")).toBeInTheDocument()
    expect(screen.getByText("A ser alocado").nextSibling).toHaveTextContent("2.200,00")
    expect(screen.getByText("Renda esperada").nextSibling).toHaveTextContent("5.000,00")
    expect(screen.getByText("Despesas planejadas").nextSibling).toHaveTextContent("2.500,00")
    expect(screen.getByText("Investimentos planejados").nextSibling).toHaveTextContent("300,00")
    expect(screen.queryByText(/sem destino/)).not.toBeInTheDocument() // o número grande já diz
    expect(screen.queryByLabelText("Toda a renda tem destino")).not.toBeInTheDocument()
    for (const titulo of ["Receitas", "Despesas", "Investimentos"]) expect(screen.getByRole("heading", { name: titulo })).toBeInTheDocument()
    expect(getLimitesDoMes).toHaveBeenCalledWith(2026, 10)
  })

  it("zerado: marca que toda a renda tem destino", async () => {
    orcamento = { ...base, aAlocar: 0, resposta: { tom: "positivo", texto: "Toda a renda de outubro tem destino.", acoes: [] } }
    renderizar()
    expect(await screen.findByLabelText("Toda a renda tem destino")).toBeInTheDocument()
  })

  it("passou da renda: o a ser alocado fica negativo, em vermelho", async () => {
    orcamento = { ...base, aAlocar: -300, resposta: { tom: "negativo", texto: "O planejado passa a renda esperada de outubro em R$ 300,00.", acoes: [] } }
    renderizar()
    const valor = (await screen.findByText("A ser alocado")).nextSibling!.firstChild as HTMLElement
    expect(valor).toHaveAttribute("data-tom", "negativo")
    expect(valor).toHaveTextContent("-R$ 300,00")
  })

  it("mudar o que espera receber refaz o a ser alocado", async () => {
    const user = userEvent.setup()
    renderizar()
    await user.click(await screen.findByRole("button", { name: "Mudar o esperado de Salário" }))
    expect(getOrcamentoDoMes).toHaveBeenCalledTimes(1)
    await user.clear(screen.getByRole("textbox"))
    await user.type(screen.getByRole("textbox"), "550000{Enter}")
    await vi.waitFor(() => expect(getOrcamentoDoMes).toHaveBeenCalledTimes(2))
  })
})
