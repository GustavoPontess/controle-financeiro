import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import type { CheckUp, Sinal } from "../../types/Relatorio"

const vazio = (mes: number) => ({ ano: 2026, mes, entrou: 0, saiu: 0, sobrou: 0 })
const dados: CheckUp = {
  ano: 2026, mes: 9, mesAtual: false, entrou: 5000, saiu: 1000, sobrou: 4000, percentualQueSobrou: 80,
  variacaoEntrou: 0, variacaoSaiu: 43, sobrouMesAnterior: 4300,
  contasFixasPorMes: 500, parcelasDoMes: 0, percentualComprometido: 10,
  praOndeFoi: [
    { categoriaId: "c1", nome: "Mercado", valor: 900, percentualDoGasto: 90, normal: 500, variacaoPercentual: 80, previsto: 0 },
    { categoriaId: "c2", nome: "Lazer", valor: 100, percentualDoGasto: 10, normal: 200, variacaoPercentual: -50, previsto: 0 },
  ],
  semCategoria: { valor: 300, percentualDoGasto: 23, quantidade: 4 },
  mesAMes: [...[10, 11, 12].map((m) => ({ ...vazio(m), ano: 2025 })), ...[1, 2, 3, 4, 5, 6].map(vazio),
    { ano: 2026, mes: 7, entrou: 5000, saiu: 700, sobrou: 4300 }, { ano: 2026, mes: 8, entrou: 5000, saiu: 700, sobrou: 4300 },
    { ano: 2026, mes: 9, entrou: 5000, saiu: 1000, sobrou: 4000 }],
  dinheiroGuardado: 12600, guardadoNasMetas: 2000, gastoNormal: 700, mesesDeReserva: 18,
  respostaReserva: { tom: "positivo", texto: "O que está nas contas cobre uns 18 meses do seu gasto normal.", acoes: [] },
  comprometido: {
    maioresContasFixas: [{ id: "f1", descricao: "Aluguel", porMes: 500 }], totalContasFixas: 1,
    parcelasProximosMeses: [], parcelasAteAno: null, parcelasAteMes: null, parcelaQueAcaba: null, faturas: [],
    folgaPorMes: null, metasPedemPorMes: 0, faixaAtencao: 40, faixaAlerta: 60,
    resposta: { tom: "positivo", texto: "Contas fixas e parcelas levam R$ 500,00 dos R$ 5.000,00 da renda (10%).", acoes: [] },
  },
  corte: {
    resposta: { tom: "neutro", texto: "Mercado passou do normal em setembro: R$ 400,00 a mais.", acoes: [] },
    itens: [{ tipo: "categoria", id: "c1", nome: "Mercado", valor: 900, normal: 500, aMais: 400, previsto: 0 }],
  },
  sinais: [{ chave: "sem-categoria-2026-9", origem: "dados", peso: 300, ehDeHoje: false,
    resposta: { tom: "neutro", texto: "4 lançamentos de setembro ainda sem categoria (R$ 300,00).", acoes: [{ rotulo: "Classificar", para: "/transacoes?categoriaId=00000000-0000-0000-0000-000000000000&mes=2026-09" }] } }],
  resposta: { tom: "positivo", texto: "Em setembro entraram R$ 5.000,00 e saíram R$ 1.000,00: sobraram R$ 4.000,00 (80% do que entrou).", acoes: [{ rotulo: "Ver o planejado", para: "/orcamento" }] },
}
const avisos: Sinal[] = [{ chave: "fatura-x", origem: "fatura", peso: 655.9, ehDeHoje: false,
  resposta: { tom: "alerta", texto: "Fatura do Nubank atrasada: R$ 655,90 desde 05/09.", acoes: [{ rotulo: "Ver cartões", para: "/cartoes" }] } }]

vi.mock("../../services/relatorioService", () => ({
  getCheckUp: vi.fn(async () => dados),
  getSinais: vi.fn(async () => avisos),
  urlCsvDoMes: (ano: number, mes: number) => `/csv/${ano}/${mes}`,
}))
vi.mock("../../services/dinheiroDoMesService", () => ({ getDinheiroDoMes: vi.fn(async () => { throw new Error("fora do teste") }) }))
import { getCheckUp } from "../../services/relatorioService"
import Relatorios from "../../telas/Relatorios"

function Onde() { const l = useLocation(); return <p>em {l.pathname}{l.search}</p> }

describe("Relatórios = check-up do mês", () => {
  it("mostra a resposta, os números, os avisos juntos, cada categoria contra o normal, o corte, o comprometido e a reserva", async () => {
    render(<MemoryRouter><Relatorios /></MemoryRouter>)

    expect(await screen.findByText(/sobraram R\$ 4\.000,00/)).toBeInTheDocument()
    expect(getCheckUp).toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Ver o planejado" })).toBeInTheDocument()
    expect(screen.getByText("43% a mais")).toBeInTheDocument() // saiu contra o mês anterior

    // O que vale olhar: Seus dados primeiro, depois os avisos das outras telas.
    const textos = screen.getAllByText(/ainda sem categoria \(R\$ 300,00\)|Fatura do Nubank atrasada/).map((e) => e.textContent)
    expect(textos[0]).toMatch(/sem categoria/)
    expect(await screen.findByText(/Fatura do Nubank atrasada/)).toBeInTheDocument()

    const categorias = screen.getByRole("list", { name: "Pra onde foi" })
    expect(within(categorias).getByText(/80% acima do normal/)).toHaveAttribute("data-tom", "alerta")
    expect(within(categorias).getByText(/50% abaixo do normal/)).toHaveAttribute("data-tom", "positivo")
    expect(within(categorias).getByText("4 lançamentos pra classificar")).toBeInTheDocument() // Sem categoria fora do ranking, por último

    expect(screen.getByText("Mercado passou do normal em setembro: R$ 400,00 a mais.")).toBeInTheDocument()
    expect(screen.getByText(/Contas fixas e parcelas levam R\$ 500,00/)).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "10% da renda comprometida" })).toBeInTheDocument()
    expect(screen.getByText("18 meses")).toBeInTheDocument()
    expect(screen.getByText("Guardado nas metas (fora da reserva)")).toBeInTheDocument()

    expect(screen.getByRole("link", { name: /Exportar lançamentos do mês/ })).toHaveAttribute("href", expect.stringMatching(/^\/csv\/\d{4}\/\d+$/))
  })

  it("tocar numa categoria abre Transações filtrada por ela e pelo mês", async () => {
    render(
      <MemoryRouter initialEntries={["/relatorios"]}>
        <Routes>
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/transacoes" element={<Onde />} />
        </Routes>
      </MemoryRouter>,
    )
    const categorias = await screen.findByRole("list", { name: "Pra onde foi" })
    await userEvent.click(within(categorias).getByRole("button", { name: /Mercado/ }))
    expect(await screen.findByText(/em \/transacoes\?categoriaId=c1&mes=\d{4}-\d{2}/)).toBeInTheDocument()
  })
})
