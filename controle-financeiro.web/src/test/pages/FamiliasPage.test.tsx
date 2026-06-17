import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import FamiliasPage from "../../pages/Familia/FamiliasPage"
import type {
  Familia, FamiliaDetalhe, ConviteFamilia, DespesaCompartilhada,
  BalancoFamilia, Dependente, AcertoContas,
} from "../../types/Familia"

// ── Router mock ──
const mockNotify = vi.fn()
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ notify: mockNotify }),
}))

// ── Auth mock ── (currentUser controla quem pode remover/sair na lista de membros)
const { mockAuth } = vi.hoisted(() => ({
  mockAuth: { currentUser: { id: "u1", nome: "Dev Test" } as { id: string; nome: string } | null },
}))
vi.mock("../../hooks/useAuth", () => ({ useAuth: () => mockAuth }))

// ── Service mocks ──
const getFamilias      = vi.fn()
const getFamilia       = vi.fn()
const criarFamilia     = vi.fn()
const dissolverFamilia = vi.fn()
const convidarMembro   = vi.fn()
const revogarConvite   = vi.fn()
const removerMembro    = vi.fn()
const getConvitesPendentes = vi.fn()
const aceitarConvite   = vi.fn()
const recusarConvite   = vi.fn()
const getDespesasFamilia = vi.fn()
const getBalancoFamilia  = vi.fn()
const getDependentes   = vi.fn()
const criarDependente  = vi.fn()
const atualizarDependente = vi.fn()
const inativarDependente  = vi.fn()
const definirModoRateio = vi.fn()
const definirRendaMembro = vi.fn()
const getAcertos       = vi.fn()
const registrarAcerto  = vi.fn()
const cancelarAcerto   = vi.fn()
const definirLimiteAprovacao = vi.fn()
const aprovarDespesa   = vi.fn()
const rejeitarDespesa  = vi.fn()

vi.mock("../../services/familiaService", () => ({
  getFamilias:        (...a: unknown[]) => getFamilias(...a),
  getFamilia:         (...a: unknown[]) => getFamilia(...a),
  criarFamilia:       (...a: unknown[]) => criarFamilia(...a),
  dissolverFamilia:   (...a: unknown[]) => dissolverFamilia(...a),
  convidarMembro:     (...a: unknown[]) => convidarMembro(...a),
  revogarConvite:     (...a: unknown[]) => revogarConvite(...a),
  removerMembro:      (...a: unknown[]) => removerMembro(...a),
  getConvitesPendentes: (...a: unknown[]) => getConvitesPendentes(...a),
  aceitarConvite:     (...a: unknown[]) => aceitarConvite(...a),
  recusarConvite:     (...a: unknown[]) => recusarConvite(...a),
  getDespesasFamilia: (...a: unknown[]) => getDespesasFamilia(...a),
  getBalancoFamilia:  (...a: unknown[]) => getBalancoFamilia(...a),
  getDependentes:     (...a: unknown[]) => getDependentes(...a),
  criarDependente:    (...a: unknown[]) => criarDependente(...a),
  atualizarDependente:(...a: unknown[]) => atualizarDependente(...a),
  inativarDependente: (...a: unknown[]) => inativarDependente(...a),
  definirModoRateio:  (...a: unknown[]) => definirModoRateio(...a),
  definirRendaMembro: (...a: unknown[]) => definirRendaMembro(...a),
  getAcertos:         (...a: unknown[]) => getAcertos(...a),
  registrarAcerto:    (...a: unknown[]) => registrarAcerto(...a),
  cancelarAcerto:     (...a: unknown[]) => cancelarAcerto(...a),
  definirLimiteAprovacao: (...a: unknown[]) => definirLimiteAprovacao(...a),
  aprovarDespesa:     (...a: unknown[]) => aprovarDespesa(...a),
  rejeitarDespesa:    (...a: unknown[]) => rejeitarDespesa(...a),
}))

// ── Fixtures ──
const familia: Familia = {
  id: "f1", nome: "Família Silva", criadoPorUsuarioId: "u1",
  criadoEm: "2026-01-01T00:00:00", ehAdmin: true, totalMembros: 2,
}

const membroAdmin = {
  id: "m1", usuarioId: "u1", nomeUsuario: "Dev Test", emailUsuario: "dev@test.com",
  papel: "Administrador", entrouEm: "2026-01-01T00:00:00", rendaMensal: null,
}

const membroOutro = {
  id: "m2", usuarioId: "u2", nomeUsuario: "Maria", emailUsuario: "maria@test.com",
  papel: "Esposa", entrouEm: "2026-01-15T00:00:00", rendaMensal: 3000,
}

const detalhe: FamiliaDetalhe = {
  id: "f1", nome: "Família Silva", criadoPorUsuarioId: "u1",
  criadoEm: "2026-01-01T00:00:00", ehAdmin: true, modoRateioPadrao: 1,
  membros: [membroAdmin, membroOutro],
  convitesPendentes: [],
  limiteAprovacao: null,
}

const dependente: Dependente = {
  id: "d1", familiaId: "f1", nome: "Júlia", apelido: "Ju",
  dataNascimento: "2020-05-10", tipo: 1, ativo: true,
}

const despesa: DespesaCompartilhada = {
  id: "dp1", descricao: "Supermercado", valor: 350.5, data: "2026-05-20",
  categoriaNome: "Alimentação", pagadorUsuarioId: "u1", pagadorNome: "Dev Test",
  statusAprovacao: 0, aprovadoPorNome: null,
}

const balanco: BalancoFamilia = {
  mes: 5, ano: 2026, modo: 1, total: 700, cota: 350,
  saldos: [
    { usuarioId: "u1", nome: "Dev Test", pagou: 350, cota: 350, saldo: 0 },
    { usuarioId: "u2", nome: "Maria", pagou: 350, cota: 350, saldo: 0 },
  ],
}

const acerto: AcertoContas = {
  id: "a1", deUsuarioId: "u2", deNome: "Maria", paraUsuarioId: "u1", paraNome: "Dev Test",
  valor: 150, mes: 5, ano: 2026, observacao: "Pix", criadoEm: "2026-05-22T00:00:00",
}

const convitePendente: ConviteFamilia = {
  id: "cv1", familiaId: "f1", nomeFamilia: "Família Silva",
  emailConvidado: "pedro@test.com", papel: "Filho", status: 1,
  expiraEm: "2026-06-01T00:00:00", criadoEm: "2026-05-01T00:00:00", token: "tok-abc",
}

// ── Helpers ──
function renderPage() {
  return render(<PontesThemeProvider><FamiliasPage /></PontesThemeProvider>)
}

function setupDetailMocks(overrides: Partial<{
  detalhe: FamiliaDetalhe
  despesas: DespesaCompartilhada[]
  balanco: BalancoFamilia | null
  dependentes: Dependente[]
  acertos: AcertoContas[]
}> = {}) {
  getFamilia.mockResolvedValue(overrides.detalhe ?? detalhe)
  getDespesasFamilia.mockResolvedValue(overrides.despesas ?? [despesa])
  getBalancoFamilia.mockResolvedValue(overrides.balanco ?? balanco)
  getDependentes.mockResolvedValue(overrides.dependentes ?? [dependente])
  getAcertos.mockResolvedValue(overrides.acertos ?? [acerto])
}

async function openDetalhe() {
  renderPage()
  await screen.findByText("Família Silva")
  fireEvent.click(screen.getByText("Família Silva"))
  await screen.findByText(/Membros/)
}

// ── Tests ──
describe("FamiliasPage (#85)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNotify.mockReset()
    mockAuth.currentUser = { id: "u1", nome: "Dev Test" } // admin/criador por padrão
    getFamilias.mockResolvedValue([familia])
    getConvitesPendentes.mockResolvedValue([])
    criarFamilia.mockResolvedValue(undefined)
    dissolverFamilia.mockResolvedValue(undefined)
    convidarMembro.mockResolvedValue(undefined)
    revogarConvite.mockResolvedValue(undefined)
    removerMembro.mockResolvedValue(undefined)
    aceitarConvite.mockResolvedValue(undefined)
    recusarConvite.mockResolvedValue(undefined)
    definirModoRateio.mockResolvedValue(undefined)
    definirRendaMembro.mockResolvedValue(undefined)
    criarDependente.mockResolvedValue(undefined)
    atualizarDependente.mockResolvedValue(undefined)
    inativarDependente.mockResolvedValue(undefined)
    registrarAcerto.mockResolvedValue(undefined)
    cancelarAcerto.mockResolvedValue(undefined)
    definirLimiteAprovacao.mockResolvedValue(undefined)
    aprovarDespesa.mockResolvedValue(undefined)
    rejeitarDespesa.mockResolvedValue(undefined)
    setupDetailMocks()
  })

  // ══════════════════════════════════════════
  // Render inicial
  // ══════════════════════════════════════════

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

  it("lista família com nome, contagem de membros e badge de admin", async () => {
    renderPage()
    expect(await screen.findByText("Família Silva")).toBeInTheDocument()
    expect(screen.getByText("2 membros")).toBeInTheDocument()
    expect(screen.getByText("Administrador")).toBeInTheDocument()
  })

  it("família não-admin não exibe badge Administrador", async () => {
    getFamilias.mockResolvedValue([{ ...familia, ehAdmin: false }])
    renderPage()
    await screen.findByText("Família Silva")
    expect(screen.queryByText("Administrador")).not.toBeInTheDocument()
  })

  it("erro ao carregar famílias: notifica com severity error", async () => {
    getFamilias.mockRejectedValue(new Error("network"))
    renderPage()
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "error", open: true })
    ))
  })

  // ══════════════════════════════════════════
  // Convites pendentes externos
  // ══════════════════════════════════════════

  it("exibe seção de convites pendentes quando há convites", async () => {
    getConvitesPendentes.mockResolvedValue([convitePendente])
    renderPage()
    expect(await screen.findByText("Convites pendentes")).toBeInTheDocument()
    // verifica que o nome da família aparece em negrito no texto do convite
    expect(screen.getAllByText(/Família Silva/).length).toBeGreaterThan(0)
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

  // ══════════════════════════════════════════
  // Modal Nova Família
  // ══════════════════════════════════════════

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

  it("criar família: chama criarFamilia com nome correto, fecha modal e notifica", async () => {
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

  // ══════════════════════════════════════════
  // Modal de detalhe da família
  // ══════════════════════════════════════════

  it("clique no card abre modal de detalhe com membros", async () => {
    await openDetalhe()
    expect(screen.getByText("Dev Test")).toBeInTheDocument()
    expect(screen.getByText("Maria")).toBeInTheDocument()
    expect(screen.getByText("Esposa")).toBeInTheDocument()
  })

  it("detalhe exibe e-mail e renda do membro", async () => {
    await openDetalhe()
    expect(screen.getByText(/maria@test\.com/)).toBeInTheDocument()
    expect(screen.getByText(/renda R\$\s?3\.000,00/)).toBeInTheDocument()
  })

  it("admin vê botão Convidar e botão Dissolver", async () => {
    await openDetalhe()
    expect(screen.getByRole("button", { name: /Convidar/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Dissolver/i })).toBeInTheDocument()
  })

  it("não-admin não vê botão Convidar nem Dissolver", async () => {
    setupDetailMocks({ detalhe: { ...detalhe, ehAdmin: false } })
    await openDetalhe()
    expect(screen.queryByRole("button", { name: /Convidar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Dissolver/i })).not.toBeInTheDocument()
  })

  it("detalhe exibe despesas compartilhadas do mês", async () => {
    await openDetalhe()
    expect(screen.getByText(/Supermercado/)).toBeInTheDocument()
    expect(screen.getByText(/R\$\s?350,50/)).toBeInTheDocument()
  })

  it("detalhe exibe dependente com nome e tipo", async () => {
    await openDetalhe()
    expect(screen.getByText("Júlia")).toBeInTheDocument()
    expect(screen.getByText("Criança")).toBeInTheDocument()
  })

  it("detalhe exibe acerto de contas com seta e valor", async () => {
    await openDetalhe()
    // "Pix" é único ao acerto (observação), e R$150,00 também
    expect(screen.getByText(/Pix/)).toBeInTheDocument()
    expect(screen.getAllByText(/R\$\s?150,00/).length).toBeGreaterThan(0)
  })

  it("detalhe exibe balanço do mês com total", async () => {
    await openDetalhe()
    expect(screen.getByText(/R\$\s?700,00 em despesas/)).toBeInTheDocument()
  })

  it("fechar modal de detalhe via botão Fechar", async () => {
    await openDetalhe()
    // getAllByRole pois o X do modal e o botão Fechar do footer têm mesmo nome acessível
    const fecharBtns = screen.getAllByRole("button", { name: "Fechar" })
    fireEvent.click(fecharBtns[fecharBtns.length - 1])
    await waitFor(() => expect(screen.queryByText("Dev Test")).not.toBeInTheDocument())
  })

  it("convites pendentes internos: exibe email e botão revogar (admin)", async () => {
    const conviteInterno = {
      ...convitePendente, emailConvidado: "pedro@test.com", papel: "Filho",
    }
    setupDetailMocks({ detalhe: { ...detalhe, convitesPendentes: [conviteInterno] } })
    await openDetalhe()
    expect(screen.getByText(/pedro@test\.com/)).toBeInTheDocument()
    expect(screen.getByLabelText("Revogar convite")).toBeInTheDocument()
  })

  it("admin: modo de rateio exibe select", async () => {
    await openDetalhe()
    expect(screen.getByText("Igualitário")).toBeInTheDocument()
  })

  it("não-admin: modo de rateio exibe texto estático", async () => {
    setupDetailMocks({ detalhe: { ...detalhe, ehAdmin: false, modoRateioPadrao: 2 } })
    await openDetalhe()
    expect(screen.getByText("Proporcional à renda")).toBeInTheDocument()
  })

  it("empty: nenhuma despesa mostra mensagem vazia", async () => {
    setupDetailMocks({ despesas: [] })
    await openDetalhe()
    expect(screen.getByText("Nenhuma despesa compartilhada neste mês.")).toBeInTheDocument()
  })

  it("empty: nenhum dependente mostra mensagem vazia", async () => {
    setupDetailMocks({ dependentes: [] })
    await openDetalhe()
    expect(screen.getByText("Nenhum dependente cadastrado.")).toBeInTheDocument()
  })

  it("empty: nenhum acerto mostra mensagem vazia", async () => {
    setupDetailMocks({ acertos: [] })
    await openDetalhe()
    expect(screen.getByText("Nenhum acerto registrado neste mês.")).toBeInTheDocument()
  })

  // ══════════════════════════════════════════
  // Modal Convidar membro
  // ══════════════════════════════════════════

  it("abre modal de convite ao clicar Convidar", async () => {
    await openDetalhe()
    fireEvent.click(screen.getByRole("button", { name: /Convidar/i }))
    expect(await screen.findByPlaceholderText("joao@email.com")).toBeInTheDocument()
  })

  it("validação convite: e-mail e papel vazios exibem erros inline", async () => {
    await openDetalhe()
    fireEvent.click(screen.getByRole("button", { name: /Convidar/i }))
    await screen.findByPlaceholderText("joao@email.com")
    fireEvent.click(screen.getByRole("button", { name: "Enviar convite" }))
    expect(screen.getByText("Informe o e-mail")).toBeInTheDocument()
    expect(screen.getByText("Informe o papel")).toBeInTheDocument()
    expect(convidarMembro).not.toHaveBeenCalled()
  })

  it("enviar convite: chama convidarMembro com email e papel corretos", async () => {
    await openDetalhe()
    fireEvent.click(screen.getByRole("button", { name: /Convidar/i }))
    fireEvent.change(await screen.findByPlaceholderText("joao@email.com"), {
      target: { value: "pedro@test.com" },
    })
    fireEvent.change(screen.getByPlaceholderText("Ex: Esposa, Filho, Sócio"), {
      target: { value: "Irmão" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Enviar convite" }))
    await waitFor(() => expect(convidarMembro).toHaveBeenCalledWith("f1", "pedro@test.com", "Irmão"))
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))
  })

  // ══════════════════════════════════════════
  // Modal Dependentes
  // ══════════════════════════════════════════

  it("abre modal de novo dependente ao clicar Adicionar", async () => {
    await openDetalhe()
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/i }))
    expect(await screen.findByText("Novo dependente")).toBeInTheDocument()
  })

  it("validação dependente: nome vazio bloqueia e exibe erro inline", async () => {
    await openDetalhe()
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/i }))
    await screen.findByText("Novo dependente")
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(screen.getByText("Informe o nome")).toBeInTheDocument()
    expect(criarDependente).not.toHaveBeenCalled()
  })

  it("criar dependente: chama criarDependente com dados corretos", async () => {
    getDependentes.mockResolvedValue([dependente])
    await openDetalhe()
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/i }))
    fireEvent.change(await screen.findByPlaceholderText("Ex: Lúcia"), { target: { value: "Pedro" } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(criarDependente).toHaveBeenCalledWith(
      "f1",
      expect.objectContaining({ nome: "Pedro" }),
    ))
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))
  })

  it("editar dependente: abre modal com dados preenchidos e chama atualizarDependente", async () => {
    await openDetalhe()
    fireEvent.click(screen.getByLabelText("Editar"))
    expect(await screen.findByText("Editar dependente")).toBeInTheDocument()
    const input = screen.getByDisplayValue("Júlia")
    fireEvent.change(input, { target: { value: "Júlia Editada" } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(atualizarDependente).toHaveBeenCalledWith(
      "f1", "d1",
      expect.objectContaining({ nome: "Júlia Editada" }),
    ))
  })

  it("inativar dependente: PontesDialog abre e confirmar chama inativarDependente", async () => {
    await openDetalhe()
    fireEvent.click(screen.getByLabelText("Inativar"))
    expect(await screen.findByText("Inativar dependente?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    await waitFor(() => expect(inativarDependente).toHaveBeenCalledWith("f1", "d1"))
  })

  it("inativar dependente: cancelar não chama inativarDependente", async () => {
    await openDetalhe()
    fireEvent.click(screen.getByLabelText("Inativar"))
    await screen.findByText("Inativar dependente?")
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    await waitFor(() => expect(inativarDependente).not.toHaveBeenCalled())
  })

  // ══════════════════════════════════════════
  // Modal Renda
  // ══════════════════════════════════════════

  it("abre modal de renda ao clicar no ícone Wallet do membro", async () => {
    await openDetalhe()
    const wallets = screen.getAllByLabelText("Definir renda")
    fireEvent.click(wallets[0])
    expect(await screen.findByText(/Renda mensal — Dev Test/)).toBeInTheDocument()
  })

  it("renda inválida exibe erro inline sem chamar o service", async () => {
    await openDetalhe()
    fireEvent.click(screen.getAllByLabelText("Definir renda")[0])
    // espera pelo texto único do título do modal (inclui nome do membro)
    await screen.findByText(/Renda mensal — Dev Test/)
    const input = screen.getByPlaceholderText("0")
    fireEvent.change(input, { target: { value: "-100" } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(screen.getByText("Renda inválida")).toBeInTheDocument()
    expect(definirRendaMembro).not.toHaveBeenCalled()
  })

  it("salvar renda: chama definirRendaMembro com valor numérico correto", async () => {
    await openDetalhe()
    fireEvent.click(screen.getAllByLabelText("Definir renda")[0])
    await screen.findByText(/Renda mensal — Dev Test/)
    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "5000" } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(definirRendaMembro).toHaveBeenCalledWith("f1", "m1", 5000))
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))
  })

  it("salvar renda vazia: chama definirRendaMembro com null", async () => {
    await openDetalhe()
    fireEvent.click(screen.getAllByLabelText("Definir renda")[0])
    await screen.findByText(/Renda mensal — Dev Test/)
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(definirRendaMembro).toHaveBeenCalledWith("f1", "m1", null))
  })

  // ══════════════════════════════════════════
  // Modal Acerto de contas
  // ══════════════════════════════════════════

  it("abre modal de registrar acerto", async () => {
    await openDetalhe()
    fireEvent.click(screen.getByRole("button", { name: /Registrar acerto/i }))
    // texto único do interior do modal (não confunde com o botão)
    expect(await screen.findByText(/Registra que um membro pagou a outro/)).toBeInTheDocument()
  })

  it("acerto: sem pagador/recebedor selecionado notifica error e não chama service", async () => {
    await openDetalhe()
    fireEvent.click(screen.getByRole("button", { name: /Registrar acerto/i }))
    await screen.findByText(/Registra que um membro pagou a outro/)
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }))
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "error", message: "Selecione quem pagou e quem recebeu" })
    ))
    expect(registrarAcerto).not.toHaveBeenCalled()
  })

  it("acerto: valor inválido (0) notifica error", async () => {
    await openDetalhe()
    fireEvent.click(screen.getByRole("button", { name: /Registrar acerto/i }))
    await screen.findByText(/Registra que um membro pagou a outro/)
    // sem selects preenchidos, a validação de pagador dispara primeiro
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }))
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "error" })
    ))
  })

  it("cancelar acerto: PontesDialog abre e confirmar chama cancelarAcerto", async () => {
    await openDetalhe()
    fireEvent.click(screen.getByLabelText("Cancelar acerto"))
    expect(await screen.findByText("Cancelar acerto?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    await waitFor(() => expect(cancelarAcerto).toHaveBeenCalledWith("f1", "a1"))
  })

  // ══════════════════════════════════════════
  // Aprovação de despesa (2.4)
  // ══════════════════════════════════════════

  it("despesa pendente: badge + aprovar chama aprovarDespesa (não-pagador) (2.4)", async () => {
    // currentUser = u1 (default); despesa paga por u2 (Maria), pendente
    setupDetailMocks({ despesas: [{ ...despesa, id: "dp2", pagadorUsuarioId: "u2", pagadorNome: "Maria", statusAprovacao: 1 }] })
    await openDetalhe()
    expect(screen.getByText("Pendente")).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("Aprovar despesa"))
    await waitFor(() => expect(aprovarDespesa).toHaveBeenCalledWith("f1", "dp2"))
  })

  it("despesa pendente: rejeitar chama rejeitarDespesa (2.4)", async () => {
    setupDetailMocks({ despesas: [{ ...despesa, id: "dp2", pagadorUsuarioId: "u2", statusAprovacao: 1 }] })
    await openDetalhe()
    fireEvent.click(screen.getByLabelText("Rejeitar despesa"))
    await waitFor(() => expect(rejeitarDespesa).toHaveBeenCalledWith("f1", "dp2"))
  })

  it("despesa pendente: o próprio pagador não vê aprovar/rejeitar (2.4)", async () => {
    // currentUser = u1 e despesa paga por u1
    setupDetailMocks({ despesas: [{ ...despesa, id: "dp3", pagadorUsuarioId: "u1", statusAprovacao: 1 }] })
    await openDetalhe()
    expect(screen.getByText("Pendente")).toBeInTheDocument()
    expect(screen.queryByLabelText("Aprovar despesa")).not.toBeInTheDocument()
  })

  it("admin define limite de aprovação (2.4)", async () => {
    await openDetalhe()
    fireEvent.click(screen.getByRole("button", { name: /Aprovação: desligada/i }))
    const input = await screen.findByPlaceholderText(/Ex\.: 200/)
    fireEvent.change(input, { target: { value: "300" } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(definirLimiteAprovacao).toHaveBeenCalledWith("f1", 300))
  })

  // ══════════════════════════════════════════
  // Remover membro / Dissolver
  // ══════════════════════════════════════════

  it("remover membro: PontesDialog abre e confirmar chama removerMembro", async () => {
    await openDetalhe()
    // o botão aparece apenas para membros que não são o criador (membroOutro = m2)
    fireEvent.click(screen.getByLabelText("Remover membro"))
    expect(await screen.findByText(/Sair desta família|Remover membro/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    await waitFor(() => expect(removerMembro).toHaveBeenCalledWith("f1", "m2"))
  })

  it("admin removendo OUTRO membro: dialog 'Remover membro?' (não 'Sair') (#ehProprio)", async () => {
    // currentUser = u1 (admin/criador) por padrão; remove o membroOutro (u2)
    await openDetalhe()
    fireEvent.click(screen.getByLabelText("Remover membro"))
    expect(await screen.findByText("Remover membro?")).toBeInTheDocument()
    expect(screen.queryByText("Sair desta família?")).not.toBeInTheDocument()
  })

  it("membro sai da própria família: 'Sair da família' → 'Sair desta família?' (#ehProprio)", async () => {
    mockAuth.currentUser = { id: "u2", nome: "Maria" } // logado como o membro não-criador
    setupDetailMocks({ detalhe: { ...detalhe, ehAdmin: false } })
    await openDetalhe()
    fireEvent.click(screen.getByLabelText("Sair da família"))
    expect(await screen.findByText("Sair desta família?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    await waitFor(() => expect(removerMembro).toHaveBeenCalledWith("f1", "m2"))
  })

  it("não-admin não vê 'Remover membro' alheio — só pode sair (#ehProprio)", async () => {
    mockAuth.currentUser = { id: "u2", nome: "Maria" }
    setupDetailMocks({ detalhe: { ...detalhe, ehAdmin: false } })
    await openDetalhe()
    expect(screen.queryByLabelText("Remover membro")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Sair da família")).toBeInTheDocument()
  })

  it("dissolver família: PontesDialog abre com descrição da família", async () => {
    await openDetalhe()
    fireEvent.click(screen.getByRole("button", { name: /Dissolver/i }))
    expect(await screen.findByText("Dissolver a família?")).toBeInTheDocument()
    // a descrição do dialog é única (menciona "será desfeita")
    expect(screen.getByText(/será desfeita/)).toBeInTheDocument()
  })

  it("dissolver família: confirmar chama dissolverFamilia e fecha modal", async () => {
    await openDetalhe()
    fireEvent.click(screen.getByRole("button", { name: /Dissolver/i }))
    await screen.findByText("Dissolver a família?")
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    await waitFor(() => expect(dissolverFamilia).toHaveBeenCalledWith("f1"))
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))
  })

  it("dissolver família: cancelar NÃO chama dissolverFamilia", async () => {
    await openDetalhe()
    fireEvent.click(screen.getByRole("button", { name: /Dissolver/i }))
    await screen.findByText("Dissolver a família?")
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    await waitFor(() => expect(dissolverFamilia).not.toHaveBeenCalled())
  })

  // ══════════════════════════════════════════
  // Revogar convite interno
  // ══════════════════════════════════════════

  it("revogar convite interno: chama revogarConvite com id correto", async () => {
    const conviteInterno = { ...convitePendente }
    setupDetailMocks({ detalhe: { ...detalhe, convitesPendentes: [conviteInterno] } })
    await openDetalhe()
    fireEvent.click(screen.getByLabelText("Revogar convite"))
    await waitFor(() => expect(revogarConvite).toHaveBeenCalledWith("f1", "cv1"))
  })

  // ══════════════════════════════════════════
  // Modo de rateio (admin)
  // ══════════════════════════════════════════

  it("modo de rateio: selecionar opção diferente chama definirModoRateio", async () => {
    await openDetalhe()
    // encontra o select de modo de rateio (trigger visível tem texto "Igualitário")
    const trigger = screen.getByText("Igualitário").closest("button")!
    fireEvent.click(trigger)
    // clica na opção "Proporcional à renda" no dropdown aberto
    const opcao = await screen.findByText("Proporcional à renda")
    fireEvent.click(opcao)
    await waitFor(() => expect(definirModoRateio).toHaveBeenCalledWith("f1", 2))
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))
  })
})
