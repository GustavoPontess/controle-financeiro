import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import type { FontesDoMes } from "../../types/Orcamento"

const base: FontesDoMes = {
  ano: 2026, mes: 10, editavel: true, totalPlanejado: 5800, totalRealizado: 5300, totalAindaVem: 200,
  fontes: [
    { categoriaId: "renda", subcategoriaId: "salario", nome: "Salário", categoria: "Renda", planejado: 5000, realizado: 5000, aindaVem: 0, desdeAno: 2026, desdeMes: 8 },
    { categoriaId: "renda", subcategoriaId: "freela", nome: "Freela", categoria: "Renda", planejado: 800, realizado: 300, aindaVem: 200, desdeAno: 2026, desdeMes: 9 },
  ],
  semPlanejado: [
    { categoriaId: "renda", subcategoriaId: "aluguel", nome: "Aluguel", categoria: "Renda", realizado: 900, aindaVem: 0, planejavel: true },
    { categoriaId: null, subcategoriaId: null, nome: "Sem categoria", categoria: "Sem categoria", realizado: 12.34, aindaVem: 0, planejavel: false },
  ],
}
let fontes: FontesDoMes = base
vi.mock("../../services/limiteService", () => ({
  getFontesDoMes: vi.fn(async () => fontes),
  definirFonte: vi.fn(async () => fontes),
  tirarFonte: vi.fn(async () => ({ ...fontes, fontes: fontes.fontes.slice(0, 1) })),
  getLimitesDoMes: vi.fn(async () => ({ ano: 2026, mes: 10, editavel: true, totalLimite: 0, totalGasto: 0, totalPrevisto: 0, limites: [], semLimite: [] })),
  definirLimite: vi.fn(),
  getSugestaoLimite: vi.fn(async () => null),
}))
import { definirFonte, getFontesDoMes, tirarFonte } from "../../services/limiteService"
import OrcamentoFontes from "../../telas/OrcamentoFontes"

const aoMudar = vi.fn()
const renderizar = (lado: "receitas" | "investimentos" = "receitas") => render(
  <MemoryRouter><OrcamentoFontes lado={lado} periodo={{ ano: 2026, mes: 10 }} aoMudar={aoMudar} /></MemoryRouter>,
)

describe("Orçamento: Receitas", () => {
  beforeEach(() => { vi.clearAllMocks(); fontes = base })

  it("uma linha por fonte planejada (esperado, recebido, falta); o que não tem esperado não aparece na tabela", async () => {
    renderizar()
    expect((await screen.findAllByText("Esperado"))[0].nextSibling).toHaveTextContent("5.800,00")
    expect(screen.getAllByText("Recebido")[0].nextSibling).toHaveTextContent("5.300,00")
    expect(screen.getAllByText("Falta")[0].nextSibling).toHaveTextContent("500,00")
    const lista = screen.getByRole("list", { name: "Receitas" })
    expect(within(lista).getByRole("button", { name: "Mudar o esperado de Freela" })).toHaveTextContent("800,00")
    expect(within(lista).getByText(/ainda vai cair/)).toHaveTextContent("R$ 200,00 ainda vai cair")
    expect(within(lista).queryByText("Sem planejado")).not.toBeInTheDocument()
    expect(within(lista).queryByText("Aluguel")).not.toBeInTheDocument()
  })

  it("muda o esperado na linha e avisa a página; tira pela lixeira", async () => {
    const user = userEvent.setup()
    renderizar()
    await user.click(await screen.findByRole("button", { name: "Mudar o esperado de Freela" }))
    await user.clear(screen.getByRole("textbox"))
    await user.type(screen.getByRole("textbox"), "100000{Enter}")
    expect(definirFonte).toHaveBeenCalledWith("receitas", "renda", "freela", 2026, 10, 1000)
    await vi.waitFor(() => expect(aoMudar).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole("button", { name: "Tirar Freela do planejado" }))
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Tirar do planejado" }))
    expect(tirarFonte).toHaveBeenCalledWith("receitas", "renda", "freela", 2026, 10)
  })

  it("Planejar categoria abre a linha nova com as categorias de receita ainda sem esperado; salva sem sair da tela", async () => {
    const user = userEvent.setup()
    renderizar()
    expect(await screen.findByText("Categoria")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Planejar categoria" }))
    const nova = screen.getByRole("listitem", { name: "Nova linha" })
    await user.click(within(nova).getByRole("combobox", { name: "Categoria" }))
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Aluguel · Renda"]) // a fonte e a categoria dela; "Sem categoria" não se planeja
    await user.click(screen.getByRole("option", { name: /Aluguel/ }))
    await vi.waitFor(() => expect(within(nova).getByRole("textbox", { name: "Esperado" })).toHaveFocus())
    // Saiu da linha com categoria e valor: salva (sem botão).
    await user.keyboard("90000")
    await user.tab()
    await vi.waitFor(() => expect(definirFonte).toHaveBeenCalledWith("receitas", "renda", "aluguel", 2026, 10, 900))
  })
})

describe("Orçamento: Investimentos (a mesma peça)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fontes = {
      ano: 2026, mes: 10, editavel: true, totalPlanejado: 1000, totalRealizado: 900, totalAindaVem: 0,
      fontes: [{ categoriaId: "inv", subcategoriaId: "tesouro", nome: "Tesouro Direto", categoria: "Investimentos", planejado: 1000, realizado: 900, aindaVem: 0, desdeAno: 2026, desdeMes: 10 }],
      semPlanejado: [{ categoriaId: "inv", subcategoriaId: "acoes", nome: "Ações e fundos", categoria: "Investimentos", realizado: 0, aindaVem: 0, planejavel: true }],
    }
  })

  it("pede as fontes de investimento e mostra Planejado · Investido · Falta (sem meta no meio)", async () => {
    const user = userEvent.setup()
    renderizar("investimentos")
    expect(await screen.findByRole("heading", { name: "Investimentos" })).toBeInTheDocument()
    expect(getFontesDoMes).toHaveBeenCalledWith("investimentos", 2026, 10)
    expect(screen.getAllByText("Planejado")[0].nextSibling).toHaveTextContent("1.000,00")
    expect(screen.getAllByText("Investido")[0].nextSibling).toHaveTextContent("900,00")
    expect(screen.queryByText(/Metas/)).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Planejar categoria" }))
    const nova = screen.getByRole("listitem", { name: "Nova linha" })
    await user.click(within(nova).getByRole("combobox", { name: "Categoria" }))
    await user.click(screen.getByRole("option", { name: /Ações e fundos/ }))
    await user.type(within(nova).getByRole("textbox", { name: "Planejado" }), "20000{Enter}")
    expect(definirFonte).toHaveBeenCalledWith("investimentos", "inv", "acoes", 2026, 10, 200)
  })
})
