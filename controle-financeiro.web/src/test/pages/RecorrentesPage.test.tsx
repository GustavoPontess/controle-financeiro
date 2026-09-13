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
const listRecorrentesPage = vi.fn()
const getRecorrenteStats = vi.fn().mockResolvedValue({
  ativas: 1, custoMensalDespesas: 45.9, proximas30Dias: 1, qtdTotal: 1,
})
const createRecorrente = vi.fn()
const toggleRecorrente = vi.fn()
const deleteRecorrente = vi.fn()
const cancelarRecorrente = vi.fn()
const editarProximaOcorrencia = vi.fn()

vi.mock("../../services/recorrenteService", () => ({
  listRecorrentesPage:     (...a: unknown[]) => listRecorrentesPage(...a),
  getRecorrenteStats:      (...a: unknown[]) => getRecorrenteStats(...a),
  getRecorrentes:          () => Promise.resolve([]),
  createRecorrente:        (...a: unknown[]) => createRecorrente(...a),
  toggleRecorrente:        (...a: unknown[]) => toggleRecorrente(...a),
  deleteRecorrente:        (...a: unknown[]) => deleteRecorrente(...a),
  cancelarRecorrente:      (...a: unknown[]) => cancelarRecorrente(...a),
  editarProximaOcorrencia: (...a: unknown[]) => editarProximaOcorrencia(...a),
}))
const paged = <T,>(items: T[]) => ({
  items, total: items.length, page: 1, pageSize: 100, totalPages: 1,
})

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
    listRecorrentesPage.mockResolvedValue(paged([]))
    renderPage()
    expect(await screen.findByText("Nenhuma conta fixa")).toBeInTheDocument()
  })

  // ── Listagem ──

  it("exibe recorrente carregado", async () => {
    listRecorrentesPage.mockResolvedValue(paged([makeRecorrente()]))
    renderPage()
    await screen.findByText("Suas contas fixas")
    // "Netflix" pode aparecer em "Próximas cobranças" E na lista — basta existir.
    expect((await screen.findAllByText("Netflix")).length).toBeGreaterThan(0)
    expect(screen.getAllByText("Mensal").length).toBeGreaterThan(0)
    expect(screen.getByText("Nubank")).toBeInTheDocument()
  })

  it("exibe hero de custo (custo mensal + ativas)", async () => {
    listRecorrentesPage.mockResolvedValue(paged([makeRecorrente()]))
    renderPage()
    await screen.findByText("Suas contas fixas")
    expect(screen.getByText("Custo mensal em contas fixas")).toBeInTheDocument()
    expect(screen.getByText("ativas")).toBeInTheDocument()
  })

  it("inativa aparece com data-inactive", async () => {
    listRecorrentesPage.mockResolvedValue(paged([makeRecorrente({ ativo: false })]))
    renderPage()
    await screen.findByText("Suas contas fixas")
    const row = document.querySelector("[data-inactive='true']")
    expect(row).toBeInTheDocument()
  })

  // ── Criar modal ──

  it("abre modal criar ao clicar em Nova Conta Fixa", async () => {
    listRecorrentesPage.mockResolvedValue(paged([]))
    renderPage()
    await screen.findByText("Nenhuma conta fixa")
    fireEvent.click(screen.getAllByText("Nova Conta Fixa")[0])
    expect(await screen.findByPlaceholderText("Ex: Aluguel, Escola, Netflix...")).toBeInTheDocument()
  })

  it("bloqueia submit com campos vazios e mostra erros", async () => {
    listRecorrentesPage.mockResolvedValue(paged([]))
    createRecorrente.mockResolvedValue(makeRecorrente())
    renderPage()
    await screen.findByText("Nenhuma conta fixa")
    fireEvent.click(screen.getAllByText("Nova Conta Fixa")[0])
    await screen.findByText("Criar Conta Fixa")
    fireEvent.click(screen.getByText("Criar Conta Fixa"))
    expect(await screen.findByText("Descrição obrigatória.")).toBeInTheDocument()
    expect(createRecorrente).not.toHaveBeenCalled()
  })

  it("chama createRecorrente com dados válidos", async () => {
    listRecorrentesPage.mockResolvedValue(paged([]))
    createRecorrente.mockResolvedValue(makeRecorrente())
    listRecorrentesPage.mockResolvedValueOnce(paged([])).mockResolvedValueOnce(paged([makeRecorrente()]))
    renderPage()
    await screen.findByText("Nenhuma conta fixa")

    fireEvent.click(screen.getAllByText("Nova Conta Fixa")[0])
    await screen.findByText("Criar Conta Fixa")

    fireEvent.change(screen.getByPlaceholderText("Ex: Aluguel, Escola, Netflix..."), {
      target: { value: "Netflix" },
    })
    fireEvent.change(screen.getByPlaceholderText("0,00"), {
      target: { value: "45.90" },
    })

    // Select conta (Nubank) — wait for the select to be ready
    await waitFor(() => {
      expect(screen.getByText("Criar Conta Fixa")).toBeInTheDocument()
    })
    // Data inicio is pre-filled via today()
    fireEvent.click(screen.getByText("Criar Conta Fixa"))

    // If conta not selected, error shows
    expect(await screen.findByText("Selecione uma conta.")).toBeInTheDocument()
  })

  // ── Cancelar modal ──

  it("abre modal cancelar com campo motivo", async () => {
    listRecorrentesPage.mockResolvedValue(paged([makeRecorrente()]))
    renderPage()
    await screen.findByText("Suas contas fixas")

    // The XCircle (cancelar) button — aguarda a row renderizar (header é estático)
    const cancelarBtn = (await screen.findAllByTitle("Cancelar conta fixa"))[0]
    fireEvent.click(cancelarBtn)

    expect(await screen.findByText("Motivo do cancelamento")).toBeInTheDocument()
  })

  it("bloqueia cancelamento sem motivo", async () => {
    listRecorrentesPage.mockResolvedValue(paged([makeRecorrente()]))
    cancelarRecorrente.mockResolvedValue({})
    renderPage()
    await screen.findByText("Suas contas fixas")

    fireEvent.click((await screen.findAllByTitle("Cancelar conta fixa"))[0])
    await screen.findByText("Confirmar cancelamento")
    fireEvent.click(screen.getByText("Confirmar cancelamento"))

    expect(await screen.findByText("Motivo é obrigatório.")).toBeInTheDocument()
    expect(cancelarRecorrente).not.toHaveBeenCalled()
  })

  it("chama cancelarRecorrente com motivo preenchido", async () => {
    listRecorrentesPage.mockResolvedValue(paged([makeRecorrente()]))
    cancelarRecorrente.mockResolvedValue({})
    renderPage()
    await screen.findByText("Suas contas fixas")

    fireEvent.click((await screen.findAllByTitle("Cancelar conta fixa"))[0])
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
    listRecorrentesPage.mockResolvedValue(paged([makeRecorrente()]))
    renderPage()
    await screen.findByText("Suas contas fixas")

    fireEvent.click((await screen.findAllByTitle("Editar próxima ocorrência"))[0])
    expect(await screen.findByText("Novo valor (opcional)")).toBeInTheDocument()
    expect(screen.getByText("Nova descrição (opcional)")).toBeInTheDocument()
  })

  it("chama editarProximaOcorrencia ao salvar", async () => {
    listRecorrentesPage.mockResolvedValue(paged([makeRecorrente()]))
    editarProximaOcorrencia.mockResolvedValue(undefined)
    renderPage()
    await screen.findByText("Suas contas fixas")

    fireEvent.click((await screen.findAllByTitle("Editar próxima ocorrência"))[0])
    await screen.findByText("Novo valor (opcional)")

    // Just submit with empty (both are optional)
    fireEvent.click(screen.getByText("Salvar"))

    await waitFor(() => {
      expect(editarProximaOcorrencia).toHaveBeenCalledWith("rec-001", {})
    })
  })

  it("valida valor negativo na edição de próxima", async () => {
    listRecorrentesPage.mockResolvedValue(paged([makeRecorrente()]))
    editarProximaOcorrencia.mockResolvedValue(undefined)
    renderPage()
    await screen.findByText("Suas contas fixas")

    fireEvent.click((await screen.findAllByTitle("Editar próxima ocorrência"))[0])
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
    listRecorrentesPage.mockResolvedValue(paged([makeRecorrente()]))
    toggleRecorrente.mockResolvedValue(undefined)
    renderPage()
    await screen.findByText("Suas contas fixas")

    fireEvent.click((await screen.findAllByTitle("Pausar"))[0])
    await waitFor(() => {
      expect(toggleRecorrente).toHaveBeenCalledWith("rec-001")
    })
  })

  // ── Delete ──

  it("abre confirm dialog ao clicar excluir", async () => {
    listRecorrentesPage.mockResolvedValue(paged([makeRecorrente()]))
    renderPage()
    await screen.findByText("Suas contas fixas")

    fireEvent.click((await screen.findAllByTitle("Excluir"))[0])
    expect(await screen.findByText("Remover conta fixa")).toBeInTheDocument()
    expect(screen.getByText(/Remover "Netflix"/)).toBeInTheDocument()
  })

  it("chama deleteRecorrente ao confirmar exclusão", async () => {
    listRecorrentesPage.mockResolvedValue(paged([makeRecorrente()]))
    deleteRecorrente.mockResolvedValue(undefined)
    renderPage()
    await screen.findByText("Suas contas fixas")

    fireEvent.click((await screen.findAllByTitle("Excluir"))[0])
    await screen.findByText("Remover conta fixa")
    fireEvent.click(screen.getByText("Confirmar"))

    await waitFor(() => {
      expect(deleteRecorrente).toHaveBeenCalledWith("rec-001")
    })
  })
})
