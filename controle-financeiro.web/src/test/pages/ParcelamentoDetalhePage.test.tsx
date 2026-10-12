import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { PontesThemeProvider } from "../../components/pontes"
import ParcelamentoDetalhePage from "../../pages/Parcelamentos/[id]"
import type { ParcelamentoDetalhe } from "../../types/Parcelamento"

vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useParams: () => ({ id: "p1" }),
  useNavigate: () => vi.fn(),
  useOutletContext: () => ({ notify: vi.fn() }),
}))

const obterDetalhe = vi.fn()
const pagarParcelaAntecipado = vi.fn()
const cancelar = vi.fn()
const getContas = vi.fn()
vi.mock("../../services/ParcelamentoService", () => ({
  ParcelamentoService: {
    obterDetalhe: (...a: unknown[]) => obterDetalhe(...a),
    pagarParcelaAntecipado: (...a: unknown[]) => pagarParcelaAntecipado(...a),
    cancelar: (...a: unknown[]) => cancelar(...a),
  },
}))
vi.mock("../../services/contaService", () => ({ getContas: (...a: unknown[]) => getContas(...a) }))

function renderPage() {
  return render(
    <MemoryRouter>
      <PontesThemeProvider><ParcelamentoDetalhePage /></PontesThemeProvider>
    </MemoryRouter>
  )
}

// Parcela ANTIGA (criada antes da regra do mês de fechamento): DataVencimento = dia da compra (28/09),
// mas ela está na fatura que fecha 10/10 e vence 20/10. A tela mostrava "SET/2026 · 28/09"; Cartões
// mostra essa fatura como "Outubro". O detalhe tem que falar a língua de Cartões.
const detalhe = {
  id: "p1", descricao: "Geladeira", tipo: 0, dataCompra: "2026-09-28T00:00:00",
  cartaoCreditoId: "c1", cartaoCreditoNome: "Nubank", quantidadeParcelas: 2, parcelasPagas: 0,
  valorOriginal: 600, valorPago: 0, valorRestante: 600, ativo: true, criadoEm: "2026-09-28T12:00:00",
  proximaParcela: {
    id: "x1", numero: 1, dataVencimento: "2026-09-28T00:00:00", valor: 300, faturaId: "f1",
    faturaMesReferencia: "2026-10-10T00:00:00", faturaDataVencimento: "2026-10-20T00:00:00",
  },
  parcelas: [
    {
      id: "x1", numero: 1, quantidadeTotal: 2, dataVencimento: "2026-09-28T00:00:00", valor: 300, status: 0,
      faturaId: "f1", faturaMesReferencia: "2026-10-10T00:00:00", faturaDataVencimento: "2026-10-20T00:00:00",
    },
    {
      id: "x2", numero: 2, quantidadeTotal: 2, dataVencimento: "2026-10-28T00:00:00", valor: 300, status: 0,
      faturaId: "f2", faturaMesReferencia: "2026-11-10T00:00:00", faturaDataVencimento: "2026-11-20T00:00:00",
    },
  ],
} as unknown as ParcelamentoDetalhe

describe("ParcelamentoDetalhePage", () => {
  beforeEach(() => {
    obterDetalhe.mockReset()
    pagarParcelaAntecipado.mockReset().mockResolvedValue(undefined)
    cancelar.mockReset().mockResolvedValue(undefined)
    getContas.mockReset().mockResolvedValue([])
  })

  it("mostra a fatura pelo mês de FECHAMENTO (rótulo de Cartões) e o vencimento real dela", async () => {
    obterDetalhe.mockResolvedValue(detalhe)
    renderPage()

    expect(await screen.findByText("Fatura Outubro de 2026")).toBeInTheDocument()

    const linhas = screen.getAllByRole("row").slice(1) // sem o cabeçalho
    expect(within(linhas[0]).getByText("Outubro de 2026")).toBeInTheDocument()
    expect(within(linhas[0]).getByText("20/10/2026")).toBeInTheDocument()
    expect(within(linhas[1]).getByText("Novembro de 2026")).toBeInTheDocument()
    expect(within(linhas[1]).getByText("20/11/2026")).toBeInTheDocument()
    expect(screen.queryByText("28/09/2026")).not.toBeInTheDocument()
    expect(screen.queryByText(/SET\/2026/)).not.toBeInTheDocument()
  })

  it("compra em andamento: linha única das pagas antes de registrar + número real de cada parcela", async () => {
    // 7× de 100, 4 pagas antes de registrar: o app só tem a 5ª, 6ª e 7ª.
    const emAndamento = {
      ...detalhe, quantidadeParcelas: 7, parcelasPagas: 4, parcelasPagasAntes: 4, valorPagoAntes: 400,
      valorOriginal: 700, valorPago: 400, valorRestante: 300,
      parcelas: [5, 6, 7].map((n) => ({
        id: `x${n}`, numero: n, quantidadeTotal: 7, dataVencimento: "2026-10-20T00:00:00", valor: 100, status: 0,
        faturaId: `f${n}`, faturaMesReferencia: "2026-10-10T00:00:00", faturaDataVencimento: "2026-10-20T00:00:00",
      })),
    } as unknown as ParcelamentoDetalhe
    obterDetalhe.mockResolvedValue(emAndamento)
    renderPage()

    expect(await screen.findByText("Parcelas (7)")).toBeInTheDocument()
    const linhas = screen.getAllByRole("row").slice(1)
    expect(linhas).toHaveLength(4)
    expect(within(linhas[0]).getByText("1–4")).toBeInTheDocument()
    expect(within(linhas[0]).getByText("Pagas antes de registrar")).toBeInTheDocument()
    expect(within(linhas[0]).getByText("Paga")).toBeInTheDocument()
    expect(within(linhas[0]).getByText(/400,00/)).toBeInTheDocument()
    expect(linhas.slice(1).map((l) => l.querySelector("td")?.textContent)).toEqual(["5", "6", "7"])
    expect(screen.getByText("57%")).toBeInTheDocument() // 4 de 7
  })

  it("cancelado: aviso com data e motivo, selo 'Cancelado' e sem botão de cancelar de novo", async () => {
    obterDetalhe.mockResolvedValue({
      ...detalhe, ativo: false, canceladoEm: "2026-09-28T15:00:00", motivoCancelamento: "Devolvido",
    })
    renderPage()
    expect(await screen.findByText("Parcelamento cancelado:")).toBeInTheDocument()
    expect(screen.getByText(/em 28\/09\/2026 · Devolvido/)).toBeInTheDocument()
    expect(screen.getByText("Cancelado")).toBeInTheDocument()
    expect(screen.queryByText("Cancelar Parcelamento")).not.toBeInTheDocument()
  })

  it("ativo: sem aviso, com o botão de cancelar", async () => {
    obterDetalhe.mockResolvedValue(detalhe)
    renderPage()
    expect(await screen.findByText("Cancelar Parcelamento")).toBeInTheDocument()
    expect(screen.queryByText("Parcelamento cancelado:")).not.toBeInTheDocument()
  })

  // Bug de dinheiro (2026-09-28): a Idempotency-Key nascia a cada clique — repetir depois de queda de
  // rede pagava a parcela de novo. Agora a chave é da ABERTURA da janela.
  const chave = (fn: ReturnType<typeof vi.fn>, i: number) => (fn.mock.calls[i][1] as { idempotencyKey: string }).idempotencyKey

  it("pagar antecipado: tentar de novo na mesma janela reusa a chave; reabrir gera outra", async () => {
    obterDetalhe.mockResolvedValue(detalhe)
    getContas.mockResolvedValue([{ id: "k1", nome: "Conta Corrente" }])
    pagarParcelaAntecipado.mockRejectedValueOnce(new Error("Network Error"))
    renderPage()
    fireEvent.click((await screen.findAllByRole("button", { name: "Pagar" }))[0])
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }))
    await waitFor(() => expect(pagarParcelaAntecipado).toHaveBeenCalledTimes(1)) // caiu a rede
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))           // tenta de novo
    await waitFor(() => expect(pagarParcelaAntecipado).toHaveBeenCalledTimes(2))
    expect(chave(pagarParcelaAntecipado, 0)).toBeTruthy()
    expect(chave(pagarParcelaAntecipado, 1)).toBe(chave(pagarParcelaAntecipado, 0))

    // pagou e fechou; pagar outra vez é outra intenção → outra chave
    await waitFor(() => expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument())
    fireEvent.click((await screen.findAllByRole("button", { name: "Pagar" }))[0])
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }))
    await waitFor(() => expect(pagarParcelaAntecipado).toHaveBeenCalledTimes(3))
    expect(chave(pagarParcelaAntecipado, 2)).not.toBe(chave(pagarParcelaAntecipado, 0))
  })

  it("cancelar: tentar de novo na mesma janela reusa a chave", async () => {
    obterDetalhe.mockResolvedValue(detalhe)
    cancelar.mockRejectedValueOnce(new Error("Network Error"))
    renderPage()
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar Parcelamento" }))
    const dialogo = await screen.findByRole("dialog")
    fireEvent.change(within(dialogo).getByRole("textbox"), { target: { value: "Devolvi" } })
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar parcelamento" }))
    await waitFor(() => expect(cancelar).toHaveBeenCalledTimes(1))
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar parcelamento" }))
    await waitFor(() => expect(cancelar).toHaveBeenCalledTimes(2))
    expect(chave(cancelar, 0)).toBeTruthy()
    expect(chave(cancelar, 1)).toBe(chave(cancelar, 0))
  })
})
