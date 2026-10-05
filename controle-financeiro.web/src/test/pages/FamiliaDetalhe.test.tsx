import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import { FamiliaDetalhe } from "../../pages/Familia/FamiliaDetalhe"
import type {
  FamiliaDetalhe as FamiliaDetalheType, DespesaCompartilhada, BalancoFamilia, Dependente, AcertoContas,
} from "../../types/Familia"

// ── Router mock ── (componente usa só useOutletContext)
const mockNotify = vi.fn()
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useOutletContext: () => ({ notify: mockNotify }),
}))

// ── Auth mock ──
const { mockAuth } = vi.hoisted(() => ({
  mockAuth: { currentUser: { id: "u1", nome: "Dev Test" } as { id: string; nome: string } | null },
}))
vi.mock("../../hooks/useAuth", () => ({ useAuth: () => mockAuth }))

// ── Service mocks ──
const getFamilia       = vi.fn()
const dissolverFamilia = vi.fn()
const convidarMembro   = vi.fn()
const revogarConvite   = vi.fn()
const removerMembro    = vi.fn()
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
const atribuirResponsavel = vi.fn()

vi.mock("../../services/familiaService", () => ({
  getFamilia:         (...a: unknown[]) => getFamilia(...a),
  dissolverFamilia:   (...a: unknown[]) => dissolverFamilia(...a),
  convidarMembro:     (...a: unknown[]) => convidarMembro(...a),
  revogarConvite:     (...a: unknown[]) => revogarConvite(...a),
  removerMembro:      (...a: unknown[]) => removerMembro(...a),
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
  atribuirResponsavel: (...a: unknown[]) => atribuirResponsavel(...a),
}))

// ── Fixtures ──
const membroAdmin = {
  id: "m1", usuarioId: "u1", nomeUsuario: "Dev Test", emailUsuario: "dev@test.com",
  papel: "Administrador", entrouEm: "2026-01-01T00:00:00", rendaMensal: 4000, rendaInformada: true,
}
const membroOutro = {
  id: "m2", usuarioId: "u2", nomeUsuario: "Maria", emailUsuario: "maria@test.com",
  // a API não manda a renda dos OUTROS (dado pessoal) — só que ela foi informada
  papel: "Esposa", entrouEm: "2026-01-15T00:00:00", rendaMensal: null, rendaInformada: true,
}
const detalhe: FamiliaDetalheType = {
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
  responsavelUsuarioId: null, responsavelNome: null,
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
const convitePendente = {
  id: "cv1", familiaId: "f1", nomeFamilia: "Família Silva",
  emailConvidado: "pedro@test.com", papel: "Filho", status: 1 as const,
  expiraEm: "2026-06-01T00:00:00", criadoEm: "2026-05-01T00:00:00", token: "tok-abc",
}

const mockClose = vi.fn()

function setupMocks(overrides: Partial<{
  detalhe: FamiliaDetalheType
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

async function renderDetalhe(props: { showBack?: boolean } = {}) {
  render(
    <PontesThemeProvider>
      <FamiliaDetalhe familiaId="f1" onClose={mockClose} showBack={props.showBack} />
    </PontesThemeProvider>
  )
  await screen.findByText("Dev Test")
}

function goTab(label: string) {
  fireEvent.click(screen.getByRole("button", { name: label }))
}

describe("FamiliaDetalhe — componente (#85)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNotify.mockReset()
    mockClose.mockReset()
    mockAuth.currentUser = { id: "u1", nome: "Dev Test" }
    dissolverFamilia.mockResolvedValue(undefined)
    convidarMembro.mockResolvedValue(undefined)
    revogarConvite.mockResolvedValue(undefined)
    removerMembro.mockResolvedValue(undefined)
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
    atribuirResponsavel.mockResolvedValue(undefined)
    setupMocks()
  })

  // ── Carregamento / cabeçalho ──

  it("carrega o detalhe com membros e papéis", async () => {
    await renderDetalhe()
    expect(screen.getByText("Dev Test")).toBeInTheDocument()
    expect(screen.getByText("Maria")).toBeInTheDocument()
    expect(screen.getByText("Esposa")).toBeInTheDocument()
  })

  it("renda: o valor aparece só na PRÓPRIA linha; na dos outros, só 'renda informada'", async () => {
    await renderDetalhe()
    expect(screen.getByText(/maria@test\.com/)).toBeInTheDocument()
    expect(screen.getByText(/dev@test\.com.*renda R\$\s?4\.000,00/)).toBeInTheDocument() // a minha
    expect(screen.getByText(/maria@test\.com.*renda informada/)).toBeInTheDocument()     // a dela: sem valor
    expect(screen.queryByText(/maria@test\.com.*R\$/)).not.toBeInTheDocument()
  })

  it("erro ao carregar chama onClose", async () => {
    getFamilia.mockRejectedValue(new Error("network"))
    render(
      <PontesThemeProvider>
        <FamiliaDetalhe familiaId="f1" onClose={mockClose} />
      </PontesThemeProvider>
    )
    await waitFor(() => expect(mockClose).toHaveBeenCalled())
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ severity: "error" }))
  })

  it("showBack: botão Voltar chama onClose", async () => {
    await renderDetalhe({ showBack: true })
    fireEvent.click(screen.getByLabelText("Voltar"))
    expect(mockClose).toHaveBeenCalled()
  })

  it("sem showBack: não renderiza botão Voltar", async () => {
    await renderDetalhe()
    expect(screen.queryByLabelText("Voltar")).not.toBeInTheDocument()
  })

  it("admin vê botão Convidar e botão Dissolver", async () => {
    await renderDetalhe()
    expect(screen.getByRole("button", { name: /Convidar/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Dissolver/i })).toBeInTheDocument()
  })

  it("não-admin não vê botão Convidar nem Dissolver", async () => {
    setupMocks({ detalhe: { ...detalhe, ehAdmin: false } })
    await renderDetalhe()
    expect(screen.queryByRole("button", { name: /Convidar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Dissolver/i })).not.toBeInTheDocument()
  })

  // ── Resumo (balanço + rateio) ──

  it("exibe balanço do mês com total", async () => {
    await renderDetalhe()
    expect(screen.getByText(/R\$\s?700,00/)).toBeInTheDocument()
  })

  it("admin: modo de rateio exibe select", async () => {
    await renderDetalhe()
    expect(screen.getByText("Igualitário")).toBeInTheDocument()
  })

  it("não-admin: modo de rateio exibe texto estático", async () => {
    setupMocks({ detalhe: { ...detalhe, ehAdmin: false, modoRateioPadrao: 2 } })
    await renderDetalhe()
    expect(screen.getByText("Proporcional à renda")).toBeInTheDocument()
  })

  it("modo de rateio: selecionar opção diferente chama definirModoRateio", async () => {
    await renderDetalhe()
    const trigger = screen.getByText("Igualitário").closest("button")!
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByText("Proporcional à renda"))
    await waitFor(() => expect(definirModoRateio).toHaveBeenCalledWith("f1", 2))
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))
  })

  // ── Aba Despesas (default) ──

  it("exibe despesas compartilhadas do mês", async () => {
    await renderDetalhe()
    expect(screen.getByText(/Supermercado/)).toBeInTheDocument()
    expect(screen.getByText(/R\$\s?350,50/)).toBeInTheDocument()
  })

  it("empty: nenhuma despesa mostra mensagem vazia", async () => {
    setupMocks({ despesas: [] })
    await renderDetalhe()
    expect(screen.getByText("Nenhuma despesa compartilhada neste mês.")).toBeInTheDocument()
  })

  it("filtro de responsável renderiza com 'Todos' (2.1)", async () => {
    await renderDetalhe()
    expect(screen.getByText("Todos")).toBeInTheDocument()
  })

  it("despesa com responsável mostra o nome no badge (2.1)", async () => {
    setupMocks({ despesas: [{ ...despesa, responsavelUsuarioId: "u2", responsavelNome: "Maria Resp" }] })
    await renderDetalhe()
    expect(screen.getByText("Maria Resp")).toBeInTheDocument()
  })

  it("despesa sem responsável: picker mostra 'Sem responsável' (2.1)", async () => {
    await renderDetalhe()
    expect(screen.getByText("Sem responsável")).toBeInTheDocument()
  })

  it("despesa pendente: aprovar chama aprovarDespesa (não-pagador) (2.4)", async () => {
    setupMocks({ despesas: [{ ...despesa, id: "dp2", pagadorUsuarioId: "u2", pagadorNome: "Maria", statusAprovacao: 1 }] })
    await renderDetalhe()
    expect(screen.getByText("Pendente")).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("Aprovar despesa"))
    await waitFor(() => expect(aprovarDespesa).toHaveBeenCalledWith("f1", "dp2"))
  })

  it("despesa pendente: rejeitar chama rejeitarDespesa (2.4)", async () => {
    setupMocks({ despesas: [{ ...despesa, id: "dp2", pagadorUsuarioId: "u2", statusAprovacao: 1 }] })
    await renderDetalhe()
    fireEvent.click(screen.getByLabelText("Rejeitar despesa"))
    await waitFor(() => expect(rejeitarDespesa).toHaveBeenCalledWith("f1", "dp2"))
  })

  it("despesa pendente: o próprio pagador não vê aprovar/rejeitar (2.4)", async () => {
    setupMocks({ despesas: [{ ...despesa, id: "dp3", pagadorUsuarioId: "u1", statusAprovacao: 1 }] })
    await renderDetalhe()
    expect(screen.getByText("Pendente")).toBeInTheDocument()
    expect(screen.queryByLabelText("Aprovar despesa")).not.toBeInTheDocument()
  })

  it("admin define limite de aprovação (2.4)", async () => {
    await renderDetalhe()
    fireEvent.click(screen.getByRole("button", { name: /Aprovação: desligada/i }))
    const input = await screen.findByPlaceholderText(/Ex\.: 200/)
    fireEvent.change(input, { target: { value: "300" } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(definirLimiteAprovacao).toHaveBeenCalledWith("f1", 300))
  })

  // ── Aba Dependentes ──

  it("exibe dependente com nome e tipo", async () => {
    await renderDetalhe()
    goTab("Dependentes")
    expect(screen.getByText("Júlia")).toBeInTheDocument()
    expect(screen.getByText("Criança")).toBeInTheDocument()
  })

  it("empty: nenhum dependente mostra mensagem vazia", async () => {
    setupMocks({ dependentes: [] })
    await renderDetalhe()
    goTab("Dependentes")
    expect(screen.getByText("Nenhum dependente cadastrado.")).toBeInTheDocument()
  })

  it("criar dependente: chama criarDependente com dados corretos", async () => {
    await renderDetalhe()
    goTab("Dependentes")
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/i }))
    fireEvent.change(await screen.findByPlaceholderText("Ex: Lúcia"), { target: { value: "Pedro" } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(criarDependente).toHaveBeenCalledWith(
      "f1", expect.objectContaining({ nome: "Pedro" }),
    ))
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ severity: "success" }))
  })

  it("inativar dependente: confirmar chama inativarDependente", async () => {
    await renderDetalhe()
    goTab("Dependentes")
    fireEvent.click(screen.getByLabelText("Inativar"))
    expect(await screen.findByText("Inativar dependente?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    await waitFor(() => expect(inativarDependente).toHaveBeenCalledWith("f1", "d1"))
  })

  // ── Aba Acerto de contas ──

  it("exibe acerto de contas com valor", async () => {
    await renderDetalhe()
    goTab("Acerto de contas")
    expect(screen.getByText(/Pix/)).toBeInTheDocument()
    expect(screen.getAllByText(/R\$\s?150,00/).length).toBeGreaterThan(0)
  })

  it("empty: nenhum acerto mostra mensagem vazia", async () => {
    setupMocks({ acertos: [] })
    await renderDetalhe()
    goTab("Acerto de contas")
    expect(screen.getByText("Nenhum acerto registrado neste mês.")).toBeInTheDocument()
  })

  it("acerto: sem pagador/recebedor selecionado notifica error e não chama service", async () => {
    await renderDetalhe()
    goTab("Acerto de contas")
    fireEvent.click(screen.getByRole("button", { name: /Registrar acerto/i }))
    await screen.findByText(/Registra que um membro pagou a outro/)
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }))
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "error", message: "Selecione quem pagou e quem recebeu" })
    ))
    expect(registrarAcerto).not.toHaveBeenCalled()
  })

  it("cancelar acerto: confirmar chama cancelarAcerto", async () => {
    await renderDetalhe()
    goTab("Acerto de contas")
    fireEvent.click(screen.getByLabelText("Cancelar acerto"))
    expect(await screen.findByText("Cancelar acerto?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    await waitFor(() => expect(cancelarAcerto).toHaveBeenCalledWith("f1", "a1"))
  })

  // ── Convidar / convites internos ──

  it("enviar convite: chama convidarMembro com email e papel corretos", async () => {
    await renderDetalhe()
    fireEvent.click(screen.getByRole("button", { name: /Convidar/i }))
    fireEvent.change(await screen.findByPlaceholderText("joao@email.com"), { target: { value: "pedro@test.com" } })
    fireEvent.change(screen.getByPlaceholderText("Ex: Esposa, Filho, Sócio"), { target: { value: "Irmão" } })
    fireEvent.click(screen.getByRole("button", { name: "Enviar convite" }))
    await waitFor(() => expect(convidarMembro).toHaveBeenCalledWith("f1", "pedro@test.com", "Irmão"))
  })

  it("validação convite: e-mail e papel vazios exibem erros inline", async () => {
    await renderDetalhe()
    fireEvent.click(screen.getByRole("button", { name: /Convidar/i }))
    await screen.findByPlaceholderText("joao@email.com")
    fireEvent.click(screen.getByRole("button", { name: "Enviar convite" }))
    expect(screen.getByText("Informe o e-mail")).toBeInTheDocument()
    expect(screen.getByText("Informe o papel")).toBeInTheDocument()
    expect(convidarMembro).not.toHaveBeenCalled()
  })

  it("revogar convite interno: chama revogarConvite com id correto", async () => {
    setupMocks({ detalhe: { ...detalhe, convitesPendentes: [convitePendente] } })
    await renderDetalhe()
    expect(screen.getByText(/pedro@test\.com/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("Revogar convite"))
    await waitFor(() => expect(revogarConvite).toHaveBeenCalledWith("f1", "cv1"))
  })

  // ── Renda ──

  it("salvar renda: chama definirRendaMembro com valor numérico correto", async () => {
    await renderDetalhe()
    fireEvent.click(screen.getAllByLabelText("Definir renda")[0])
    await screen.findByText(/Renda mensal — Dev Test/)
    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "5000" } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(definirRendaMembro).toHaveBeenCalledWith("f1", "m1", 5000))
  })

  it("renda inválida exibe erro inline sem chamar o service", async () => {
    await renderDetalhe()
    fireEvent.click(screen.getAllByLabelText("Definir renda")[0])
    await screen.findByText(/Renda mensal — Dev Test/)
    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "-100" } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(screen.getByText("Renda inválida")).toBeInTheDocument()
    expect(definirRendaMembro).not.toHaveBeenCalled()
  })

  // ── Remover membro / sair / dissolver ──

  it("remover membro: confirmar chama removerMembro", async () => {
    await renderDetalhe()
    fireEvent.click(screen.getByLabelText("Remover membro"))
    expect(await screen.findByText("Remover membro?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    await waitFor(() => expect(removerMembro).toHaveBeenCalledWith("f1", "m2"))
  })

  it("membro sai da própria família: 'Sair desta família?' e chama onClose", async () => {
    mockAuth.currentUser = { id: "u2", nome: "Maria" }
    setupMocks({ detalhe: { ...detalhe, ehAdmin: false } })
    await renderDetalhe()
    fireEvent.click(screen.getByLabelText("Sair da família"))
    expect(await screen.findByText("Sair desta família?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    await waitFor(() => expect(removerMembro).toHaveBeenCalledWith("f1", "m2"))
    expect(mockClose).toHaveBeenCalled()
  })

  it("não-admin não vê 'Remover membro' alheio — só pode sair", async () => {
    mockAuth.currentUser = { id: "u2", nome: "Maria" }
    setupMocks({ detalhe: { ...detalhe, ehAdmin: false } })
    await renderDetalhe()
    expect(screen.queryByLabelText("Remover membro")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Sair da família")).toBeInTheDocument()
  })

  it("dissolver família: confirmar chama dissolverFamilia e onClose", async () => {
    await renderDetalhe()
    fireEvent.click(screen.getByRole("button", { name: /Dissolver/i }))
    expect(await screen.findByText("Dissolver a família?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    await waitFor(() => expect(dissolverFamilia).toHaveBeenCalledWith("f1"))
    expect(mockClose).toHaveBeenCalled()
  })

  it("dissolver família: cancelar NÃO chama dissolverFamilia", async () => {
    await renderDetalhe()
    fireEvent.click(screen.getByRole("button", { name: /Dissolver/i }))
    await screen.findByText("Dissolver a família?")
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    await waitFor(() => expect(dissolverFamilia).not.toHaveBeenCalled())
  })
})
