import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import type { OrcamentoDoMes } from "../../types/Orcamento"
import type { RendaMes } from "../../types/Renda"
import type { LimitesDoMes } from "../../types/Limite"

const base: OrcamentoDoMes = {
  ano: 2026, mes: 10, rendaEsperada: 5000, rendaRecebida: 3000, despesasPlanejadas: 2500, despesasGastas: 1800,
  praGuardar: 300, guardadoNoMes: 100,
  metas: [{ id: "m1", nome: "Viagem", icone: "viagem", porMes: 300, guardadoNoMes: 100, falta: 2100 }],
  aAlocar: 2200,
  resposta: { tom: "neutro", texto: "Faltam R$ 2.200,00 da renda de outubro sem destino: planeje numa categoria ou guarde numa meta.", acoes: [] },
}
let orcamento: OrcamentoDoMes = base
const renda: RendaMes = {
  ano: 2026, mes: 10, previsto: 5000, fixaEsperada: 5000, variavelEsperada: 0, declaradoNoMes: true, recebido: 3000, falta: 2000,
  sugestaoMedia3Meses: null, entradas: [],
}
const despesas: LimitesDoMes = { ano: 2026, mes: 10, editavel: true, totalLimite: 2500, totalGasto: 1800, totalPrevisto: 0, limites: [], semLimite: [] }

vi.mock("../../services/orcamentoService", () => ({ getOrcamentoDoMes: vi.fn(async () => orcamento) }))
vi.mock("../../services/rendaService", () => ({
  getRendaMes: vi.fn(async () => renda),
  definirRendaPrevista: vi.fn(async () => ({ ...renda, fixaEsperada: 5500, previsto: 5500 })),
  limparRendaPrevista: vi.fn(async () => renda),
}))
vi.mock("../../services/limiteService", () => ({ getLimitesDoMes: vi.fn(async () => despesas), tirarLimite: vi.fn() }))
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
    expect(await screen.findByText("Orçamento de outubro de 2026")).toBeInTheDocument()
    expect(getOrcamentoDoMes).toHaveBeenCalledWith(2026, 10)
    expect(await screen.findByText("A ser alocado")).toBeInTheDocument()
    expect(screen.getByText("A ser alocado").nextSibling).toHaveTextContent("2.200,00")
    expect(screen.getByText("Renda esperada").nextSibling).toHaveTextContent("5.000,00")
    expect(screen.getByText("Despesas planejadas").nextSibling).toHaveTextContent("2.500,00")
    expect(screen.getByText("Pra guardar").nextSibling).toHaveTextContent("300,00")
    expect(screen.getByText(/sem destino/)).toBeInTheDocument()
    expect(screen.queryByLabelText("Toda a renda tem destino")).not.toBeInTheDocument()
    for (const titulo of ["Receita", "Despesas", "Guardar"]) expect(screen.getByRole("heading", { name: titulo })).toBeInTheDocument()
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

  it("Guardar: a meta mostra o mês e leva pro guardar, voltando pro orçamento", async () => {
    const user = userEvent.setup()
    renderizar()
    const metas = await screen.findByRole("list", { name: "Metas do mês" })
    expect(within(metas).getByText("Viagem")).toBeInTheDocument()
    expect(within(metas).getByText(/falta/)).toHaveTextContent("falta R$ 200,00")
    await user.click(within(metas).getByText("Viagem"))
    await user.click(screen.getByRole("button", { name: "Guardar" }))
    expect(screen.getByText(/em \/metas\/m1\/guardar/)).toHaveTextContent('{"voltarPara":"/orcamento"}')
  })

  it("mudar o que espera receber refaz o a ser alocado", async () => {
    const user = userEvent.setup()
    renderizar()
    const fixa = await screen.findByRole("textbox", { name: "Fixa (salário, aposentadoria, benefício)" })
    expect(getOrcamentoDoMes).toHaveBeenCalledTimes(1)
    await user.clear(fixa)
    await user.type(fixa, "550000")
    await user.click(screen.getByRole("button", { name: "Salvar" }))
    await vi.waitFor(() => expect(getOrcamentoDoMes).toHaveBeenCalledTimes(2))
  })
})
