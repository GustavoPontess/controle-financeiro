import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
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
import Limites from "../../telas/Limites"
import LimiteFormulario from "../../telas/LimiteFormulario"

const Onde = () => { const l = useLocation(); return <p>em {l.pathname}{l.search} {JSON.stringify(l.state)}</p> }
const renderizar = (inicio: string | { pathname: string; state: unknown }, lista = true) => render(
  <MemoryRouter initialEntries={[inicio]}>
    <Routes>
      <Route path="/limites" element={lista ? <Limites /> : <Onde />} />
      <Route path="/limites/novo" element={lista ? <Onde /> : <LimiteFormulario modo="novo" />} />
      <Route path="/limites/editar" element={lista ? <Onde /> : <LimiteFormulario modo="editar" />} />
    </Routes>
  </MemoryRouter>,
)
const outubro = { pathname: "/limites", state: { ano: 2026, mes: 10 } }

describe("Limites", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mes = {
      ano: 2026, mes: 10, editavel: true, totalLimite: 1900, totalGasto: 1400, totalPrevisto: 90,
      limites: [
        limite({ categoriaId: "restaurante", categoria: "Restaurante", limite: 300, gasto: 410, sobra: -110, percentual: 136.7, situacao: "passou" }),
        limite({
          categoriaId: "lazer", categoria: "Lazer", limite: 400, gasto: 340, sobra: 60, percentual: 85, situacao: "vai-passar", previsto: 90,
          aindaVem: [{ transacaoId: "t1", contaFixaId: "cf-streaming", descricao: "Streaming", data: "2026-10-22", categoriaId: "lazer", categoria: "Lazer", valor: 90 }],
          resposta: "Ainda vem Streaming (dia 22, R$ 90,00). Contando isso, passa R$ 30,00 do limite.",
          parcelasFuturas: 800, parcelasAteAno: 2027, parcelasAteMes: 1,
        }),
        limite({}),
      ],
      semLimite: [{ categoriaId: "farmacia", categoria: "Farmácia", gasto: 250 }],
    }
  })

  it("mostra o mês, os três números, quem passou e quem está perto primeiro, e quem gastou sem limite", async () => {
    renderizar(outubro)
    expect(await screen.findByText("Limites de outubro de 2026")).toBeInTheDocument()
    expect(getLimitesDoMes).toHaveBeenCalledWith(2026, 10)
    expect(screen.getByText("R$ 1.900,00")).toBeInTheDocument()
    expect(screen.getByText("R$ 1.400,00")).toBeInTheDocument()
    expect(screen.getByText("Sobra")).toBeInTheDocument()

    const lista = screen.getByRole("list", { name: "Limites" })
    expect(within(lista).getByText("Passou")).toBeInTheDocument()
    expect(within(lista).getByText("Vai passar")).toBeInTheDocument()
    expect(within(lista).getByText(/a mais/)).toHaveTextContent("R$ 110,00 a mais")
    expect(within(lista).getByText(/ainda vem/)).toHaveTextContent("R$ 90,00 ainda vem")
    expect(within(lista).getByText("Sem limite")).toBeInTheDocument()
    expect(within(lista).getByText("Farmácia")).toBeInTheDocument()
  })

  it("a ficha do que vai passar lista o que ainda vem (com a conta fixa) e responde", async () => {
    const user = userEvent.setup()
    renderizar(outubro)
    await user.click(await screen.findByText("Lazer"))
    const vem = screen.getByRole("list", { name: "Ainda vem este mês" })
    expect(within(vem).getByRole("link")).toHaveAttribute("href", "/contas-fixas/cf-streaming")
    expect(within(vem).getByRole("link")).toHaveTextContent("Streaming · dia 22")
    expect(screen.getByText("Ainda vem Streaming (dia 22, R$ 90,00). Contando isso, passa R$ 30,00 do limite.")).toBeInTheDocument()
    expect(screen.queryByText("Ainda vai cair")).not.toBeInTheDocument()
    expect(screen.getByText("Parcelas já compradas pros próximos meses").nextSibling).toHaveTextContent("R$ 800,00 até janeiro de 2027")
  })

  it("Novo limite e Pôr limite levam pro formulário no mesmo mês", async () => {
    const user = userEvent.setup()
    renderizar(outubro)
    await user.click(await screen.findByText("Farmácia"))
    await user.click(screen.getByRole("button", { name: "Pôr limite" }))
    expect(screen.getByText(/em \/limites\/novo\?ano=2026&mes=10&categoria=farmacia/)).toBeInTheDocument()
  })

  it("tirar limite confirma, vale do mês em diante e atualiza a lista", async () => {
    const user = userEvent.setup()
    renderizar(outubro)
    await user.click(await screen.findByText("Restaurante"))
    await user.click(screen.getByRole("button", { name: "Tirar limite" }))
    const dialogo = screen.getByRole("alertdialog")
    expect(dialogo).toHaveTextContent("Sai de outubro de 2026 em diante")
    await user.click(within(dialogo).getByRole("button", { name: "Tirar limite" }))
    expect(tirarLimite).toHaveBeenCalledWith("restaurante", 2026, 10)
    expect(screen.queryByText("Restaurante")).not.toBeInTheDocument()
  })

  it("mês que passou só mostra: sem Novo limite, sem Editar nem Tirar", async () => {
    const user = userEvent.setup()
    mes = { ...mes, editavel: false }
    renderizar(outubro)
    await user.click(await screen.findByText("Mercado"))
    expect(screen.queryByRole("button", { name: /Novo limite/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Tirar limite" })).not.toBeInTheDocument()
  })

  it("novo: bloqueia vazio; só categorias de gasto sem limite; a média preenche; salva e volta pro mês com a linha aberta", async () => {
    const user = userEvent.setup()
    renderizar("/limites/novo?ano=2026&mes=10", false)
    await user.click(await screen.findByRole("button", { name: "Pôr limite" }))
    expect(screen.getByText("Escolha a categoria.")).toBeInTheDocument()
    expect(screen.getByText("Diga o limite.")).toBeInTheDocument()
    expect(definirLimite).not.toHaveBeenCalled()
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument()

    await user.click(screen.getByRole("combobox"))
    // Salário é receita; Mercado, Restaurante e Lazer já têm limite (mudam por Editar).
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Transporte"])
    await user.click(screen.getByRole("option", { name: "Transporte" }))
    expect(screen.queryByText("Escolha a categoria.")).not.toBeInTheDocument()
  })

  it("novo com categoria: média dos 3 meses e salvar", async () => {
    const user = userEvent.setup()
    mes = { ...mes, limites: [] }
    renderizar("/limites/novo?ano=2026&mes=10&categoria=mercado", false)
    expect(await screen.findByText(/gastou em média/)).toHaveTextContent("R$ 640,00")
    await user.click(screen.getByRole("button", { name: "Usar a média" }))
    expect(screen.getByLabelText("Limite por mês")).toHaveValue("640,00")
    await user.click(screen.getByRole("button", { name: "Pôr limite" }))
    expect(definirLimite).toHaveBeenCalledWith("mercado", 2026, 10, 640)
    expect(await screen.findByText(/em \/limites/)).toHaveTextContent('{"ano":2026,"mes":10,"abrir":"lim-mercado"}')
  })

  it("editar: categoria fixa e o valor atual preenchido", async () => {
    const user = userEvent.setup()
    renderizar("/limites/editar?ano=2026&mes=10&categoria=mercado", false)
    expect(await screen.findByRole("heading", { name: "Editar limite de Mercado" })).toBeInTheDocument()
    expect(screen.getByLabelText("Limite por mês")).toHaveValue("1.200,00")
    await user.clear(screen.getByLabelText("Limite por mês"))
    await user.type(screen.getByLabelText("Limite por mês"), "150000")
    await user.click(screen.getByRole("button", { name: "Salvar" }))
    expect(definirLimite).toHaveBeenCalledWith("mercado", 2026, 10, 1500)
  })
})
