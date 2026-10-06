import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react"
import { PontesThemeProvider } from "../../components/pontes"
import TransactionsPage from "../../pages/Transactions/TransactionsPage"

// Tela real = extrato de caixa via PontesTabela (ex-demo promovida). Cobre: linhas do extrato,
// escopo `apenasCaixa`, hero (saldo das contas + Entrou/Saiu de caixa), colunas ocultas por padrão,
// filtros avançados server-side (natureza/conta/meio/status), busca, criar (evento global) e excluir.
const {
  notify, listTransactionsPage, getTransactionStats, deleteTransaction, getContas, getCategories,
  getSubcategories, getCartoes,
  getFamilias, compartilharTransacao, getDependentes, atribuirDependente,
  getRateioTransacao, definirRateioTransacao, removerRateioTransacao,
} = vi.hoisted(() => ({
  notify: vi.fn(),
  listTransactionsPage: vi.fn(),
  getTransactionStats: vi.fn(),
  deleteTransaction: vi.fn(),
  getContas: vi.fn(),
  getCategories: vi.fn(),
  // Só usados pelo dialog de edição (montado sob demanda ao clicar em "Editar").
  getSubcategories: vi.fn(),
  getCartoes: vi.fn(),
  // Ações de família/rateio no ⋮ (só despesa real de conta).
  getFamilias: vi.fn(),
  compartilharTransacao: vi.fn(),
  getDependentes: vi.fn(),
  atribuirDependente: vi.fn(),
  getRateioTransacao: vi.fn(),
  definirRateioTransacao: vi.fn(),
  removerRateioTransacao: vi.fn(),
}))

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return { ...actual, useOutletContext: () => ({ notify }) }
})
vi.mock("../../services/transactionService", () => ({
  listTransactionsPage: (...a: unknown[]) => listTransactionsPage(...a),
  getTransactionStats: (...a: unknown[]) => getTransactionStats(...a),
  deleteTransaction: (...a: unknown[]) => deleteTransaction(...a),
  updateTransaction: vi.fn(),
}))
vi.mock("../../services/contaService", () => ({ getContas: (...a: unknown[]) => getContas(...a) }))
vi.mock("../../services/categoryService", () => ({ getCategories: (...a: unknown[]) => getCategories(...a) }))
vi.mock("../../services/subcategoryService", () => ({ getSubcategories: (...a: unknown[]) => getSubcategories(...a) }))
vi.mock("../../services/cartaoCreditoService", () => ({ getCartoes: (...a: unknown[]) => getCartoes(...a) }))
vi.mock("../../services/familiaService", () => ({
  getFamilias: (...a: unknown[]) => getFamilias(...a),
  compartilharTransacao: (...a: unknown[]) => compartilharTransacao(...a),
  getDependentes: (...a: unknown[]) => getDependentes(...a),
  atribuirDependente: (...a: unknown[]) => atribuirDependente(...a),
  getRateioTransacao: (...a: unknown[]) => getRateioTransacao(...a),
  definirRateioTransacao: (...a: unknown[]) => definirRateioTransacao(...a),
  removerRateioTransacao: (...a: unknown[]) => removerRateioTransacao(...a),
}))

// Envelope paginado (server-side) — o backend devolve isso, não um array cru.
const paged = <T,>(items: T[], total = items.length) => ({ items, total, page: 1, pageSize: 25, totalPages: 1 })

const salario = {
  id: "t1", descricao: "Salário", valor: 3000, tipo: 2, categoriaId: "cat-sal",
  contaId: "c1", contaNome: "Nubank", meioPagamento: 4, meioPagamentoDescricao: "Pix",
  statusTransacao: 1, data: "2026-05-20", hora: null, // sem hora
}
const mercado = {
  id: "t2", descricao: "Mercado", valor: 250, tipo: 1, categoriaId: "cat-mer",
  contaId: "c1", contaNome: "Nubank", meioPagamento: 2, meioPagamentoDescricao: "Débito",
  statusTransacao: 1, data: "2026-05-21", hora: "14:32:00", // com hora
}
const transferencia = {
  id: "t3", descricao: "Para Poupança", valor: 500, tipo: 1, categoriaId: null,
  contaId: "c1", contaNome: "Nubank", ehTransferencia: true, statusTransacao: 1, data: "2026-05-22", hora: null,
}
const pagtoFatura = {
  id: "t4", descricao: "Fatura Nubank", valor: 900, tipo: 1, categoriaId: null,
  contaId: "c1", contaNome: "Nubank", ehPagamentoFatura: true, statusTransacao: 1, data: "2026-05-23", hora: "09:05:00",
}
const previsto = {
  id: "t5", descricao: "Aluguel", valor: 1200, tipo: 1, categoriaId: null,
  contaId: "c2", contaNome: "Itaú", statusTransacao: 0, data: "2026-06-05", hora: null,
}

const contas = [
  { id: "c1", nome: "Nubank", tipo: 1, tipoDescricao: "Corrente", saldoAtual: 1000, isCarteira: false },
  { id: "c2", nome: "Itaú", tipo: 1, tipoDescricao: "Corrente", saldoAtual: 500.5, isCarteira: false },
]
// entradas/saidas (com crédito) ≠ entradasCaixa/saidasCaixa de propósito: o hero tem que usar o CAIXA.
const stats = { entradas: 9999, saidas: 8888, entradasCaixa: 4321, saidasCaixa: 1234.56, saldoPeriodo: 3086.44, qtdTransacoes: 5 }

function renderPage() {
  return render(
    <PontesThemeProvider>
      <TransactionsPage />
    </PontesThemeProvider>
  )
}

// Filtros avançados moram num popover: abre no botão "Filtros" e devolve o painel.
async function abrirFiltros() {
  fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }))
  return screen.findByRole("dialog", { name: "Filtros" })
}
// Escolhe uma opção num PontesSelect do painel (o menu é portalizado pro body; opções são botões).
function escolher(painel: HTMLElement, campo: string, opcao: string) {
  const field = within(painel).getByText(campo).closest("div") as HTMLElement
  fireEvent.click(within(field).getByRole("button"))
  fireEvent.click(screen.getByRole("button", { name: opcao }))
}
const aplicar = (painel: HTMLElement) => fireEvent.click(within(painel).getByRole("button", { name: "Aplicar" }))

// Filtros da última busca (3º argumento de listTransactionsPage).
const ultimoFiltro = () => listTransactionsPage.mock.calls.at(-1)?.[2] as Record<string, unknown>

// Abre o ⋮ da linha i e devolve o menu (ações moram no menu, não soltas na linha).
async function abrirMenu(i = 0) {
  fireEvent.click((await screen.findAllByRole("button", { name: "Ações" }))[i])
  return screen.findByRole("menu")
}

// Alterna uma coluna no popover "Colunas" (abre se ainda não estiver aberto — o botão é toggle).
function alternarColuna(nome: string) {
  if (!screen.queryByRole("dialog", { name: "Colunas" })) {
    fireEvent.click(screen.getByRole("button", { name: "Mostrar ou ocultar colunas" }))
  }
  fireEvent.click(within(screen.getByRole("dialog", { name: "Colunas" })).getByRole("button", { name: nome }))
}

describe("TransactionsPage (extrato de caixa via PontesTabela)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear() // colunas salvas por usuário (localStorage por id da tabela)
    listTransactionsPage.mockResolvedValue(paged([salario, mercado, transferencia, pagtoFatura, previsto]))
    getTransactionStats.mockResolvedValue(stats)
    getContas.mockResolvedValue(contas)
    getCategories.mockResolvedValue([
      { id: "cat-sal", descricao: "Renda fixa" },
      { id: "cat-mer", descricao: "Supermercado" },
    ])
    getSubcategories.mockResolvedValue([])
    getCartoes.mockResolvedValue([])
    deleteTransaction.mockResolvedValue(undefined)
    getFamilias.mockResolvedValue([
      { id: "fam1", nome: "Família Silva", criadoPorUsuarioId: "u1", criadoEm: "2026-01-01", ehAdmin: true, totalMembros: 2 },
    ])
    compartilharTransacao.mockResolvedValue(undefined)
    getDependentes.mockResolvedValue([
      { id: "dep1", familiaId: "fam1", nome: "João", apelido: null, dataNascimento: null, tipo: 1, ativo: true },
    ])
    atribuirDependente.mockResolvedValue(undefined)
    getRateioTransacao.mockResolvedValue({ modo: 1, familiaId: "fam1", membros: [] })
    definirRateioTransacao.mockResolvedValue(undefined)
    removerRateioTransacao.mockResolvedValue(undefined)
  })

  it("renderiza as linhas do extrato vindas do serviço", async () => {
    renderPage()
    expect(await screen.findByText("Salário")).toBeInTheDocument()
    for (const nome of ["Mercado", "Para Poupança", "Fatura Nubank", "Aluguel"]) {
      expect(screen.getByText(nome)).toBeInTheDocument()
    }
    // Conta vai no sub da 1ª coluna (Descrição / Conta).
    expect(screen.getAllByText("Nubank").length).toBeGreaterThan(0)
    expect(screen.getByText("Itaú")).toBeInTheDocument()
    expect(screen.getByText("Todas as transações")).toBeInTheDocument()
  })

  it("rotula a natureza de cada linha (Entrada / Saída / Transferência / Pagto. fatura)", async () => {
    renderPage()
    await screen.findByText("Salário")
    // salario = Entrada; mercado + aluguel = Saída; transferência e fatura são neutros.
    expect(screen.getAllByText("Entrada")).toHaveLength(1)
    expect(screen.getAllByText("Saída")).toHaveLength(2)
    expect(screen.getAllByText("Transferência")).toHaveLength(1)
    expect(screen.getAllByText("Pagto. fatura")).toHaveLength(1)
  })

  it("mostra status Efetivado vs Previsto", async () => {
    renderPage()
    await screen.findByText("Salário")
    expect(screen.getAllByText("Efetivado")).toHaveLength(4)
    expect(screen.getAllByText("Previsto")).toHaveLength(1)
  })

  it("data mostra a hora só quando o lançamento tem hora (data e hora vêm separadas; hora null não inventa 00:00)", async () => {
    renderPage()
    await screen.findByText("Salário")
    expect(screen.getByText("21/05/2026 14:32")).toBeInTheDocument() // mercado: hora "14:32:00" → HH:MM (sem segundos)
    expect(screen.getByText("23/05/2026 09:05")).toBeInTheDocument() // fatura: hora com zero à esquerda
    expect(screen.getByText("20/05/2026")).toBeInTheDocument() // salário: hora null → só o dia
    expect(screen.getByText("05/06/2026")).toBeInTheDocument() // previsto: hora null → só o dia
    expect(screen.queryByText(/00:00/)).not.toBeInTheDocument()
  })

  it("o dia sai do string 'YYYY-MM-DD' sem passar por fuso (não recua nem avança 1 dia)", async () => {
    renderPage()
    await screen.findByText("Salário")
    // 20/05 (e não 19/05 nem 21/05): o front não faz new Date() no dia, então o fuso não interfere
    expect(screen.getByText("20/05/2026")).toBeInTheDocument()
    expect(screen.queryByText("19/05/2026")).not.toBeInTheDocument()
  })

  it("valor da transferência é neutro; entrada/saída/fatura têm tom próprio", async () => {
    renderPage()
    await screen.findByText("Salário")
    const tom = (rotulo: RegExp, nome: string) =>
      within(screen.getByText(nome).closest("tr") as HTMLElement).getByText(rotulo).className
    expect(tom(/R\$\s?3\.000,00/, "Salário")).toMatch(/valEntrada/)
    expect(tom(/R\$\s?250,00/, "Mercado")).toMatch(/valSaida/)
    expect(tom(/R\$\s?900,00/, "Fatura Nubank")).toMatch(/valSaida/)
    expect(tom(/R\$\s?500,00/, "Para Poupança")).toMatch(/valNeutro/)
  })

  it("chama listTransactionsPage com apenasCaixa: true (e nunca escopo de cartão)", async () => {
    renderPage()
    await screen.findByText("Salário")
    expect(listTransactionsPage).toHaveBeenCalledWith(1, expect.any(Number), expect.objectContaining({ apenasCaixa: true }))
    const filtro = ultimoFiltro()
    expect(filtro.apenasCaixa).toBe(true)
    // Sem filtro escolhido, nada extra vai pro servidor.
    expect(filtro.natureza).toBeUndefined()
    expect(filtro.contaId).toBeUndefined()
    expect(filtro.meioPagamento).toBeUndefined()
    expect(filtro.status).toBeUndefined()
    expect(filtro.cartaoId).toBeUndefined()
  })

  it("hero: 'Saldo em conta' = soma dos saldos das contas; Entrou/Saiu vêm do caixa (não do total com crédito)", async () => {
    renderPage()
    await screen.findByText("Salário")

    expect(screen.getByText("Saldo em conta").parentElement).toHaveTextContent(/R\$\s?1\.500,50/) // 1000 + 500,50
    expect(screen.getByText("Entrou").parentElement).toHaveTextContent(/R\$\s?4\.321,00/) // entradasCaixa
    expect(screen.getByText("Saiu").parentElement).toHaveTextContent(/R\$\s?1\.234,56/) // saidasCaixa
    // Os totais "com crédito" NÃO podem aparecer no hero.
    expect(screen.queryByText(/9\.999,00/)).not.toBeInTheDocument()
    expect(screen.queryByText(/8\.888,00/)).not.toBeInTheDocument()
    expect(getTransactionStats).toHaveBeenCalledWith({})
  })

  it("hero sem stats (erro no /stats) mostra Entrou/Saiu zerados e a lista continua", async () => {
    getTransactionStats.mockRejectedValue(new Error("boom"))
    renderPage()
    expect(await screen.findByText("Salário")).toBeInTheDocument()
    expect(screen.getByText("Entrou").parentElement).toHaveTextContent(/R\$\s?0,00/)
    expect(screen.getByText("Saiu").parentElement).toHaveTextContent(/R\$\s?0,00/)
    expect(notify).not.toHaveBeenCalled()
  })

  it("colunas Categoria e Pagamento começam ocultas; o resto aparece", async () => {
    renderPage()
    await screen.findByText("Salário")
    const headers = screen.getAllByRole("columnheader").map((th) => th.textContent)
    expect(headers).toEqual(["Descrição / Conta", "Tipo", "Data/Hora", "Status", "Valor", "Ações"])
    expect(screen.queryByRole("columnheader", { name: "Categoria" })).not.toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: "Pagamento" })).not.toBeInTheDocument()
    // Conteúdo delas também não vaza pra tela.
    expect(screen.queryByText("Supermercado")).not.toBeInTheDocument()
    expect(screen.queryByText("Débito")).not.toBeInTheDocument()
  })

  it("dá pra exibir Categoria e Pagamento pelo seletor de colunas (nome da categoria vem do getCategories)", async () => {
    renderPage()
    await screen.findByText("Salário")

    alternarColuna("Categoria")
    expect(await screen.findByRole("columnheader", { name: "Categoria" })).toBeInTheDocument()
    expect(await screen.findByText("Supermercado")).toBeInTheDocument()
    expect(screen.getByText("Renda fixa")).toBeInTheDocument()

    alternarColuna("Pagamento")
    expect(await screen.findByRole("columnheader", { name: "Pagamento" })).toBeInTheDocument()
    expect(screen.getByText("Débito")).toBeInTheDocument()
    expect(screen.getByText("Pix")).toBeInTheDocument()
  })

  it("filtro 'Tipo de lançamento' refaz a busca no servidor com natureza", async () => {
    renderPage()
    await screen.findByText("Salário")
    const antes = listTransactionsPage.mock.calls.length

    const painel = await abrirFiltros()
    escolher(painel, "Tipo de lançamento", "Entradas")
    aplicar(painel)

    await waitFor(() => expect(ultimoFiltro().natureza).toBe("entrada"))
    expect(listTransactionsPage.mock.calls.length).toBeGreaterThan(antes)
    expect(ultimoFiltro().apenasCaixa).toBe(true) // o escopo do extrato continua
    expect(listTransactionsPage).toHaveBeenLastCalledWith(1, expect.any(Number), expect.objectContaining({ natureza: "entrada", apenasCaixa: true }))
  })

  it.each([
    ["Saídas", "saida"],
    ["Transferências", "transferencia"],
    ["Pagamento de fatura", "fatura"],
  ])("filtro Tipo de lançamento '%s' manda natureza=%s", async (rotulo, natureza) => {
    renderPage()
    await screen.findByText("Salário")

    const painel = await abrirFiltros()
    escolher(painel, "Tipo de lançamento", rotulo)
    aplicar(painel)

    await waitFor(() => expect(ultimoFiltro().natureza).toBe(natureza))
  })

  it("'Limpar tudo' nos filtros volta a busca sem natureza", async () => {
    renderPage()
    await screen.findByText("Salário")
    let painel = await abrirFiltros()
    escolher(painel, "Tipo de lançamento", "Entradas")
    aplicar(painel)
    await waitFor(() => expect(ultimoFiltro().natureza).toBe("entrada"))

    painel = await abrirFiltros()
    fireEvent.click(within(painel).getByRole("button", { name: "Limpar tudo" }))
    await waitFor(() => expect(ultimoFiltro().natureza).toBeUndefined())
    expect(ultimoFiltro().apenasCaixa).toBe(true)
  })

  it("filtro por Conta manda contaId", async () => {
    renderPage()
    await screen.findByText("Salário")

    const painel = await abrirFiltros()
    escolher(painel, "Conta", "Itaú")
    aplicar(painel)

    await waitFor(() => expect(ultimoFiltro().contaId).toBe("c2"))
  })

  it("filtro de Status 'Previsto' manda status=0 (0 é valor válido, não 'sem filtro')", async () => {
    renderPage()
    await screen.findByText("Salário")

    const painel = await abrirFiltros()
    escolher(painel, "Status", "Previsto")
    aplicar(painel)

    await waitFor(() => expect(ultimoFiltro().status).toBe(0))
  })

  it("filtro Meio de pagamento só aparece com a coluna Pagamento visível e manda meioPagamento numérico", async () => {
    renderPage()
    await screen.findByText("Salário")

    // Padrão: coluna Pagamento oculta → o filtro dela não entra no painel.
    let painel = await abrirFiltros()
    expect(within(painel).queryByText("Meio de pagamento")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ })) // fecha

    alternarColuna("Pagamento")
    await screen.findByRole("columnheader", { name: "Pagamento" })

    painel = await abrirFiltros()
    escolher(painel, "Meio de pagamento", "Pix")
    aplicar(painel)

    await waitFor(() => expect(ultimoFiltro().meioPagamento).toBe(4))
  })

  it("busca é server-side e debounced: manda q pro serviço na página 1", async () => {
    renderPage()
    await screen.findByText("Salário")

    fireEvent.change(screen.getByPlaceholderText("Buscar lançamento…"), { target: { value: "mercado" } })

    await waitFor(() =>
      expect(listTransactionsPage).toHaveBeenLastCalledWith(1, expect.any(Number), expect.objectContaining({ q: "mercado", apenasCaixa: true }))
    )
  })

  it("estado vazio sem transações", async () => {
    listTransactionsPage.mockResolvedValue(paged([]))
    renderPage()
    expect(await screen.findByText("Nenhuma transação")).toBeInTheDocument()
  })

  it("erro ao carregar avisa por toast de erro", async () => {
    listTransactionsPage.mockRejectedValue(new Error("falhou"))
    renderPage()
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: "Erro ao carregar transações", severity: "error" }))
    )
  })

  it("evento global 'transactionCreated' recarrega a lista e o saldo das contas", async () => {
    renderPage()
    await screen.findByText("Salário")
    const listasAntes = listTransactionsPage.mock.calls.length
    const contasAntes = getContas.mock.calls.length

    listTransactionsPage.mockResolvedValue(paged([{ ...salario, id: "t9", descricao: "Recém criada" }, salario]))
    act(() => { window.dispatchEvent(new Event("transactionCreated")) })

    expect(await screen.findByText("Recém criada")).toBeInTheDocument()
    expect(listTransactionsPage.mock.calls.length).toBeGreaterThan(listasAntes)
    expect(getContas.mock.calls.length).toBeGreaterThan(contasAntes)
  })

  it("excluir (no ⋮) pede confirmação e só então chama o serviço", async () => {
    renderPage()
    await screen.findByText("Mercado")

    const menu = await abrirMenu(1) // 2ª linha = Mercado
    fireEvent.click(within(menu).getByRole("menuitem", { name: /excluir/i }))
    expect(deleteTransaction).not.toHaveBeenCalled()

    // Confirmação mostra o que vai ser excluído.
    const dialogo = await screen.findByRole("alertdialog", { name: "Excluir transação?" })
    expect(within(dialogo).getByText(/Mercado · R\$\s?250,00/)).toBeInTheDocument()

    const antes = listTransactionsPage.mock.calls.length
    fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir" }))
    await waitFor(() => expect(deleteTransaction).toHaveBeenCalledWith("t2"))
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: "Transação excluída", severity: "success" }))
    // Recarrega a lista depois de excluir.
    await waitFor(() => expect(listTransactionsPage.mock.calls.length).toBeGreaterThan(antes))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  })

  it("cancelar a confirmação não exclui nada", async () => {
    renderPage()
    await screen.findByText("Mercado")

    const menu = await abrirMenu(1)
    fireEvent.click(within(menu).getByRole("menuitem", { name: /excluir/i }))
    const dialogo = await screen.findByRole("alertdialog", { name: "Excluir transação?" })
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }))

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    expect(deleteTransaction).not.toHaveBeenCalled()
  })

  it("erro do servidor ao excluir avisa por toast de erro e fecha a confirmação", async () => {
    deleteTransaction.mockRejectedValue(new Error("500"))
    renderPage()
    await screen.findByText("Mercado")

    const menu = await abrirMenu(1)
    fireEvent.click(within(menu).getByRole("menuitem", { name: /excluir/i }))
    const dialogo = await screen.findByRole("alertdialog", { name: "Excluir transação?" })
    fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir" }))

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: "Erro ao excluir transação", severity: "error" }))
    )
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  })

  it("editar (no ⋮) abre o dialog 'Editar transação' com a linha escolhida", async () => {
    renderPage()
    await screen.findByText("Mercado")

    const menu = await abrirMenu(1)
    fireEvent.click(within(menu).getByRole("menuitem", { name: /editar/i }))

    const modal = await screen.findByRole("dialog", { name: "Editar transação" })
    expect(within(modal).getByDisplayValue("Mercado")).toBeInTheDocument()
  })

  it("editar: o dialog recebe data e hora SEPARADAS da linha (21/05 + 14:32), sem passar por fuso", async () => {
    renderPage()
    await screen.findByText("Mercado")

    const menu = await abrirMenu(1) // 2ª linha = Mercado (data "2026-05-21", hora "14:32:00")
    fireEvent.click(within(menu).getByRole("menuitem", { name: /editar/i }))

    const modal = await screen.findByRole("dialog", { name: "Editar transação" })
    expect(within(modal).getByPlaceholderText("HH:MM")).toHaveValue("14:32") // "14:32:00" → HH:MM
    expect(within(modal).getByRole("button", { name: "21/05/2026" })).toBeInTheDocument() // dia exato, sem recuar pra 20/05
  })

  it("editar lançamento SEM hora (null): o campo Hora abre vazio (e, sendo obrigatório, o submit é bloqueado até preencher)", async () => {
    renderPage()
    await screen.findByText("Salário")

    const menu = await abrirMenu(0) // 1ª linha = Salário (data "2026-05-20", hora null)
    fireEvent.click(within(menu).getByRole("menuitem", { name: /editar/i }))

    const modal = await screen.findByRole("dialog", { name: "Editar transação" })
    expect(within(modal).getByPlaceholderText("HH:MM")).toHaveValue("")
    expect(within(modal).getByRole("button", { name: "20/05/2026" })).toBeInTheDocument()
    fireEvent.click(within(modal).getByRole("button", { name: "Salvar" }))
    expect(await within(modal).findByText("Informe a hora")).toBeInTheDocument()
  })

  // ── Ações de família/rateio no ⋮ (só despesa real de conta) ──

  it("despesa real de conta mostra as 3 ações de família no ⋮, antes de Editar/Excluir", async () => {
    renderPage()
    await screen.findByText("Mercado")
    const menu = await abrirMenu(1) // Mercado = despesa (tipo 1, não-transferência, não-fatura)
    const itens = within(menu).getAllByRole("menuitem").map((mi) => mi.textContent)
    expect(itens).toEqual([
      "Compartilhar com família",
      "Atribuir a dependente",
      "Definir rateio",
      "Editar",
      "Excluir",
    ])
  })

  it.each([
    ["receita", 0, ["Editar", "Excluir"]],   // Salário (tipo 2)
    ["transferência", 2, ["Excluir"]],       // Para Poupança — editar uma perna desemparelharia (#288)
  ])("linha de %s não oferece as 3 ações de família", async (_rotulo, i, esperado) => {
    renderPage()
    await screen.findByText("Salário")
    const menu = await abrirMenu(i as number)
    const itens = within(menu).getAllByRole("menuitem").map((mi) => mi.textContent)
    expect(itens).toEqual(esperado)
    expect(within(menu).queryByRole("menuitem", { name: "Compartilhar com família" })).not.toBeInTheDocument()
    expect(within(menu).queryByRole("menuitem", { name: "Atribuir a dependente" })).not.toBeInTheDocument()
    expect(within(menu).queryByRole("menuitem", { name: "Definir rateio" })).not.toBeInTheDocument()
  })

  it("Definir rateio (no ⋮) abre o modal e salvar chama o serviço + toast e recarrega", async () => {
    renderPage()
    await screen.findByText("Mercado")
    const antes = listTransactionsPage.mock.calls.length

    const menu = await abrirMenu(1)
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Definir rateio" }))

    const modal = await screen.findByRole("dialog", { name: /Rateio de/ })
    await waitFor(() => expect(getRateioTransacao).toHaveBeenCalledWith("t2"))

    fireEvent.click(within(modal).getByRole("button", { name: "Salvar" }))

    await waitFor(() => expect(definirRateioTransacao).toHaveBeenCalledWith("t2", 1, null))
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: "Rateio definido", severity: "success" }))
    await waitFor(() => expect(listTransactionsPage.mock.calls.length).toBeGreaterThan(antes))
  })

  it("Compartilhar com família (no ⋮) abre o modal e escolher a família chama o serviço + toast", async () => {
    renderPage()
    await screen.findByText("Mercado")

    const menu = await abrirMenu(1)
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Compartilhar com família" }))

    const modal = await screen.findByRole("dialog", { name: "Compartilhar com a família" })
    fireEvent.click(await within(modal).findByRole("button", { name: "Família Silva" }))

    await waitFor(() => expect(compartilharTransacao).toHaveBeenCalledWith("t2", "fam1"))
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: "Despesa compartilhada com a família", severity: "success" }))
  })
})

describe("TransactionsPage — pagamento de fatura sem ações", () => {
  // Revisão de segurança do #288: excluir o pagamento devolvia o dinheiro com a fatura seguindo paga; editar
  // desemparelhava. O servidor recusa; a tela nem oferece — a linha do pagamento fica sem o ⋮.
  it("a linha do pagamento de fatura não tem o ⋮ (as outras 4 têm)", async () => {
    renderPage()
    await screen.findByText("Fatura Nubank")
    expect(await screen.findAllByRole("button", { name: "Ações" })).toHaveLength(4) // 5 linhas, menos o pagamento
  })
})
