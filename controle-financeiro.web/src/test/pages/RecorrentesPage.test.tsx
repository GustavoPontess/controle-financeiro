import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
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
const statsPadrao = { ativas: 1, custoMensalDespesas: 45.9, custoAnualDespesas: 550.8, proximas30Dias: 1, qtdTotal: 1 }
const listRecorrentesPage = vi.fn()
const getRecorrenteStats = vi.fn()
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
    proximaCobranca: "2026-06-10",
    situacao: "ativa",
    ...overrides,
  }
}

const pausada = () => makeRecorrente({ id: "rec-p", descricao: "Academia", ativo: false, situacao: "pausada" })
const cancelada = () => makeRecorrente({
  id: "rec-c", descricao: "Spotify", ativo: false, situacao: "cancelada",
  canceladoEm: "2026-09-01T00:00:00Z", motivoCancelamento: "Não uso mais",
})

function renderPage() {
  return render(
    <PontesThemeProvider>
      <RecorrentesPage />
    </PontesThemeProvider>,
  )
}

// Abre o ⋮ da linha i e devolve o menu.
async function abrirMenu(i = 0) {
  fireEvent.click((await screen.findAllByRole("button", { name: "Ações" }))[i])
  return screen.findByRole("menu")
}


beforeEach(() => {
  vi.clearAllMocks()
  getRecorrenteStats.mockResolvedValue(statsPadrao)
  listRecorrentesPage.mockResolvedValue(paged([makeRecorrente()]))
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RecorrentesPage", () => {
  // ── Padrão de tela ──

  it("cabeçalho: nome da tela + descrição e botão 'Nova conta fixa' no topo", async () => {
    renderPage()
    await screen.findAllByRole("button", { name: "Ações" })
    expect(screen.getByRole("heading", { level: 1, name: "Contas Fixas" })).toBeInTheDocument()
    expect(screen.getByText("Aluguel, escola, plano de saúde e outros pagamentos recorrentes")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Nova conta fixa" })).toBeInTheDocument()
  })

  // Bug 2026-09-28: o "por ano" era mensal × 12 no front e esquecia semanal/anual. Agora vem pronto do servidor.
  it("hero: custo mensal e 'por ano' vêm do servidor (todas as frequências), não mensal × 12", async () => {
    // conta anual de R$ 100: mês = 8,33; mensal × 12 daria 99,96 — o "por ano" tem que ser o 100 do servidor
    getRecorrenteStats.mockResolvedValue({ ...statsPadrao, custoMensalDespesas: 8.33, custoAnualDespesas: 100 })
    renderPage()
    expect(await screen.findByText(/R\$\s?8,33/)).toBeInTheDocument()
    expect(screen.getByText(/R\$\s?100,00 por ano/)).toBeInTheDocument()
    expect(screen.queryByText(/99,96/)).not.toBeInTheDocument()
  })

  it("carrega a lista filtrada NO SERVIDOR com a aba padrão 'Ativas' — numa chamada só", async () => {
    renderPage()
    await screen.findAllByRole("button", { name: "Ações" })
    expect(listRecorrentesPage).toHaveBeenCalledWith(1, 10, { status: "ativas", busca: "" })
    // O GET da lista gera as ocorrências vencidas no servidor: 2 chamadas paralelas podiam duplicar.
    expect(listRecorrentesPage).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("tab", { name: "Ativas" })).toHaveAttribute("aria-selected", "true")
  })

  // A "próxima cobrança" vem do servidor (a previsão pendente de verdade, DateOnly "YYYY-MM-DD") — antes a
  // tela mostrava o cursor interno da geração. E "amanhã" é amanhã: new Date("YYYY-MM-DD") é meia-noite UTC
  // (= hoje às 21h no Brasil) e o rótulo saía com 1 dia a menos.
  it("próxima cobrança: lê a data do servidor sem deslocar o dia (amanhã = 'amanhã')", async () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    const amanha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    listRecorrentesPage.mockResolvedValue(paged([makeRecorrente({ proximaCobranca: amanha })]))
    renderPage()
    expect(await screen.findByText(/próxima cobrança amanhã/)).toBeInTheDocument()
  })

  it("pausada (sem próxima cobrança do servidor) não anuncia cobrança", async () => {
    listRecorrentesPage.mockResolvedValue(paged([makeRecorrente({ ativo: false, situacao: "pausada", proximaCobranca: null })]))
    renderPage()
    await screen.findAllByRole("button", { name: "Ações" })
    expect(screen.queryByText(/próxima cobrança/)).not.toBeInTheDocument()
    expect(screen.queryByText("Próximas cobranças")).not.toBeInTheDocument()
  })

  it("'Próximas cobranças' não muda com a busca (usa a última lista sem filtro)", async () => {
    const futura = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) // DateOnly da API
    listRecorrentesPage.mockResolvedValue(paged([makeRecorrente({ proximaCobranca: futura })]))
    renderPage()
    expect(await screen.findByText("Próximas cobranças")).toBeInTheDocument()

    listRecorrentesPage.mockResolvedValue(paged([]))
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar conta fixa" }), { target: { value: "xyz" } })
    expect(await screen.findByText("Nada encontrado")).toBeInTheDocument()
    expect(screen.getByText("Próximas cobranças")).toBeInTheDocument()
  })

  // Com busca ligada o recarregar() só traz a lista filtrada: a faixa (última lista SEM filtro) não
  // pode continuar anunciando como próxima cobrança o que acabou de ser pausado/cancelado.
  describe("ação com busca ligada atualiza 'Próximas cobranças'", () => {
    const futura = () => new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) // DateOnly da API
    const netflix = () => makeRecorrente({ proximaCobranca: futura() })
    const spotify = () => makeRecorrente({ id: "rec-s", descricao: "Spotify", proximaCobranca: futura() })

    // Carrega sem filtro (Netflix + Spotify na faixa e na lista) e busca "net" (lista só com Netflix).
    async function buscarNet() {
      listRecorrentesPage.mockResolvedValue(paged([netflix(), spotify()]))
      renderPage()
      expect(await screen.findByText("Próximas cobranças")).toBeInTheDocument()
      await waitFor(() => expect(screen.getAllByText("Spotify")).toHaveLength(2)) // faixa + lista

      listRecorrentesPage.mockResolvedValue(paged([netflix()]))
      fireEvent.change(screen.getByRole("searchbox", { name: "Buscar conta fixa" }), { target: { value: "net" } })
      // Spotify saiu da lista filtrada e segue só na faixa.
      await waitFor(() => expect(screen.getAllByText("Spotify")).toHaveLength(1))
      return listRecorrentesPage.mock.calls.length
    }

    it("cancelar tira da faixa, sem 2º GET sem filtro", async () => {
      cancelarRecorrente.mockResolvedValue({})
      const antes = await buscarNet()

      listRecorrentesPage.mockResolvedValue(paged([])) // cancelada sai da aba Ativas
      fireEvent.click(within(await abrirMenu()).getByRole("menuitem", { name: "Cancelar conta fixa" }))
      fireEvent.change(await screen.findByPlaceholderText("Ex: Não uso mais, preço alto..."), {
        target: { value: "Preço alto" },
      })
      fireEvent.click(screen.getByText("Confirmar cancelamento"))

      await waitFor(() => expect(cancelarRecorrente).toHaveBeenCalledWith("rec-001", { motivo: "Preço alto" }))
      await waitFor(() => expect(screen.queryByText("Netflix")).not.toBeInTheDocument())
      expect(screen.getByText("Próximas cobranças")).toBeInTheDocument()
      expect(screen.getByText("Spotify")).toBeInTheDocument()
      // Toda recarga seguiu filtrada (o GET da lista gera cobranças no servidor — nada de paralelo).
      for (const [, , filtros] of listRecorrentesPage.mock.calls.slice(antes)) {
        expect(filtros).toEqual({ status: "ativas", busca: "net" })
      }
    })

    it("pausar tira da faixa (e a linha fica como 'Pausada')", async () => {
      toggleRecorrente.mockResolvedValue(undefined)
      await buscarNet()

      listRecorrentesPage.mockResolvedValue(paged([makeRecorrente({ ativo: false, situacao: "pausada", proximaCobranca: futura() })]))
      fireEvent.click(within(await abrirMenu()).getByRole("menuitem", { name: "Pausar" }))

      expect(await screen.findByText("Pausada")).toBeInTheDocument()
      expect(screen.getAllByText("Netflix")).toHaveLength(1) // só a linha; saiu da faixa
      expect(screen.getByText("Spotify")).toBeInTheDocument()
    })
  })

  it("recarga depois de uma ação não troca a lista pelo esqueleto — o foco volta pro ⋮", async () => {
    toggleRecorrente.mockResolvedValue(undefined)
    renderPage()
    await abrirMenu()
    const antes = listRecorrentesPage.mock.calls.length
    listRecorrentesPage.mockResolvedValue(paged([pausada()].map((p) => ({ ...p, id: "rec-001" }))))

    fireEvent.click(screen.getByRole("menuitem", { name: "Pausar" }))

    expect(await screen.findByText("Pausada")).toBeInTheDocument()
    expect(listRecorrentesPage.mock.calls.length).toBeGreaterThan(antes)
    expect(screen.getByRole("button", { name: "Ações" })).toHaveFocus()
  })

  it("trocar pra 'Encerradas' refaz a consulta com status=encerradas", async () => {
    renderPage()
    await screen.findAllByRole("button", { name: "Ações" })
    fireEvent.click(screen.getByRole("tab", { name: "Encerradas" }))
    await waitFor(() => {
      expect(listRecorrentesPage).toHaveBeenCalledWith(1, 10, { status: "encerradas", busca: "" })
    })
  })

  it("busca vai pro servidor (com debounce), não filtra só a página carregada", async () => {
    renderPage()
    await screen.findAllByRole("button", { name: "Ações" })
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar conta fixa" }), { target: { value: "net" } })
    await waitFor(() => {
      expect(listRecorrentesPage).toHaveBeenCalledWith(1, 10, { status: "ativas", busca: "net" })
    })
  })

  it("mostra esqueleto (não o vazio) enquanto carrega", async () => {
    listRecorrentesPage.mockReturnValue(new Promise(() => { /* nunca resolve */ }))
    renderPage()
    await waitFor(() => expect(listRecorrentesPage).toHaveBeenCalled())
    expect(screen.queryByText("Nenhuma conta fixa")).not.toBeInTheDocument()
    expect(screen.queryByText("Nada encontrado")).not.toBeInTheDocument()
  })

  // ── Vazios ──

  it("sem nenhuma conta fixa: empty state com o botão de criar dentro", async () => {
    getRecorrenteStats.mockResolvedValue({ ...statsPadrao, ativas: 0, qtdTotal: 0 })
    listRecorrentesPage.mockResolvedValue(paged([]))
    renderPage()
    expect(await screen.findByText("Nenhuma conta fixa")).toBeInTheDocument()
    // Topo + dentro do vazio.
    const botoes = screen.getAllByRole("button", { name: "Nova conta fixa" })
    expect(botoes).toHaveLength(2)
    fireEvent.click(botoes[1])
    expect(await screen.findByPlaceholderText("Ex: Aluguel, Escola, Netflix...")).toBeInTheDocument()
  })

  it("filtro sem resultado: 'Nada encontrado' + 'Limpar filtros' volta pra Ativas sem busca", async () => {
    renderPage()
    await screen.findAllByRole("button", { name: "Ações" })
    listRecorrentesPage.mockResolvedValue(paged([]))
    fireEvent.click(screen.getByRole("tab", { name: "Encerradas" }))
    expect(await screen.findByText("Nada encontrado")).toBeInTheDocument()

    listRecorrentesPage.mockClear()
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }))
    await waitFor(() => {
      expect(listRecorrentesPage).toHaveBeenCalledWith(1, 10, { status: "ativas", busca: "" })
    })
    expect(screen.getByRole("tab", { name: "Ativas" })).toHaveAttribute("aria-selected", "true")
  })

  it("tem contas fixas mas nenhuma ativa: vazio próprio com o botão de criar", async () => {
    listRecorrentesPage.mockResolvedValue(paged([]))
    renderPage()
    expect(await screen.findByText("Nenhuma conta fixa ativa")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Nova conta fixa" })).toHaveLength(2)
  })

  // ── Listagem ──

  it("exibe recorrente carregado + hero", async () => {
    renderPage()
    expect((await screen.findAllByText("Netflix")).length).toBeGreaterThan(0)
    expect(screen.getAllByText("Mensal").length).toBeGreaterThan(0)
    expect(screen.getByText("Nubank")).toBeInTheDocument()
    expect(screen.getByText("Custo mensal em contas fixas")).toBeInTheDocument()
    expect(screen.getByText("ativas")).toBeInTheDocument()
  })

  it("ações da ativa ficam TODAS no ⋮ (nada solto), Excluir por último", async () => {
    renderPage()
    const menu = await abrirMenu()
    const itens = within(menu).getAllByRole("menuitem").map((i) => i.textContent)
    expect(itens).toEqual(["Editar próxima ocorrência", "Pausar", "Cancelar conta fixa", "Excluir"])
    // Os 4 ícones soltos antigos sumiram.
    expect(screen.queryByTitle("Excluir")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Cancelar conta fixa")).not.toBeInTheDocument()
  })

  // ── Pausada × Cancelada (bug: cancelada aparecia como "Pausada" e oferecia "Ativar") ──

  it("pausada: badge 'Pausada' e ação 'Retomar' (sem 'Pausar')", async () => {
    listRecorrentesPage.mockResolvedValue(paged([pausada()]))
    toggleRecorrente.mockResolvedValue(undefined)
    renderPage()
    expect(await screen.findByText("Pausada")).toBeInTheDocument()
    const menu = await abrirMenu()
    expect(within(menu).queryByRole("menuitem", { name: "Pausar" })).not.toBeInTheDocument()
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Retomar" }))
    await waitFor(() => expect(toggleRecorrente).toHaveBeenCalledWith("rec-p"))
  })

  it("cancelada: badge 'Cancelada' (não 'Pausada'), motivo, e SEM retomar/ativar — só Excluir", async () => {
    listRecorrentesPage.mockResolvedValue(paged([cancelada()]))
    renderPage()
    expect(await screen.findByText("Cancelada")).toBeInTheDocument()
    expect(screen.queryByText("Pausada")).not.toBeInTheDocument()
    expect(screen.getByText("Motivo: Não uso mais")).toBeInTheDocument()

    const menu = await abrirMenu()
    const itens = within(menu).getAllByRole("menuitem").map((i) => i.textContent)
    expect(itens).toEqual(["Excluir"])
    expect(screen.queryByText(/Ativar|Retomar/)).not.toBeInTheDocument()
  })

  it("encerrada (data fim passou): badge 'Encerrada' e só Excluir", async () => {
    listRecorrentesPage.mockResolvedValue(paged([makeRecorrente({ situacao: "encerrada", dataFim: "2026-08-01T00:00:00Z" })]))
    renderPage()
    expect(await screen.findByText("Encerrada")).toBeInTheDocument()
    const menu = await abrirMenu()
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Excluir"])
  })

  it("não-ativa aparece com data-inactive", async () => {
    listRecorrentesPage.mockResolvedValue(paged([pausada()]))
    renderPage()
    await screen.findByText("Pausada")
    expect(document.querySelector("[data-inactive='true']")).toBeInTheDocument()
  })

  // ── Criar modal ──

  it("abre modal criar pelo botão do topo", async () => {
    renderPage()
    await screen.findAllByRole("button", { name: "Ações" })
    fireEvent.click(screen.getByRole("button", { name: "Nova conta fixa" }))
    expect(await screen.findByPlaceholderText("Ex: Aluguel, Escola, Netflix...")).toBeInTheDocument()
  })

  it("bloqueia submit com campos vazios e mostra erros", async () => {
    createRecorrente.mockResolvedValue(makeRecorrente())
    renderPage()
    await screen.findAllByRole("button", { name: "Ações" })
    fireEvent.click(screen.getByRole("button", { name: "Nova conta fixa" }))
    fireEvent.click(await screen.findByText("Criar conta fixa"))
    expect(await screen.findByText("Descrição obrigatória.")).toBeInTheDocument()
    expect(createRecorrente).not.toHaveBeenCalled()
  })

  // Bug de dinheiro (2026-09-28): o campo era texto livre e "1.500" (mil e quinhentos) virava R$ 1,50 em
  // silêncio. Agora é a máscara do app: o campo MOSTRA o que vai ser salvo.
  it("criar: '1.500' não vira mais R$ 1,50 escondido — o campo mostra o valor que vai ser salvo", async () => {
    createRecorrente.mockResolvedValue(makeRecorrente())
    renderPage()
    await screen.findAllByRole("button", { name: "Ações" })
    fireEvent.click(screen.getByRole("button", { name: "Nova conta fixa" }))
    await screen.findByText("Criar conta fixa")
    const campo = screen.getByPlaceholderText("0,00")

    fireEvent.change(campo, { target: { value: "1.500" } })
    expect(campo).toHaveValue("15,00") // ponto não é mais lido como decimal: o que aparece é o que vale

    fireEvent.change(campo, { target: { value: "150000" } })
    expect(campo).toHaveValue("1.500,00")
    fireEvent.change(screen.getByPlaceholderText("Ex: Aluguel, Escola, Netflix..."), { target: { value: "Aluguel" } })
    fireEvent.click(screen.getByText("Selecione uma conta"))
    const opcoes = await screen.findAllByText("Nubank") // a lista atrás também mostra "Nubank": a opção é a última
    fireEvent.click(opcoes[opcoes.length - 1])
    fireEvent.click(screen.getByText("Criar conta fixa"))
    await waitFor(() => expect(createRecorrente).toHaveBeenCalledTimes(1))
    expect(createRecorrente.mock.calls[0][0]).toEqual(expect.objectContaining({ valor: 1500 }))
  })

  it("sem conta selecionada, bloqueia e pede a conta", async () => {
    createRecorrente.mockResolvedValue(makeRecorrente())
    renderPage()
    await screen.findAllByRole("button", { name: "Ações" })

    fireEvent.click(screen.getByRole("button", { name: "Nova conta fixa" }))
    await screen.findByText("Criar conta fixa")

    fireEvent.change(screen.getByPlaceholderText("Ex: Aluguel, Escola, Netflix..."), {
      target: { value: "Netflix" },
    })
    fireEvent.change(screen.getByPlaceholderText("0,00"), {
      target: { value: "45.90" },
    })
    // Data início vem preenchida (hoje); conta não.
    fireEvent.click(screen.getByText("Criar conta fixa"))

    expect(await screen.findByText("Selecione uma conta.")).toBeInTheDocument()
    expect(createRecorrente).not.toHaveBeenCalled()
  })

  // ── Cancelar modal (via ⋮) ──

  it("abre modal cancelar com campo motivo", async () => {
    renderPage()
    fireEvent.click(within(await abrirMenu()).getByRole("menuitem", { name: "Cancelar conta fixa" }))
    expect(await screen.findByText("Motivo do cancelamento")).toBeInTheDocument()
  })

  it("bloqueia cancelamento sem motivo", async () => {
    cancelarRecorrente.mockResolvedValue({})
    renderPage()
    fireEvent.click(within(await abrirMenu()).getByRole("menuitem", { name: "Cancelar conta fixa" }))
    fireEvent.click(await screen.findByText("Confirmar cancelamento"))
    expect(await screen.findByText("Motivo é obrigatório.")).toBeInTheDocument()
    expect(cancelarRecorrente).not.toHaveBeenCalled()
  })

  it("chama cancelarRecorrente com motivo preenchido", async () => {
    cancelarRecorrente.mockResolvedValue({})
    renderPage()
    fireEvent.click(within(await abrirMenu()).getByRole("menuitem", { name: "Cancelar conta fixa" }))
    await screen.findByText("Confirmar cancelamento")

    fireEvent.change(screen.getByPlaceholderText("Ex: Não uso mais, preço alto..."), {
      target: { value: "Preço alto" },
    })
    fireEvent.click(screen.getByText("Confirmar cancelamento"))

    await waitFor(() => {
      expect(cancelarRecorrente).toHaveBeenCalledWith("rec-001", { motivo: "Preço alto" })
    })
  })

  // ── Editar próxima (via ⋮) ──

  it("abre modal editar próxima", async () => {
    renderPage()
    fireEvent.click(within(await abrirMenu()).getByRole("menuitem", { name: "Editar próxima ocorrência" }))
    expect(await screen.findByText("Novo valor (opcional)")).toBeInTheDocument()
    expect(screen.getByText("Nova descrição (opcional)")).toBeInTheDocument()
  })

  it("chama editarProximaOcorrencia ao salvar", async () => {
    editarProximaOcorrencia.mockResolvedValue(undefined)
    renderPage()
    fireEvent.click(within(await abrirMenu()).getByRole("menuitem", { name: "Editar próxima ocorrência" }))
    await screen.findByText("Novo valor (opcional)")

    // Os dois campos são opcionais.
    fireEvent.click(screen.getByText("Salvar"))

    await waitFor(() => {
      expect(editarProximaOcorrencia).toHaveBeenCalledWith("rec-001", {})
    })
  })

  it("edição de próxima: negativo nem dá pra digitar (máscara só aceita dígitos) e zero é bloqueado", async () => {
    editarProximaOcorrencia.mockResolvedValue(undefined)
    renderPage()
    fireEvent.click(within(await abrirMenu()).getByRole("menuitem", { name: "Editar próxima ocorrência" }))
    await screen.findByText("Novo valor (opcional)")
    const campo = screen.getByPlaceholderText("R$ 45,90")

    fireEvent.change(campo, { target: { value: "-5" } })
    expect(campo).toHaveValue("0,05") // o "-" some

    fireEvent.change(campo, { target: { value: "" } }) // apaga…
    fireEvent.change(campo, { target: { value: "0" } }) // …e digita zero de propósito
    expect(campo).toHaveValue("0,00")
    fireEvent.click(screen.getByText("Salvar"))
    expect(await screen.findByText("Valor deve ser positivo.")).toBeInTheDocument()
    expect(editarProximaOcorrencia).not.toHaveBeenCalled()
  })

  it("edição de próxima: o valor salvo é o que o campo mostra (150000 → 1.500,00 → 1500)", async () => {
    editarProximaOcorrencia.mockResolvedValue(undefined)
    renderPage()
    fireEvent.click(within(await abrirMenu()).getByRole("menuitem", { name: "Editar próxima ocorrência" }))
    await screen.findByText("Novo valor (opcional)")
    const campo = screen.getByPlaceholderText("R$ 45,90")
    fireEvent.change(campo, { target: { value: "150000" } })
    expect(campo).toHaveValue("1.500,00")
    fireEvent.click(screen.getByText("Salvar"))
    await waitFor(() => expect(editarProximaOcorrencia).toHaveBeenCalledWith("rec-001", { valor: 1500 }))
  })

  // ── Pausar (via ⋮) ──

  it("chama toggleRecorrente ao clicar Pausar", async () => {
    toggleRecorrente.mockResolvedValue(undefined)
    renderPage()
    fireEvent.click(within(await abrirMenu()).getByRole("menuitem", { name: "Pausar" }))
    await waitFor(() => {
      expect(toggleRecorrente).toHaveBeenCalledWith("rec-001")
    })
  })

  // ── Excluir (via ⋮ + confirmação) ──

  it("Excluir pede confirmação antes de apagar", async () => {
    renderPage()
    fireEvent.click(within(await abrirMenu()).getByRole("menuitem", { name: "Excluir" }))
    expect(await screen.findByText("Excluir conta fixa?")).toBeInTheDocument()
    expect(screen.getByText(/Excluir "Netflix"/)).toBeInTheDocument()
    expect(deleteRecorrente).not.toHaveBeenCalled()
  })

  it("chama deleteRecorrente ao confirmar exclusão e recarrega a lista", async () => {
    deleteRecorrente.mockResolvedValue(undefined)
    renderPage()
    fireEvent.click(within(await abrirMenu()).getByRole("menuitem", { name: "Excluir" }))
    await screen.findByText("Excluir conta fixa?")
    const antes = listRecorrentesPage.mock.calls.length
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }))

    await waitFor(() => {
      expect(deleteRecorrente).toHaveBeenCalledWith("rec-001")
    })
    await waitFor(() => expect(listRecorrentesPage.mock.calls.length).toBeGreaterThan(antes))
  })
})
