import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"

// fatura-a-detalhar.md, passos 4 e 5: a fatura paga com compras que não estão no app mostra o que falta detalhar, e a
// cobrança que se repete vira sugestão de conta fixa (o app só sugere).
vi.mock("../../services/cartaoCreditoService", () => ({
  getCartoes: vi.fn(async () => [{ id: "c1", nome: "Nubank", bandeira: 2, bandeiraDescricao: "", temCredito: true, temDebito: false,
    ehPrePago: false, ativo: true, diaFechamento: 1, diaVencimento: 8, limite: 5000, limiteUsado: 0, limiteDisponivel: 5000 }]),
  deleteCartao: vi.fn(), getSugestoesContaFixa: vi.fn(), dispensarSugestaoContaFixa: vi.fn(async () => undefined),
}))
import { dispensarSugestaoContaFixa, getSugestoesContaFixa } from "../../services/cartaoCreditoService"
vi.mock("../../services/faturaService", () => ({
  getFaturasByCartao: vi.fn(async () => [{
    id: "f1", cartaoCreditoId: "c1", cartaoCreditoNome: "Nubank", dataInicio: "2026-10-01T00:00:00", dataFechamento: "2026-11-01T00:00:00",
    dataVencimento: "2026-11-08T00:00:00", status: 2, statusDescricao: "", estadoCiclo: 1, estadoPagamento: 2, estaAtrasada: false,
    valorTotal: 100, valorPago: 3273.8, valorRestante: 0, valorADetalhar: 3173.8, vencida: false,
  }]),
  getFaturaDetalhe: vi.fn(async () => ({ transacoes: [], parcelas: [], pagamentos: [] })),
  getLancamentosFatura: vi.fn(async () => ({ items: [], total: 0 })),
}))
vi.mock("../../services/ParcelamentoService", () => ({ ParcelamentoService: { obterStats: vi.fn(async () => ({ ativos: 0, totalRestante: 0 })) } }))
vi.mock("../../services/familiaService", () => ({ getFamilias: vi.fn(async () => []), marcarCartaoDaCasa: vi.fn() }))
import Cartao from "../../telas/Cartao"

const SUGESTAO = { chave: "d:claude", nome: "Claude.ai", descricao: "Claude.ai Subscription", valor: 110, ultima: "2026-10-10",
  proxima: "2026-11-10", meses: 4, categoriaId: "assin", subcategoriaId: null }

const NovaContaFixa = () => <p>nova conta fixa {JSON.stringify(useLocation().state)}</p>
const renderizar = () => render(
  <MemoryRouter initialEntries={["/cartoes/c1"]}>
    <Routes>
      <Route path="/cartoes/:id" element={<Cartao />} />
      <Route path="/contas-fixas/nova" element={<NovaContaFixa />} />
      <Route path="/importar" element={<p>importar</p>} />
    </Routes>
  </MemoryRouter>,
)

describe("Cartão: fatura a detalhar e sugestão de conta fixa", () => {
  beforeEach(() => { vi.mocked(getSugestoesContaFixa).mockReset(); vi.mocked(dispensarSugestaoContaFixa).mockClear() })

  it("fatura paga acima das compras do app mostra pago, detalhado e o que falta, com o atalho pra importar", async () => {
    vi.mocked(getSugestoesContaFixa).mockResolvedValue([])
    renderizar()
    expect(await screen.findByText("Falta detalhar")).toBeInTheDocument()
    expect(screen.getByText("Detalhado")).toBeInTheDocument()
    expect(screen.queryByText("Parece conta fixa")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Importar fatura" }))
    expect(await screen.findByText("importar")).toBeInTheDocument()
  })

  it("virar conta fixa abre Nova conta fixa preenchida a partir do mês seguinte; Não é some com a sugestão", async () => {
    vi.mocked(getSugestoesContaFixa).mockResolvedValue([SUGESTAO, { ...SUGESTAO, chave: "d:netflix", nome: "Netflix" }])
    renderizar()
    const lista = await screen.findByRole("list", { name: "Sugestões de conta fixa" })
    expect(within(lista).getAllByText("4 faturas seguidas", { exact: false })).toHaveLength(2)

    await userEvent.click(within(lista).getAllByRole("button", { name: "Não é" })[1])
    expect(dispensarSugestaoContaFixa).toHaveBeenCalledWith("c1", "d:netflix")
    expect(within(lista).queryByText("Netflix")).not.toBeInTheDocument()

    await userEvent.click(within(lista).getByRole("button", { name: "Virar conta fixa" }))
    const estado = await screen.findByText(/nova conta fixa/)
    expect(estado.textContent).toContain('"descricao":"Claude.ai"')
    expect(estado.textContent).toContain('"cartaoCreditoId":"c1"')
    expect(estado.textContent).toContain('"dataInicio":"2026-11-10"')
  })
})
