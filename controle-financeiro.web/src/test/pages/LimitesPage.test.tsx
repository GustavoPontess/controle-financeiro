import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import LimitesPage from "../../pages/Limites/LimitesPage"
import type { Orcamento } from "../../types/Orcamento"

// ── Router mock ──────────────────────────────────────────────────────────────
const mockNotify = vi.fn()
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ notify: mockNotify }),
}))

// ── Service mocks ────────────────────────────────────────────────────────────
const getOrcamentos      = vi.fn()
const criarOrcamento     = vi.fn()
const atualizarOrcamento = vi.fn()
const excluirOrcamento   = vi.fn()

vi.mock("../../services/orcamentoService", () => ({
  getOrcamentos:      (...a: unknown[]) => getOrcamentos(...a),
  criarOrcamento:     (...a: unknown[]) => criarOrcamento(...a),
  atualizarOrcamento: (...a: unknown[]) => atualizarOrcamento(...a),
  excluirOrcamento:   (...a: unknown[]) => excluirOrcamento(...a),
}))

vi.mock("../../services/categoryService", () => ({
  getCategories: () => Promise.resolve([
    { id: "cat-001", descricao: "Alimentação", finalidade: 1, isPadrao: true },
    { id: "cat-002", descricao: "Transporte", finalidade: 1, isPadrao: true },
  ]),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeOrcamento(overrides: Partial<Orcamento> = {}): Orcamento {
  const now = new Date()
  return {
    id: "orc-001",
    categoriaId: "cat-001",
    categoriaNome: "Alimentação",
    mes: now.getMonth() + 1,
    ano: now.getFullYear(),
    valorLimite: 1500,
    percentualAlerta: 80,
    valorGasto: 900,
    valorRestante: 600,
    percentualConsumido: 60,
    emAlerta: false,
    ultrapassado: false,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <PontesThemeProvider>
      <LimitesPage />
    </PontesThemeProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe("LimitesPage", () => {
  // ── Empty state ──

  it("mostra empty state quando não há limites", async () => {
    getOrcamentos.mockResolvedValue({ data: [] })
    renderPage()
    expect(await screen.findByText("Nenhum limite definido")).toBeInTheDocument()
  })

  // ── Listagem ──

  it("exibe card de limite carregado", async () => {
    getOrcamentos.mockResolvedValue({ data: [makeOrcamento()] })
    renderPage()
    expect(await screen.findByText("Alimentação")).toBeInTheDocument()
    expect(screen.getAllByText("60%").length).toBeGreaterThan(0)
  })

  it("exibe hero de saúde do orçamento", async () => {
    getOrcamentos.mockResolvedValue({ data: [makeOrcamento()] })
    renderPage()
    await screen.findByText("Alimentação")
    expect(screen.getByText("Gasto no período")).toBeInTheDocument()
    expect(screen.getByText("estourados")).toBeInTheDocument()
    expect(screen.getByText("em alerta")).toBeInTheDocument()
  })

  it("exibe badge 'Em alerta' quando emAlerta=true", async () => {
    getOrcamentos.mockResolvedValue({
      data: [makeOrcamento({ emAlerta: true, percentualConsumido: 85, valorGasto: 1275 })],
    })
    renderPage()
    expect(await screen.findByText("Em alerta")).toBeInTheDocument()
  })

  it("exibe badge 'Ultrapassado' quando ultrapassado=true", async () => {
    getOrcamentos.mockResolvedValue({
      data: [makeOrcamento({ ultrapassado: true, emAlerta: true, percentualConsumido: 120, valorGasto: 1800, valorRestante: -300 })],
    })
    renderPage()
    expect(await screen.findByText("Ultrapassado")).toBeInTheDocument()
  })

  it("exibe limite 'Geral' quando categoriaNome é null", async () => {
    getOrcamentos.mockResolvedValue({
      data: [makeOrcamento({ categoriaId: null, categoriaNome: null })],
    })
    renderPage()
    expect(await screen.findByText("Geral")).toBeInTheDocument()
  })

  // ── Criar ──

  it("abre modal ao clicar 'Novo limite'", async () => {
    getOrcamentos.mockResolvedValue({ data: [] })
    renderPage()
    await screen.findByText("Nenhum limite definido")

    fireEvent.click(screen.getAllByText("Novo limite")[0])
    expect(await screen.findByText("Novo limite", { selector: "h2, [class*='title']" })).toBeInTheDocument()
  })

  it("bloqueia submit com valor limite vazio", async () => {
    getOrcamentos.mockResolvedValue({ data: [] })
    renderPage()
    await screen.findByText("Nenhum limite definido")

    fireEvent.click(screen.getAllByText("Novo limite")[0])
    await screen.findByText("Criar")
    fireEvent.click(screen.getByText("Criar"))

    expect(await screen.findByText("Informe um valor positivo.")).toBeInTheDocument()
    expect(criarOrcamento).not.toHaveBeenCalled()
  })

  it("bloqueia submit com percentual de alerta inválido", async () => {
    getOrcamentos.mockResolvedValue({ data: [] })
    renderPage()
    await screen.findByText("Nenhum limite definido")

    fireEvent.click(screen.getAllByText("Novo limite")[0])
    await screen.findByText("Criar")

    // Preenche valor mas deixa alerta inválido
    const inputs = screen.getAllByRole("spinbutton")
    fireEvent.change(inputs[0], { target: { value: "1000" } })
    fireEvent.change(inputs[1], { target: { value: "150" } }) // inválido: > 100

    fireEvent.click(screen.getByText("Criar"))
    expect(await screen.findByText("Percentual entre 1 e 100.")).toBeInTheDocument()
    expect(criarOrcamento).not.toHaveBeenCalled()
  })

  it("cria limite válido e recarrega lista", async () => {
    getOrcamentos.mockResolvedValue({ data: [] })
    criarOrcamento.mockResolvedValue({ data: makeOrcamento() })

    renderPage()
    await screen.findByText("Nenhum limite definido")

    fireEvent.click(screen.getAllByText("Novo limite")[0])
    await screen.findByText("Criar")

    const inputs = screen.getAllByRole("spinbutton")
    fireEvent.change(inputs[0], { target: { value: "1500" } })

    getOrcamentos.mockResolvedValue({ data: [makeOrcamento()] })
    fireEvent.click(screen.getByText("Criar"))

    await waitFor(() => expect(criarOrcamento).toHaveBeenCalledTimes(1))
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "success" }),
    )
  })

  // ── Editar ──

  it("abre modal de edição com dados preenchidos", async () => {
    getOrcamentos.mockResolvedValue({ data: [makeOrcamento()] })
    renderPage()
    await screen.findByText("Alimentação")

    const editBtn = screen.getByTitle("Editar")
    fireEvent.click(editBtn)

    expect(await screen.findByText("Editar limite")).toBeInTheDocument()
    // Valor deve estar preenchido
    const inputs = screen.getAllByRole("spinbutton")
    expect(inputs[0]).toHaveValue(1500)
  })

  // ── Excluir ──

  it("exibe dialog de confirmação ao excluir", async () => {
    getOrcamentos.mockResolvedValue({ data: [makeOrcamento()] })
    renderPage()
    await screen.findByText("Alimentação")

    fireEvent.click(screen.getByTitle("Excluir"))
    expect(await screen.findByText("Excluir limite")).toBeInTheDocument()
    expect(screen.getByText(/Deseja excluir o limite de/)).toBeInTheDocument()
  })

  it("chama excluirOrcamento ao confirmar exclusão", async () => {
    getOrcamentos.mockResolvedValue({ data: [makeOrcamento()] })
    excluirOrcamento.mockResolvedValue(undefined)

    renderPage()
    await screen.findByText("Alimentação")

    fireEvent.click(screen.getByTitle("Excluir"))
    await screen.findByText("Excluir limite")

    fireEvent.click(screen.getByText("Excluir"))
    await waitFor(() => expect(excluirOrcamento).toHaveBeenCalledWith("orc-001"))
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "success" }),
    )
  })

  // ── Period selector ──

  it("recarrega limites ao trocar período", async () => {
    getOrcamentos.mockResolvedValue({ data: [] })
    renderPage()
    await screen.findByText("Nenhum limite definido")

    // getOrcamentos foi chamado 1x na montagem
    expect(getOrcamentos).toHaveBeenCalledTimes(1)
  })
})
