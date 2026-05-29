import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import BancosPage from "../../pages/Bancos/BancosPage"
import type { Banco } from "../../types/Banco"
import type { Conta } from "../../types/Conta"

// ── Router mock ──────────────────────────────────────────────────────────────
const mockNotify = vi.fn()
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ notify: mockNotify }),
}))

// ── Service mocks ────────────────────────────────────────────────────────────
const getBancos = vi.fn()
const getContas = vi.fn()
const deleteConta = vi.fn()

vi.mock("../../services/bancoService", () => ({
  getBancos: (...a: unknown[]) => getBancos(...a),
}))
vi.mock("../../services/contaService", () => ({
  getContas: (...a: unknown[]) => getContas(...a),
  deleteConta: (...a: unknown[]) => deleteConta(...a),
}))

// NewContaDialog e legado — mockamos para isolar a page
vi.mock("../../components/Contas/NewContaDialog/NewContaDialog", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="new-conta-dialog">Dialog</div> : null,
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeBanco(overrides: Partial<Banco> = {}): Banco {
  return {
    id: "banco-001",
    nome: "Banco Nubank S.A.",
    nomeFantasia: "Nubank",
    razaoSocial: "Banco Nubank S.A.",
    codigoBanco: "260",
    tipo: 1,
    tipoDescricao: "Banco",
    ativo: true,
    logoUrl: "https://www.google.com/s2/favicons?domain=nubank.com.br&sz=128",
    cor: "#820AD1",
    ...overrides,
  }
}

function makeConta(overrides: Partial<Conta> = {}): Conta {
  return {
    id: "conta-001",
    nome: "Nubank Conta",
    tipo: 1,
    tipoDescricao: "Corrente",
    saldoAtual: 1500.0,
    isCarteira: false,
    bancoId: "banco-001",
    bancoNome: "Nubank",
    ...overrides,
  }
}

function renderPage() {
  return render(
    <PontesThemeProvider>
      <BancosPage />
    </PontesThemeProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("BancosPage", () => {
  // ── Empty state ──

  it("mostra empty state quando nao ha contas", async () => {
    getBancos.mockResolvedValue([])
    getContas.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText("Nenhuma conta cadastrada")).toBeInTheDocument()
  })

  // ── Listagem ──

  it("exibe banco com nome e tipo", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeConta()])
    renderPage()
    expect(await screen.findByText("Nubank")).toBeInTheDocument()
    expect(screen.getByText("Banco")).toBeInTheDocument()
  })

  it("exibe saldo da conta formatado", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeConta()])
    renderPage()
    await screen.findByText("Nubank")
    // saldo formatado 1500 -> "1.500" aparece no DOM
    expect(screen.getAllByText(/1\.500/).length).toBeGreaterThanOrEqual(1)
  })

  it("exibe stats: Bancos, Contas, Saldo total", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeConta()])
    renderPage()
    await screen.findByText("Nubank")
    expect(screen.getByText("Bancos")).toBeInTheDocument()
    // "Contas" aparece em StatCard e tambem na area do banco — getAllByText
    expect(screen.getAllByText("Contas").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Saldo total")).toBeInTheDocument()
  })

  it("exibe conta sem banco na secao Sem banco vinculado", async () => {
    getBancos.mockResolvedValue([])
    getContas.mockResolvedValue([makeConta({ bancoId: undefined, bancoNome: undefined })])
    renderPage()
    expect(await screen.findByText("Sem banco vinculado")).toBeInTheDocument()
    expect(screen.getByText("Nubank Conta")).toBeInTheDocument()
  })

  // ── Abrir dialog ──

  it("abre NewContaDialog ao clicar em Adicionar Conta", async () => {
    getBancos.mockResolvedValue([])
    getContas.mockResolvedValue([])
    renderPage()
    await screen.findByText("Nenhuma conta cadastrada")
    fireEvent.click(screen.getAllByText("Adicionar Conta")[0])
    expect(await screen.findByTestId("new-conta-dialog")).toBeInTheDocument()
  })

  // ── Excluir conta ──

  it("abre confirm dialog ao clicar excluir", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeConta()])
    renderPage()
    await screen.findByText("Nubank")
    fireEvent.click(screen.getByTitle("Excluir"))
    expect(await screen.findByText("Excluir conta")).toBeInTheDocument()
    expect(screen.getByText(/Remover "Nubank Conta"/)).toBeInTheDocument()
  })

  it("chama deleteConta ao confirmar exclusao", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeConta()])
    deleteConta.mockResolvedValue(undefined)
    renderPage()
    await screen.findByText("Nubank")
    fireEvent.click(screen.getByTitle("Excluir"))
    await screen.findByText("Excluir conta")
    fireEvent.click(screen.getByText("Confirmar"))
    await waitFor(() => {
      expect(deleteConta).toHaveBeenCalledWith("conta-001")
    })
  })

  it("cancela exclusao sem chamar deleteConta", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeConta()])
    renderPage()
    await screen.findByText("Nubank")
    fireEvent.click(screen.getByTitle("Excluir"))
    await screen.findByText("Excluir conta")
    fireEvent.click(screen.getByText("Cancelar"))
    expect(deleteConta).not.toHaveBeenCalled()
  })

  // ── Carteira nao exibe botoes de edicao ──

  it("conta isCarteira nao exibe botao excluir", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeConta({ isCarteira: true })])
    renderPage()
    await screen.findByText("Nubank")
    expect(screen.queryByTitle("Excluir")).not.toBeInTheDocument()
  })

  // ── PontesBankBadge ──

  it("renderiza img quando logoUrl presente", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeConta()])
    renderPage()
    await screen.findByText("Nubank")
    const img = document.querySelector("img[alt='Nubank']")
    expect(img).toBeInTheDocument()
    expect((img as HTMLImageElement).src).toContain("nubank.com.br")
  })

  it("renderiza iniciais quando sem logoUrl", async () => {
    getBancos.mockResolvedValue([makeBanco({ logoUrl: undefined })])
    getContas.mockResolvedValue([makeConta()])
    renderPage()
    await screen.findByText("Nubank")
    // Iniciais de "Nubank" -> "NU"
    expect(screen.getAllByText("NU").length).toBeGreaterThanOrEqual(1)
  })
})
