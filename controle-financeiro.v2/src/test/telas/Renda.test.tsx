import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import type { RendaMes } from "../../types/Renda"

const base: RendaMes = {
  ano: 2026, mes: 10, previsto: 4200, fixaEsperada: 3000, variavelEsperada: 1200, declaradoNoMes: false, recebido: 3400, falta: 800, sugestaoMedia3Meses: 3900,
  entradas: [
    { id: "t1", data: "2026-10-05", descricao: "Salário", valor: 3000, subcategoria: "Salário", recebida: true },
    { id: "t2", data: "2026-10-12", descricao: "Comissão de vendas", valor: 400, subcategoria: "Comissão e variável", recebida: true },
    { id: "t3", data: "2026-10-01", descricao: "Aluguel da garagem", valor: 250, subcategoria: "Aluguel recebido", recebida: false },
  ],
}
let renda: RendaMes = base
vi.mock("../../services/rendaService", () => ({
  getRendaMes: vi.fn(async () => renda),
  definirRendaPrevista: vi.fn(async (_a: number, _m: number, f: number, v: number) => ({ ...renda, fixaEsperada: f, variavelEsperada: v, previsto: f + v, declaradoNoMes: true })),
  limparRendaPrevista: vi.fn(async () => ({ ...base, declaradoNoMes: false })),
}))
vi.mock("../../services/dinheiroDoMesService", () => ({
  getDinheiroDoMes: vi.fn(async () => ({
    ano: 2026, mes: 10, rendaEsperada: 4200, rendaRecebida: 3400, rendaBase: 4200, jaSaiu: 3000, aindaVemTotal: 0, livre: 1200, percentualUsado: 71.4,
    jaSaiuPorCategoria: [{ categoriaId: "moradia", nome: "Moradia", valor: 3000, percentualDaRenda: 71.4 }],
    aindaVem: [], resposta: { tom: "positivo", texto: "Fecha o mês com R$ 1.200,00 sobrando.", acoes: [] },
    faturas: [], faturasAPagar: 0, parcelasFuturas: { total: 0, ateAno: null, ateMes: null, porMes: [] },
  })),
}))
import { definirRendaPrevista, limparRendaPrevista } from "../../services/rendaService"
import { getDinheiroDoMes } from "../../services/dinheiroDoMesService"
import Renda from "../../telas/Renda"

const renderizar = () => render(<MemoryRouter><Renda /></MemoryRouter>)

describe("Renda", () => {
  beforeEach(() => { vi.clearAllMocks(); renda = base })

  it("mostra esperado × recebido, o que a pessoa declarou (herdado) e as entradas do mês, sem falar em conta fixa", async () => {
    renderizar()
    expect(await screen.findByText("Esperado")).toBeInTheDocument()
    expect(screen.getByText("Esperado").nextSibling).toHaveTextContent("4.200,00")
    expect(screen.getByText("Recebido").nextSibling).toHaveTextContent("3.400,00")
    expect(screen.getByText("Falta").nextSibling).toHaveTextContent("800,00")
    const esperado = screen.getByLabelText("O que você espera receber")
    expect(esperado).toHaveTextContent("vale o que você declarou antes")
    expect(screen.getByRole("textbox", { name: "Fixa (salário, aposentadoria, benefício)" })).toHaveValue("3.000,00")
    expect(screen.getByRole("textbox", { name: "Variável (comissão, bico, extra)" })).toHaveValue("1.200,00")
    expect(screen.queryByText(/conta fixa/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Quem vê/)).not.toBeInTheDocument()
    const entradas = screen.getByRole("list", { name: "Entradas do mês" })
    expect(within(entradas).getAllByRole("listitem")).toHaveLength(3)
    expect(entradas).toHaveTextContent("ainda vai cair")
  })

  it("salvar só liga quando mudou; manda fixa e variável; limpar o mês volta a herdar", async () => {
    renderizar()
    await screen.findByText("Esperado")
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled()
    const variavel = screen.getByRole("textbox", { name: "Variável (comissão, bico, extra)" })
    await userEvent.clear(variavel)
    await userEvent.type(variavel, "200000")
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(definirRendaPrevista).toHaveBeenCalledWith(2026, expect.any(Number), 3000, 2000)
    await userEvent.click(await screen.findByRole("button", { name: "Limpar este mês" }))
    expect(limparRendaPrevista).toHaveBeenCalledWith(2026, expect.any(Number))
  })

  it("sem nada declarado, sugere a média dos últimos meses e usa como esperado num clique", async () => {
    renda = { ...base, previsto: 0, fixaEsperada: 0, variavelEsperada: 0, falta: 0 }
    renderizar()
    await screen.findByText("Esperado")
    expect(screen.getByText(/caiu em média/)).toHaveTextContent("3.900,00")
    await userEvent.click(screen.getByRole("button", { name: "Usar como esperado" }))
    expect(definirRendaPrevista).toHaveBeenCalledWith(2026, expect.any(Number), 3900, 0)
  })
})

describe("Renda: pra onde vai a renda", () => {
  beforeEach(() => { vi.clearAllMocks(); renda = base })

  it("mostra o cartão da renda do mês e refaz quando a pessoa muda o que espera receber", async () => {
    renderizar()
    expect(await screen.findByText("Pra onde vai a renda")).toBeInTheDocument()
    expect(await screen.findByText(/Fecha o mês com R\$\s1\.200,00 sobrando\./)).toBeInTheDocument()
    expect(getDinheiroDoMes).toHaveBeenCalledTimes(1)

    const fixa = screen.getByRole("textbox", { name: "Fixa (salário, aposentadoria, benefício)" })
    await userEvent.clear(fixa)
    await userEvent.type(fixa, "350000")
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await vi.waitFor(() => expect(getDinheiroDoMes).toHaveBeenCalledTimes(2))
  })
})
