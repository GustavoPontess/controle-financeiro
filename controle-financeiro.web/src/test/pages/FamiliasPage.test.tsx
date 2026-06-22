import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import FamiliasPage from "../../pages/Familia/FamiliasPage"
import type {
  Familia, FamiliaDetalhe, ConviteFamilia, BalancoFamilia,
} from "../../types/Familia"

// ── Router mock ── (navigate é usado ao clicar num card → /familias/:id)
const mockNotify = vi.fn()
const mockNavigate = vi.fn()
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ notify: mockNotify }),
  useNavigate: () => mockNavigate,
}))

// ── Auth mock ── (currentUser define papel/saldo exibidos no card)
const { mockAuth } = vi.hoisted(() => ({
  mockAuth: { currentUser: { id: "u1", nome: "Dev Test" } as { id: string; nome: string } | null },
}))
vi.mock("../../hooks/useAuth", () => ({ useAuth: () => mockAuth }))

// ── Service mocks ──
const getFamilias = vi.fn()
const getFamilia = vi.fn()
const getBalancoFamilia = vi.fn()
const criarFamilia = vi.fn()
const getConvitesPendentes = vi.fn()
const aceitarConvite = vi.fn()
const recusarConvite = vi.fn()

vi.mock("../../services/familiaService", () => ({
  getFamilias:        (...a: unknown[]) => getFamilias(...a),
  getFamilia:         (...a: unknown[]) => getFamilia(...a),
  getBalancoFamilia:  (...a: unknown[]) => getBalancoFamilia(...a),
  criarFamilia:       (...a: unknown[]) => criarFamilia(...a),
  getConvitesPendentes: (...a: unknown[]) => getConvitesPendentes(...a),
  aceitarConvite:     (...a: unknown[]) => aceitarConvite(...a),
  recusarConvite:     (...a: unknown[]) => recusarConvite(...a),
}))

// ── Fixtures ──
const familiaA: Familia = {
  id: "f1", nome: "Família Silva", criadoPorUsuarioId: "u1",
  criadoEm: "2026-01-01T00:00:00", ehAdmin: true, totalMembros: 2,
}
const detalhe: FamiliaDetalhe = {
  id: "f1", nome: "Família Silva", criadoPorUsuarioId: "u1",
  criadoEm: "2026-01-01T00:00:00", ehAdmin: true, modoRateioPadrao: 1,
  membros: [
    { id: "m1", usuarioId: "u1", nomeUsuario: "Dev Test", emailUsuario: "dev@test.com", papel: "Administrador", entrouEm: "2026-01-01T00:00:00", rendaMensal: null },
    { id: "m2", usuarioId: "u2", nomeUsuario: "Maria Souza", emailUsuario: "maria@test.com", papel: "Esposa", entrouEm: "2026-01-15T00:00:00", rendaMensal: 3000 },
  ],
  convitesPendentes: [],
  limiteAprovacao: null,
}
const balanco: BalancoFamilia = {
  mes: 5, ano: 2026, modo: 1, total: 700, cota: 350,
  saldos: [
    { usuarioId: "u1", nome: "Dev Test", pagou: 230, cota: 350, saldo: -120.5 },
    { usuarioId: "u2", nome: "Maria Souza", pagou: 470, cota: 350, saldo: 120.5 },
  ],
}
const convitePendente: ConviteFamilia = {
  id: "cv1", familiaId: "f1", nomeFamilia: "Família Silva",
  emailConvidado: "pedro@test.com", papel: "Filho", status: 1,
  expiraEm: "2026-06-01T00:00:00", criadoEm: "2026-05-01T00:00:00", token: "tok-abc",
}

function renderPage() {
  return render(<PontesThemeProvider><FamiliasPage /></PontesThemeProvider>)
}

describe("FamiliasPage — cards ricos (#85)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNotify.mockReset()
    mockNavigate.mockReset()
    mockAuth.currentUser = { id: "u1", nome: "Dev Test" }
    getFamilias.mockResolvedValue([familiaA])
    getFamilia.mockResolvedValue(detalhe)
    getBalancoFamilia.mockResolvedValue(balanco)
    getConvitesPendentes.mockResolvedValue([])
    criarFamilia.mockResolvedValue(undefined)
    aceitarConvite.mockResolvedValue(undefined)
    recusarConvite.mockResolvedValue(undefined)
  })

  // ── Render inicial ──

  it("renderiza título, subtítulo e botão Nova Família", async () => {
    renderPage()
    expect(await screen.findByRole("heading", { name: "Famílias" })).toBeInTheDocument()
    expect(screen.getByText("Organize as finanças com quem você divide a vida.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Nova Família/i })).toBeInTheDocument()
  })

  it("estado vazio: mostra PontesEmptyState quando não há famílias", async () => {
    getFamilias.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText("Nenhuma família ainda")).toBeInTheDocument()
    expect(screen.getByText(/Crie uma família para compartilhar/)).toBeInTheDocument()
  })

  it("card mostra nome, badge admin, membros, modo de rateio e saldo do mês", async () => {
    renderPage()
    expect(await screen.findByText("Família Silva")).toBeInTheDocument()
    expect(screen.getByText("2 membros · Administrador")).toBeInTheDocument()
    expect(screen.getByText("Admin")).toBeInTheDocument()
    // nomes (primeiro nome) dos membros
    expect(screen.getByText("Dev, Maria")).toBeInTheDocument()
    // modo de rateio
    expect(screen.getByText("Igualitário")).toBeInTheDocument()
    // saldo do mês para o usuário logado (u1 deve a acertar 120,50)
    expect(screen.getByText(/você tem a acertar R\$\s?120,50/)).toBeInTheDocument()
  })

  it("saldo positivo: mostra 'a receber' para o usuário logado", async () => {
    mockAuth.currentUser = { id: "u2", nome: "Maria Souza" }
    renderPage()
    await screen.findByText("Família Silva")
    expect(screen.getByText(/você tem a receber R\$\s?120,50/)).toBeInTheDocument()
  })

  it("clique no card navega para o detalhe (/familias/:id)", async () => {
    renderPage()
    fireEvent.click(await screen.findByText("Família Silva"))
    expect(mockNavigate).toHaveBeenCalledWith("/familias/f1")
  })

  it("enriquecimento falha: card cai no básico (nome + membros) sem quebrar", async () => {
    getFamilia.mockRejectedValue(new Error("boom"))
    getBalancoFamilia.mockRejectedValue(new Error("boom"))
    renderPage()
    expect(await screen.findByText("Família Silva")).toBeInTheDocument()
    expect(screen.getByText("Sem despesas no mês")).toBeInTheDocument()
  })

  it("erro ao carregar famílias: notifica com severity error", async () => {
    getFamilias.mockRejectedValue(new Error("network"))
    renderPage()
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "error", open: true })
    ))
  })

  // ── Convites pendentes externos ──

  it("exibe seção de convites pendentes quando há convites", async () => {
    getConvitesPendentes.mockResolvedValue([convitePendente])
    renderPage()
    expect(await screen.findByText("Convites pendentes")).toBeInTheDocument()
    expect(screen.getByText(/convidou você como Filho/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Aceitar" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Recusar" })).toBeInTheDocument()
  })

  it("aceitar convite chama aceitarConvite(token) e recarrega dados", async () => {
    getConvitesPendentes.mockResolvedValue([convitePendente])
    renderPage()
    await screen.findByText("Convites pendentes")
    fireEvent.click(screen.getByRole("button", { name: "Aceitar" }))
    await waitFor(() => expect(aceitarConvite).toHaveBeenCalledWith("tok-abc"))
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))
  })

  it("recusar convite chama recusarConvite(token) e notifica sucesso", async () => {
    getConvitesPendentes.mockResolvedValue([convitePendente])
    renderPage()
    await screen.findByText("Convites pendentes")
    fireEvent.click(screen.getByRole("button", { name: "Recusar" }))
    await waitFor(() => expect(recusarConvite).toHaveBeenCalledWith("tok-abc"))
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))
  })

  // ── Modal Nova Família ──

  it("abre modal Nova Família ao clicar no botão", async () => {
    renderPage()
    await screen.findByText("Família Silva")
    fireEvent.click(screen.getByRole("button", { name: /Nova Família/i }))
    expect(await screen.findByPlaceholderText("Ex: Família Silva")).toBeInTheDocument()
  })

  it("validação: nome vazio bloqueia criação e exibe erro inline", async () => {
    renderPage()
    await screen.findByText("Família Silva")
    fireEvent.click(screen.getByRole("button", { name: /Nova Família/i }))
    await screen.findByPlaceholderText("Ex: Família Silva")
    fireEvent.click(screen.getByRole("button", { name: "Criar" }))
    expect(screen.getByText("Informe o nome")).toBeInTheDocument()
    expect(criarFamilia).not.toHaveBeenCalled()
  })

  it("criar família: chama criarFamilia com nome correto e notifica", async () => {
    renderPage()
    await screen.findByText("Família Silva")
    fireEvent.click(screen.getByRole("button", { name: /Nova Família/i }))
    const input = await screen.findByPlaceholderText("Ex: Família Silva")
    fireEvent.change(input, { target: { value: "Família Teste" } })
    fireEvent.click(screen.getByRole("button", { name: "Criar" }))
    await waitFor(() => expect(criarFamilia).toHaveBeenCalledWith("Família Teste"))
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))
  })

  it("erro ao criar família: notifica com error", async () => {
    criarFamilia.mockRejectedValue(new Error("fail"))
    renderPage()
    await screen.findByText("Família Silva")
    fireEvent.click(screen.getByRole("button", { name: /Nova Família/i }))
    const input = await screen.findByPlaceholderText("Ex: Família Silva")
    fireEvent.change(input, { target: { value: "Nova" } })
    fireEvent.click(screen.getByRole("button", { name: "Criar" }))
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "error" })
    ))
  })
})
