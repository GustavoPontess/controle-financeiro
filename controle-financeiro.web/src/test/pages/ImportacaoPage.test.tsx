import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { PontesThemeProvider } from "../../components/pontes"
import ImportacaoPage from "../../pages/Importacao/ImportacaoPage"
import type { PreviewImportacao } from "../../types/Importacao"

vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ notify: vi.fn() }),
}))

const previewImportacao = vi.fn()
vi.mock("../../services/importacaoService", () => ({
  previewImportacao: (...a: unknown[]) => previewImportacao(...a),
  confirmarImportacao: vi.fn(),
}))
vi.mock("../../services/contaService", () => ({
  getContas: () => Promise.resolve([{ id: "c1", nome: "Nubank" }]),
}))
vi.mock("../../services/categoryService", () => ({ getCategories: () => Promise.resolve([]) }))

const linha = (descricao: string, valor: number, tipo: 1 | 2, pixNoCredito = false) => ({
  data: "2026-04-06T00:00:00", descricao, valor, tipo, fitId: descricao, duplicada: false,
  categoriaSugeridaId: null, categoriaSugeridaNome: null, pixNoCredito,
})

const preview: PreviewImportacao = {
  linhas: [
    linha("Valor adicionado na conta por cartão de crédito - Valor adicionado para Pix no Crédito", 132.5, 2, true),
    linha("Transferência enviada pelo Pix - FULANO", 132.5, 1, true),
    linha("Compra no débito - MERCADO", 41.86, 1),
  ],
  total: 3,
  duplicadas: 0,
}

async function analisar() {
  render(<MemoryRouter><PontesThemeProvider><ImportacaoPage /></PontesThemeProvider></MemoryRouter>)
  fireEvent.click(await screen.findByText("Selecione"))
  fireEvent.click(await screen.findByText("Nubank"))
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File(["x"], "nubank.ofx")] } })
  fireEvent.click(screen.getByText("Analisar"))
  await screen.findByText("3 transações lidas")
}

describe("ImportacaoPage", () => {
  beforeEach(() => { previewImportacao.mockReset().mockResolvedValue(preview) })

  it("Pix no Crédito aparece como 'Pix no Crédito', não como Receita/Despesa", async () => {
    await analisar()

    const linhas = screen.getAllByRole("row").slice(1)
    for (const l of linhas.slice(0, 2)) {
      expect(within(l).getByText("Pix no Crédito")).toBeInTheDocument()
      expect(within(l).queryByText("Receita")).not.toBeInTheDocument()
      expect(within(l).queryByText("Despesa")).not.toBeInTheDocument()
    }
    expect(within(linhas[2]).getByText("Despesa")).toBeInTheDocument()
  })
})
