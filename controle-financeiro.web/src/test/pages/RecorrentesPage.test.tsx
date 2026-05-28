import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import RecorrentesPage from "../../pages/Recorrentes/RecorrentesPage"
import type { Recorrente } from "../../types/Recorrente"

// ── Router mock ──────────────────────────────────────────────────────────────
const mockNotify = vi.fn()
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ notify: mockNotify }),
}))

// ── Service mocks ────────────────────────────────────────────────────────────
const getRecorrentes = vi.fn()
const createRecorrente = vi.fn()
const toggleRecorrente = vi.fn()
const deleteRecorrente = vi.fn()
const cancelarRecorrente = vi.fn()
const editarProximaOcorrencia = vi.fn()

vi.mock("../../services/recorrenteService", () => ({
  getRecorrentes:          (...a: unknown[]) => getRecorrentes(...a),
  createRecorrente:        (...a: unknown[]) => createRecorrente(...a),
  toggleRecorrente:        (...a: unknown[]) => toggleRecorrente(...a),
  deleteRecorrente:        (...a: unknown[]) => deleteRecorrente(...a),
  cancelarRecorrente:      (...a: unknown[]) => cancelarRecorrente(...a),
  editarProximaOcorrencia: (...a: unknown[]) => editarProximaOcorrencia(...a),
}))

vi.mock("../../services/contaService", () => ({
  getContas: () => Promise.resolve([
    { id: "conta-001", nome: "Nubank", tipo: 1, saldo: 1000 },
  ]),
}))

vi.mock("../../services/categoryService", () => ({
  getCategories: () => Promise.resolve([
    { id: "cat-001", descricao: "Entretenimento", finalidade: 1, isPadrao: true },
  ]),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRecorrente(overrides: Partial<Recorrente> = {}): Recorrente {
  return {
    id: "rec-001",
    descricao: "Netflix",
    valor: 45.9,
    tipo: 1,
    tipoDescricao: "Despesa",
    contaId: "conta-001",
    contaNome: "Nubank",
    frequencia: 2,
    frequenciaDescricao: "Mensal",
    dia: 10,
    dataInicio: "2026-01-01T00:00:00Z",
    ativo: true,
    dataProximaGeracao: "2026-06-10T00:00:00Z",
    ...overrides,
  }
}

function renderPage() {
  return render(
    <PontesThemeProvider>
      <RecorrentesPage />
    </PontesThemeProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RecorrentesPage", () => {
  // ── Empty state ──

  it("mostra empty state quando não há recorrentes", async () => {
    getRecorrentes.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText("Nenhuma assinatura")).toBeInTheDocument()
  })

  // ── Listagem ──

  it("exibe recorrente carregado", async () => {
    getRecorrentes.mockResolvedValue([makeRecorrente()])
    renderPage()
    expect(await screen.findByText("Netflix")).toBeInTheDocument()
    expect(screen.getByText("Mensal")).toBeInTheDocument()
    expect(screen.getByText("Nubank")).toBeInTheDocument()
  })

  it("exibe stats: ativas e custo mensal", async () => {
    getRecorrentes.mockResolvedValue([makeRecorrente()])
    renderPage()
    await screen.findByText("Netflix")
    expect(screen.getByText("Ativas")).toBeInTheDocument()
    expect(screen.getByText("Custo mensal (despesas)")).toBeInTheDocument()
  })

  it("inativa aparece com data-inactive", async () => {
    getRecorrentes.mockResolvedValue([makeRecorrente({ ativo: false })])
    renderPage()
    await screen.findByText("Netflix")
    const row = document.querySelector("[data-inactive='true']")
    expect(row).toBeInTheDocument()
  })

  // ── Criar modal ──

  it("abre modal criar ao clicar em Nova Assinatura", async () => {
    getRecorrentes.mockResolvedValue([])
    renderPage()
    await screen.findByText("Nenhuma assinatura")
    fireEvent.click(screen.getAllByText("Nova Assinatura")[0])
    expect(await screen.findByPlaceholderText("Ex: Netflix, Academia...")).toBeInTheDocument()
  })

  it("bloqueia submit com campos vazios e mostra erros", async () => {
    getRecorrentes.mockResolvedValue([])
    createRecorrente.mockResolvedValue(makeRecorrente())
    renderPage()
    await screen.findByText("Nenhuma assinatura")
    fireEvent.click(screen.getAllByText("Nova Assinatura")[0])
    await screen.findByText("Criar Assinatura")
    fireEvent.click(screen.getByText("Criar Assinatura"))
    expect(await screen.findByText("Descrição obrigatória.")).toBeInTheDocument()
    expect(createRecorrente).not.toHaveBeenCalled()
  })

  it("chama createRecorrente com dados válidos", async () => {
    getRecorrentes.mockResolvedValue([])
    createRecorrente.mockResolvedValue(makeRecorrente())
    getRecorrentes.mockResolvedValueOnce([]).mockResolvedValueOnce([makeRecorrente()])
    renderPage()
    await screen.findByText("Nenhuma assinatura")

    fireEvent.click(screen.getAllByText("Nova Assinatura")[0])
    await screen.findByText("Criar Assinatura")

    fireEvent.change(screen.getByPlaceholderText("Ex: Netflix, Academia..."), {
      target: { value: "Netflix" },
    })
    fireEvent.change(screen.getByPlaceholderText("0,00"), {
      target: { value: "45.90" },
    })

    // Select conta (Nubank) — wait for the select to be ready
    await waitFor(() => {
      expect(screen.getByText("Criar Assinatura")).toBeInTheDocument()
    })
    // Data inicio is pre-filled via today()
    fireEvent.click(screen.getByText("Criar Assinatura"))

    // If conta not selected, error shows
    expect(await screen.findByText("Selecione uma conta.")).toBeInTheDocument()
  })

  // ── Cancelar modal ──

  it("abre modal cancelar com campo motivo", async () => {
    getRecorrentes.mockResolvedValue([makeRecorrente()])
    renderPage()
    await screen.findByText("Netflix")

    // The XCircle (cancelar) button
    const cancelarBtn = screen.getAllByTitle("Cancelar assinatura")[0]
    fireEvent.click(cancelarBtn)

    expect(await screen.findByText("Motivo do cancelamento")).toBeInTheDocument()
  })

  it("bloqueia cancelamento sem motivo", async () => {
    getRecorrentes.mockResolvedValue([makeRecorrente()])
    cancelarRecorrente.mockResolvedValue({})
    renderPage()
    await screen.findByText("Netflix")

    fireEvent.click(screen.getAllByTitle("Cancelar assinatura")[0])
    await screen.findByText("Confirmar cancelamento")
    fireEvent.click(screen.getByText("Confirmar cancelamento"))

    expect(await screen.findByText("Motivo é obrigatório.")).toBeInTheDocument()
    expect(cancelarRecorrente).not.toHaveBeenCalled()
  })

  it("chama cancelarRecorrente com motivo preenchido", async () => {
    getRecorrentes.mockResolvedValue([makeRecorrente()])
    cancelarRecorrente.mockResolvedValue({})
    renderPage()
    await screen.findByText("Netflix")

    fireEvent.click(screen.getAllByTitle("Cancelar assinatura")[0])
    await screen.findByText("Confirmar cancelamento")

    fireEvent.change(screen.getByPlaceholderText("Ex: Não uso mais, preço alto..."), {
      target: { value: "Preço alto" },
    })
    fireEvent.click(screen.getByText("Confirmar cancelamento"))

    await waitFor(() => {
      expect(cancelarRecorrente).toHaveBeenCalledWith("rec-001", { motivo: "Preço alto" })
    })
  })

  // ── Editar próxima modal ──

  it("abre modal editar próxima", async () => {
    getRecorrentes.mockResolvedValue([makeRecorrente()])
    renderPage()
    await screen.findByText("Netflix")

    fireEvent.click(screen.getAllByTitle("Editar próxima ocorrência")[0])
    expect(await screen.findByText("Novo valor (opcional)")).toBeInTheDocument()
    expect(screen.getByText("Nova descrição (opcional)")).toBeInTheDocument()
  })

  it("chama editarProximaOcorrencia ao salvar", async () => {
    getRecorrentes.mockResolvedValue([makeRecorrente()])
    editarProximaOcorrencia.mockResolvedValue(undefined)
    renderPage()
    await screen.findByText("Netflix")

    fireEvent.click(screen.getAllByTitle("Editar próxima ocorrência")[0])
    await screen.findByText("Novo valor (opcional)")

    // Just submit with empty (both are optional)
    fireEvent.click(screen.getByText("Salvar"))

    await waitFor(() => {
      expect(editarProximaOcorrencia).toHaveBeenCalledWith("rec-001", {})
    })
  })

  it("valida valor negativo na edição de próxima", async () => {
    getRecorrentes.mockResolvedValue([makeRecorrente()])
    editarProximaOcorrencia.mockResolvedValue(undefined)
    renderPage()
    await screen.findByText("Netflix")

    fireEvent.click(screen.getAllByTitle("Editar próxima ocorrência")[0])
    await screen.findByText("Novo valor (opcional)")

    // Find the valor input (first 0,00 placeholder)
    const valorInput = screen.getByPlaceholderText("R$ 45,90")
    fireEvent.change(valorInput, { target: { value: "-5" } })
    fireEvent.click(screen.getByText("Salvar"))

    expect(await screen.findByText("Valor deve ser positivo.")).toBeInTheDocument()
    expect(editarProximaOcorrencia).not.toHaveBeenCalled()
  })

  // ── Toggle ──

  it("chama toggleRecorrente ao clicar pausar", async () => {
    getRecorrentes.mockResolvedValue([makeRecorrente()])
    toggleRecorrente.mockResolvedValue(undefined)
    renderPage()
    await screen.findByText("Netflix")

    fireEvent.click(screen.getAllByTitle("Pausar")[0])
    await waitFor(() => {
      expect(toggleRecorrente).toHaveBeenCalledWith("rec-001")
    })
  })

  // ── Delete ──

  it("abre confirm dialog ao clicar excluir", async () => {
    getRecorrentes.mockResolvedValue([makeRecorrente()])
    renderPage()
    await screen.findByText("Netflix")

    fireEvent.click(screen.getAllByTitle("Excluir")[0])
    expect(await screen.findByText("Remover assinatura")).toBeInTheDocument()
    expect(screen.getByText(/Remover "Netflix"/)).toBeInTheDocument()
  })

  it("chama deleteRecorrente ao confirmar exclusão", async () => {
    getRecorrentes.mockResolvedValue([makeRecorrente()])
    deleteRecorrente.mockResolvedValue(undefined)
    renderPage()
    await screen.findByText("Netflix")

    fireEvent.click(screen.getAllByTitle("Excluir")[0])
    await screen.findByText("Remover assinatura")
    fireEvent.click(screen.getByText("Confirmar"))

    await waitFor(() => {
      expect(deleteRecorrente).toHaveBeenCalledWith("rec-001")
    })
  })
})
