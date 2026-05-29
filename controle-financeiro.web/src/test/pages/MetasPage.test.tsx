import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import MetasPage from "../../pages/Metas/MetasPage"
import type { Meta } from "../../types/Meta"

// ── Router mock ──
const mockNotify = vi.fn()
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ notify: mockNotify }),
}))

// ── Service mocks ──
const getMetas      = vi.fn()
const criarMeta     = vi.fn()
const atualizarMeta = vi.fn()
const contribuirMeta = vi.fn()
const excluirMeta   = vi.fn()

vi.mock("../../services/metaService", () => ({
  getMetas:       (...a: unknown[]) => getMetas(...a),
  getMeta:        vi.fn(),
  criarMeta:      (...a: unknown[]) => criarMeta(...a),
  atualizarMeta:  (...a: unknown[]) => atualizarMeta(...a),
  contribuirMeta: (...a: unknown[]) => contribuirMeta(...a),
  excluirMeta:    (...a: unknown[]) => excluirMeta(...a),
}))

// ── Helpers ──

function makeMeta(overrides: Partial<Meta> = {}): Meta {
  return {
    id: "meta-001",
    nome: "Viagem para Europa",
    descricao: null,
    valorAlvo: 10000,
    valorAtual: 3000,
    percentualConcluido: 30,
    concluida: false,
    dataLimite: null,
    usuarioId: "user-001",
    familiaId: null,
    categoriaId: null,
    ativo: true,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    ...overrides,
  }
}

function renderPage() {
  return render(
    <PontesThemeProvider>
      <MetasPage />
    </PontesThemeProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe("MetasPage", () => {
  // ── Empty state ──

  it("mostra empty state quando não há metas", async () => {
    getMetas.mockResolvedValue({ data: [] })
    renderPage()
    expect(await screen.findByText("Nenhuma meta ainda")).toBeInTheDocument()
  })

  // ── Listagem ──

  it("exibe cards das metas carregadas", async () => {
    getMetas.mockResolvedValue({ data: [makeMeta()] })
    renderPage()
    expect(await screen.findByText("Viagem para Europa")).toBeInTheDocument()
    expect(screen.getByText("30%")).toBeInTheDocument()
  })

  it("exibe hero/resumo + valor que falta", async () => {
    // alvo 10000, atual 3000 → falta 7000, % geral 30
    getMetas.mockResolvedValue({ data: [makeMeta()] })
    renderPage()
    await screen.findByText("Viagem para Europa")
    expect(screen.getByText("Total guardado nas metas")).toBeInTheDocument()
    expect(screen.getByText(/Faltam/)).toBeInTheDocument()
    expect(screen.getByText(/R\$\s?7\.000,00/)).toBeInTheDocument()
  })

  it("exibe badge 'Concluída' quando percentual = 100", async () => {
    getMetas.mockResolvedValue({
      data: [makeMeta({ percentualConcluido: 100, concluida: true, valorAtual: 10000 })],
    })
    renderPage()
    expect(await screen.findByText("Concluída")).toBeInTheDocument()
  })

  // ── Criar ──

  it("abre modal de criação ao clicar 'Nova meta'", async () => {
    getMetas.mockResolvedValue({ data: [] })
    renderPage()
    await screen.findByText("Nenhuma meta ainda")

    fireEvent.click(screen.getAllByText("Nova meta")[0])
    // Modal abriu — campo nome aparece
    expect(await screen.findByPlaceholderText("Ex: Viagem para Europa")).toBeInTheDocument()
  })

  it("bloqueia submit com campos obrigatórios vazios", async () => {
    getMetas.mockResolvedValue({ data: [] })
    renderPage()
    await screen.findByText("Nenhuma meta ainda")

    fireEvent.click(screen.getAllByText("Nova meta")[0])
    await screen.findByPlaceholderText("Ex: Viagem para Europa")

    fireEvent.click(screen.getByText("Criar"))
    expect(await screen.findByText("Nome é obrigatório.")).toBeInTheDocument()
    expect(criarMeta).not.toHaveBeenCalled()
  })

  it("cria meta válida e recarrega lista", async () => {
    getMetas.mockResolvedValue({ data: [] })
    const novaMeta = makeMeta({ nome: "Carro" })
    criarMeta.mockResolvedValue({ data: novaMeta })

    renderPage()
    await screen.findByText("Nenhuma meta ainda")

    // Simula preenchimento e envio
    fireEvent.click(screen.getAllByText("Nova meta")[0])
    await screen.findByPlaceholderText("Ex: Viagem para Europa")

    fireEvent.change(screen.getByPlaceholderText("Ex: Viagem para Europa"), {
      target: { value: "Carro" },
    })
    // valor alvo
    const valorInput = screen.getByPlaceholderText("0,00")
    fireEvent.change(valorInput, { target: { value: "50000" } })

    getMetas.mockResolvedValue({ data: [novaMeta] })
    fireEvent.click(screen.getByText("Criar"))

    await waitFor(() => expect(criarMeta).toHaveBeenCalledTimes(1))
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "success" }),
    )
  })

  // ── Contribuir ──

  it("abre modal de contribuição ao clicar 'Contribuir'", async () => {
    getMetas.mockResolvedValue({ data: [makeMeta()] })
    renderPage()
    await screen.findByText("Viagem para Europa")

    fireEvent.click(screen.getByText("Contribuir"))
    expect(await screen.findByText("Contribuir para a meta")).toBeInTheDocument()
  })

  it("chama contribuirMeta com o valor informado", async () => {
    getMetas.mockResolvedValue({ data: [makeMeta()] })
    const atualizada = makeMeta({ valorAtual: 3500, percentualConcluido: 35 })
    contribuirMeta.mockResolvedValue({ data: atualizada })

    renderPage()
    await screen.findByText("Viagem para Europa")

    fireEvent.click(screen.getByText("Contribuir"))
    await screen.findByText("Contribuir para a meta")

    const input = screen.getByPlaceholderText("Ex: 500 ou -100")
    fireEvent.change(input, { target: { value: "500" } })

    getMetas.mockResolvedValue({ data: [atualizada] })
    fireEvent.click(screen.getByText("Registrar"))

    await waitFor(() =>
      expect(contribuirMeta).toHaveBeenCalledWith("meta-001", { valor: 500 }),
    )
  })

  it("bloqueia contribuição sem valor", async () => {
    getMetas.mockResolvedValue({ data: [makeMeta()] })
    renderPage()
    await screen.findByText("Viagem para Europa")

    fireEvent.click(screen.getByText("Contribuir"))
    await screen.findByText("Contribuir para a meta")
    fireEvent.click(screen.getByText("Registrar"))

    expect(await screen.findByText(/Informe um valor válido/)).toBeInTheDocument()
    expect(contribuirMeta).not.toHaveBeenCalled()
  })

  // ── Excluir ──

  it("abre diálogo de confirmação ao clicar excluir", async () => {
    getMetas.mockResolvedValue({ data: [makeMeta()] })
    renderPage()
    await screen.findByText("Viagem para Europa")

    // Botão de exclusão (Trash2)
    const excluirBtns = screen.getAllByTitle("Excluir")
    fireEvent.click(excluirBtns[0])

    expect(await screen.findByText("Excluir meta")).toBeInTheDocument()
  })
})
