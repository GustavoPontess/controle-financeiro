import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import type { LimiteDoMes, LimitesDoMes } from "../../types/Limite"

const limite = (extra: Partial<LimiteDoMes>): LimiteDoMes => ({
  categoriaId: "mercado", categoria: "Mercado", limite: 1200, gasto: 870, previsto: 0, sobra: 330, percentual: 72.5,
  situacao: "ok", desdeAno: 2026, desdeMes: 8, percentualAlerta: 80, aindaVem: [], resposta: null,
  parcelasFuturas: 0, parcelasAteAno: null, parcelasAteMes: null, ...extra,
})
let mes: LimitesDoMes
vi.mock("../../services/limiteService", () => ({
  getLimitesDoMes: vi.fn(async () => mes),
  getSugestaoLimite: vi.fn(async () => 640),
  definirLimite: vi.fn(async () => mes),
  tirarLimite: vi.fn(async () => ({ ...mes, limites: mes.limites.slice(1) })),
}))
vi.mock("../../services/categoryService", () => ({
  getCategories: vi.fn(async () => [
    { id: "mercado", descricao: "Mercado", finalidade: 1, isPadrao: true },
    { id: "restaurante", descricao: "Restaurante", finalidade: 1, isPadrao: true },
    { id: "lazer", descricao: "Lazer", finalidade: 3, isPadrao: true },
    { id: "salario", descricao: "Salário", finalidade: 2, isPadrao: true },
    { id: "transporte", descricao: "Transporte", finalidade: 1, isPadrao: true },
  ]),
}))
import { definirLimite, getLimitesDoMes, tirarLimite } from "../../services/limiteService"
import OrcamentoDespesas from "../../telas/OrcamentoDespesas"

const aoMudar = vi.fn()
/** A seção no mês da página. */
const Lista = () => <OrcamentoDespesas periodo={OUTUBRO} aoMudar={aoMudar} />
const OUTUBRO = { ano: 2026, mes: 10 }
const renderizar = (inicio: string) => render(
  <MemoryRouter initialEntries={[inicio]}>
    <Routes>
      <Route path="/orcamento" element={<Lista />} />
    </Routes>
  </MemoryRouter>,
)
const outubro = "/orcamento"

describe("Orçamento: Despesas", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mes = {
      ano: 2026, mes: 10, editavel: true, totalLimite: 1900, totalGasto: 1400, totalPrevisto: 90,
      limites: [
        limite({ categoriaId: "restaurante", categoria: "Restaurante", limite: 300, gasto: 410, sobra: -110, percentual: 136.7, situacao: "passou" }),
        limite({
          categoriaId: "lazer", categoria: "Lazer", limite: 400, gasto: 340, sobra: 60, percentual: 85, situacao: "vai-passar", previsto: 90,
          aindaVem: [{ transacaoId: "t1", contaFixaId: "cf-streaming", descricao: "Streaming", data: "2026-10-22", categoriaId: "lazer", categoria: "Lazer", valor: 90 }],
          resposta: "Ainda vem Streaming (dia 22, R$ 90,00). Contando isso, passa R$ 30,00 do planejado.",
          parcelasFuturas: 800, parcelasAteAno: 2027, parcelasAteMes: 1,
        }),
        limite({}),
      ],
      semLimite: [{ categoriaId: "farmacia", categoria: "Farmácia", gasto: 250 }],
    }
  })

  it("planilha aberta: números, situação, sobra negativa, o que ainda vem e quem gastou sem planejado", async () => {
    renderizar(outubro)
    expect(await screen.findByText("Restaurante")).toBeInTheDocument()
    expect(getLimitesDoMes).toHaveBeenCalledWith(2026, 10)
    expect(screen.getByText("R$ 1.900,00")).toBeInTheDocument()
    expect(screen.getByText("R$ 1.400,00")).toBeInTheDocument()

    const lista = screen.getByRole("list", { name: "Despesas" })
    expect(within(lista).getByText("Passou")).toBeInTheDocument()
    expect(within(lista).getByText("Vai passar")).toBeInTheDocument()
    expect(within(lista).getByText("-R$ 110,00")).toBeInTheDocument()
    expect(within(lista).getByText("Ainda vem Streaming (dia 22, R$ 90,00). Contando isso, passa R$ 30,00 do planejado.")).toBeInTheDocument()
    expect(within(lista).queryByText("Sem planejado")).not.toBeInTheDocument() // só o planejado fica na tabela
    expect(within(lista).queryByText("Farmácia")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { expanded: false })).not.toBeInTheDocument() // nada abre ao clicar
  })

  it("muda o planejado na própria linha: Enter salva e avisa a página; Esc desiste", async () => {
    const user = userEvent.setup()
    renderizar(outubro)
    await user.click(await screen.findByRole("button", { name: "Mudar o planejado de Mercado" }))
    const campo = screen.getByRole("textbox")
    expect(campo).toHaveValue("1.200,00")
    await user.keyboard("{Escape}")
    expect(definirLimite).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Mudar o planejado de Mercado" }))
    await user.clear(screen.getByRole("textbox"))
    await user.type(screen.getByRole("textbox"), "150000{Enter}")
    expect(definirLimite).toHaveBeenCalledWith("mercado", 2026, 10, 1500)
    await vi.waitFor(() => expect(aoMudar).toHaveBeenCalledTimes(1))
  })

  it("Planejar categoria abre uma linha nova na tabela, sem botão: Enter salva; sair sem preencher fecha; Esc fecha", async () => {
    const user = userEvent.setup()
    renderizar(outubro)
    expect(await screen.findByText("Categoria")).toBeInTheDocument() // a primeira coluna tem nome
    await user.click(screen.getByRole("button", { name: "Planejar categoria" }))
    const nova = screen.getByRole("listitem", { name: "Nova linha" })
    expect(within(nova).queryByRole("button", { name: /Salvar|Cancelar/ })).not.toBeInTheDocument()
    expect(within(nova).getByRole("combobox", { name: "Categoria" })).toHaveFocus() // abre já no foco

    await user.click(within(nova).getByRole("combobox", { name: "Categoria" }))
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Farmácia"]) // as categorias sem planejado só aparecem aqui
    await user.click(screen.getByRole("option", { name: "Farmácia" }))
    await vi.waitFor(() => expect(within(nova).getByRole("textbox", { name: "Planejado" })).toHaveFocus()) // escolheu, vai pro valor
    await user.keyboard("25000{Enter}")
    expect(definirLimite).toHaveBeenCalledWith("farmacia", 2026, 10, 250)
    await vi.waitFor(() => expect(screen.queryByRole("listitem", { name: "Nova linha" })).not.toBeInTheDocument())

    // Abriu e saiu sem digitar: some. Esc também.
    await user.click(screen.getByRole("button", { name: "Planejar categoria" }))
    await user.click(screen.getByText("Mercado"))
    await vi.waitFor(() => expect(screen.queryByRole("listitem", { name: "Nova linha" })).not.toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: "Planejar categoria" }))
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("listitem", { name: "Nova linha" })).not.toBeInTheDocument()
    expect(definirLimite).toHaveBeenCalledTimes(1)
  })

  it("tirar do planejado confirma, vale do mês em diante e atualiza a lista", async () => {
    const user = userEvent.setup()
    renderizar(outubro)
    await user.click(await screen.findByRole("button", { name: "Tirar Restaurante do planejado" }))
    const dialogo = screen.getByRole("alertdialog")
    expect(dialogo).toHaveTextContent("Sai de outubro de 2026 em diante")
    await user.click(within(dialogo).getByRole("button", { name: "Tirar do planejado" }))
    expect(tirarLimite).toHaveBeenCalledWith("restaurante", 2026, 10)
    expect(screen.queryByText("Restaurante")).not.toBeInTheDocument()
  })

  it("mês que passou só mostra: sem planejar, mudar nem tirar", async () => {
    mes = { ...mes, editavel: false }
    renderizar(outubro)
    expect(await screen.findByText("Mercado")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Planejar/ })).not.toBeInTheDocument() // nem o "Planejar categoria" do fim
    expect(screen.queryByRole("button", { name: /Mudar o planejado/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Tirar/ })).not.toBeInTheDocument()
  })
})
