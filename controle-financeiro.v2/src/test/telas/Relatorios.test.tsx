import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import type { CheckUp } from "../../types/Relatorio"

const vazio = (mes: number) => ({ ano: 2026, mes, entrou: 0, saiu: 0, sobrou: 0 })
const dados: CheckUp = {
  ano: 2026, mes: 10, mesAtual: false, entrou: 5000, saiu: 1000, sobrou: 4000, percentualQueSobrou: 80,
  contasFixasPorMes: 500, parcelasDoMes: 0, percentualComprometido: 10,
  praOndeFoi: [
    { categoriaId: "c1", nome: "Mercado", valor: 900, percentualDoGasto: 90, normal: 500, variacaoPercentual: 80 },
    { categoriaId: "c2", nome: "Lazer", valor: 100, percentualDoGasto: 10, normal: 200, variacaoPercentual: -50 },
  ],
  mesAMes: [...[11, 12].map((m) => ({ ...vazio(m), ano: 2025 })), ...[1, 2, 3, 4, 5, 6, 7].map(vazio),
    { ano: 2026, mes: 8, entrou: 5000, saiu: 700, sobrou: 4300 }, { ano: 2026, mes: 9, entrou: 5000, saiu: 700, sobrou: 4300 },
    { ano: 2026, mes: 10, entrou: 5000, saiu: 1000, sobrou: 4000 }],
  dinheiroGuardado: 12600, gastoNormal: 700, mesesDeReserva: 18,
  resposta: { tom: "positivo", texto: "Em outubro entraram R$ 5.000,00 e saíram R$ 1.000,00: sobraram R$ 4.000,00 (80% do que entrou).", acoes: [{ rotulo: "Ver limites", para: "/limites" }] },
}
vi.mock("../../services/relatorioService", () => ({
  getCheckUp: vi.fn(async () => dados),
  urlCsvDoMes: (ano: number, mes: number) => `/csv/${ano}/${mes}`,
}))
import { getCheckUp } from "../../services/relatorioService"
import Relatorios from "../../telas/Relatorios"

describe("Relatórios = check-up do mês", () => {
  it("mostra a resposta, os números, cada categoria contra o normal, a reserva e os meses com lançamento", async () => {
    render(<MemoryRouter><Relatorios /></MemoryRouter>)

    expect(await screen.findByText(/sobraram R\$ 4\.000,00/)).toBeInTheDocument()
    expect(getCheckUp).toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Ver limites" })).toBeInTheDocument()
    expect(screen.getByText("80% do que entrou")).toBeInTheDocument()
    expect(screen.getByText("10%")).toBeInTheDocument() // comprometido

    const categorias = screen.getByRole("list", { name: "Pra onde foi" })
    expect(within(categorias).getByText(/80% acima do normal/)).toHaveAttribute("data-tom", "alerta")
    expect(within(categorias).getByText(/50% abaixo do normal/)).toHaveAttribute("data-tom", "positivo")

    expect(screen.getByText("18 meses")).toBeInTheDocument()

    // Os meses vazios antes do primeiro lançamento não entram.
    const meses = within(screen.getByRole("list", { name: "Mês a mês" })).getAllByRole("listitem")
    expect(meses.map((m) => m.textContent?.slice(0, 6))).toEqual(["ago/26", "set/26", "out/26"])

    expect(screen.getByRole("link", { name: /Exportar CSV/ })).toHaveAttribute("href", expect.stringMatching(/^\/csv\/\d{4}\/\d+$/))
  })
})
