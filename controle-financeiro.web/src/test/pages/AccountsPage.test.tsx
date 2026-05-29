import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import AccountsPage from "../../pages/Accounts/AccountsPage"
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
    nome: "Nubank Corrente",
    tipo: 1,
    tipoDescricao: "Corrente",
    saldoAtual: 2500.0,
    isCarteira: false,
    bancoId: "banco-001",
    bancoNome: "Nubank",
    ...overrides,
  }
}

function makeCarteira(overrides: Partial<Conta> = {}): Conta {
  return {
    id: "carteira-001",
    nome: "Carteira",
    tipo: 1,
    tipoDescricao: "Carteira",
    saldoAtual: 150.0,
    isCarteira: true,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <PontesThemeProvider>
      <AccountsPage />
    </PontesThemeProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AccountsPage", () => {
  // ── Empty state ──

  it("mostra empty state quando nao ha contas bancarias", async () => {
    getBancos.mockResolvedValue([])
    getContas.mockResolvedValue([makeCarteira()])
    renderPage()
    expect(await screen.findByText("Nenhuma conta bancária cadastrada")).toBeInTheDocument()
  })

  // ── Listagem e stats ──

  it("exibe nome e banco da conta", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeCarteira(), makeConta()])
    renderPage()
    expect(await screen.findByText("Nubank Corrente")).toBeInTheDocument()
    expect(screen.getAllByText("Nubank").length).toBeGreaterThanOrEqual(1)
  })

  it("exibe stats: Saldo Total, Contas Bancarias, Carteira Fisica", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeCarteira(), makeConta()])
    renderPage()
    await screen.findByText("Nubank Corrente")
    expect(screen.getByText("Saldo Total")).toBeInTheDocument()
    expect(screen.getByText("Contas Bancárias")).toBeInTheDocument()
    expect(screen.getByText("Carteira Física")).toBeInTheDocument()
  })

  it("exibe carteira automatica com saldo", async () => {
    getBancos.mockResolvedValue([])
    getContas.mockResolvedValue([makeCarteira()])
    renderPage()
    expect(await screen.findByText("Carteira automática")).toBeInTheDocument()
    expect(screen.getByText("Carteira")).toBeInTheDocument()
  })

  it("exibe badge de tipo na conta", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeConta()])
    renderPage()
    await screen.findByText("Nubank Corrente")
    expect(screen.getByText("Corrente")).toBeInTheDocument()
  })

  // ── Abrir dialog ──

  it("abre NewContaDialog ao clicar Nova Conta", async () => {
    getBancos.mockResolvedValue([])
    getContas.mockResolvedValue([])
    renderPage()
    await screen.findByText("Nenhuma conta bancária cadastrada")
    fireEvent.click(screen.getAllByText("Nova Conta")[0])
    expect(await screen.findByTestId("new-conta-dialog")).toBeInTheDocument()
  })

  it("abre dialog de edicao ao clicar Editar", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeConta()])
    renderPage()
    await screen.findByText("Nubank Corrente")
    fireEvent.click(screen.getByTitle("Editar"))
    expect(await screen.findByTestId("new-conta-dialog")).toBeInTheDocument()
  })

  // ── Excluir conta ──

  it("abre confirm dialog ao clicar excluir", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeConta()])
    renderPage()
    await screen.findByText("Nubank Corrente")
    fireEvent.click(screen.getByTitle("Excluir"))
    expect(await screen.findByText("Excluir conta")).toBeInTheDocument()
    expect(screen.getByText(/Remover "Nubank Corrente"/)).toBeInTheDocument()
  })

  it("chama deleteConta ao confirmar exclusao", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeConta()])
    deleteConta.mockResolvedValue(undefined)
    renderPage()
    await screen.findByText("Nubank Corrente")
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
    await screen.findByText("Nubank Corrente")
    fireEvent.click(screen.getByTitle("Excluir"))
    await screen.findByText("Excluir conta")
    fireEvent.click(screen.getByText("Cancelar"))
    expect(deleteConta).not.toHaveBeenCalled()
  })

  // ── PontesBankBadge ──

  it("exibe logo do banco quando logoUrl presente", async () => {
    getBancos.mockResolvedValue([makeBanco()])
    getContas.mockResolvedValue([makeConta()])
    renderPage()
    await screen.findByText("Nubank Corrente")
    const img = document.querySelector("img[alt='Nubank']")
    expect(img).toBeInTheDocument()
    expect((img as HTMLImageElement).src).toContain("nubank.com.br")
  })

  it("exibe iniciais quando banco sem logo", async () => {
    getBancos.mockResolvedValue([makeBanco({ logoUrl: undefined })])
    getContas.mockResolvedValue([makeConta()])
    renderPage()
    await screen.findByText("Nubank Corrente")
    expect(screen.getAllByText("NU").length).toBeGreaterThanOrEqual(1)
  })

  it("exibe iniciais quando conta sem banco vinculado", async () => {
    getBancos.mockResolvedValue([])
    getContas.mockResolvedValue([makeConta({ bancoId: undefined, bancoNome: undefined })])
    renderPage()
    await screen.findByText("Nubank Corrente")
    expect(screen.getByText("Sem banco vinculado")).toBeInTheDocument()
  })
})
