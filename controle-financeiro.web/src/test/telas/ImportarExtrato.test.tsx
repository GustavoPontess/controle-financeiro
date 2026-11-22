import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"

vi.mock("../../services/contaService", () => ({
  getContas: vi.fn(async () => [
    { id: "k1", nome: "Nubank", tipo: 1, tipoDescricao: "", saldoAtual: 0, isCarteira: false },
    { id: "k2", nome: "Inter", tipo: 1, tipoDescricao: "", saldoAtual: 0, isCarteira: false },
  ]),
}))
vi.mock("../../services/categoryService", () => ({
  getCategories: vi.fn(async () => [
    { id: "alim", descricao: "Alimentação", finalidade: 1, isPadrao: true },
    { id: "sal", descricao: "Salário", finalidade: 2, isPadrao: true },
    { id: "outros", descricao: "Outros", finalidade: 3, isPadrao: true },
  ]),
}))
vi.mock("../../services/subcategoryService", () => ({
  getSubcategories: vi.fn(async () => [{ id: "pad", nome: "Padaria", categoriaId: "alim" }]),
}))
vi.mock("../../services/importacaoService", () => ({
  previewImportacao: vi.fn(), confirmarImportacao: vi.fn(), ensinarNome: vi.fn(), getImportacoesAnteriores: vi.fn(async () => []),
  getQuantidadePendentes: vi.fn(async () => 0),
}))
import { confirmarImportacao, ensinarNome, getImportacoesAnteriores, previewImportacao } from "../../services/importacaoService"
vi.mock("../../services/anexoService", () => ({ enviarAnexo: vi.fn() }))
import { enviarAnexo } from "../../services/anexoService"
import ImportarExtrato from "../../telas/ImportarExtrato"

const PREVIA_OFX = {
  formato: "ofx", total: 3, duplicadas: 1, precisaMapear: false,
  linhas: [
    { data: "2026-05-10T00:00:00", descricao: "Mercado", valor: 50, tipo: 1, fitId: "F1", duplicada: false, categoriaSugeridaId: "alim", categoriaSugeridaNome: "Alimentação" },
    { data: "2026-05-11T00:00:00", descricao: "Padaria", valor: 12, tipo: 1, fitId: "F2", duplicada: true, categoriaSugeridaId: null, categoriaSugeridaNome: null },
    { data: "2026-05-12T00:00:00", descricao: "Salário", valor: 3000, tipo: 2, fitId: "F3", duplicada: false, categoriaSugeridaId: "sal", categoriaSugeridaNome: "Salário" },
  ],
}
const PREVIA_MAPEAR = {
  formato: "csv", total: 0, duplicadas: 0, precisaMapear: true, linhas: [],
  colunas: ["Dia", "Texto", "X", "Y"], amostra: [["05/05/2026", "Salário", "3500,00", ""], ["06/05/2026", "Mercado", "", "80,00"]],
  mapeamento: null, assinatura: "dia|texto|x|y",
}

const Transacoes = () => { const { state } = useLocation(); return <p>transações {JSON.stringify(state)}</p> }
const renderizar = () => render(
  <MemoryRouter initialEntries={["/importar"]}>
    <Routes>
      <Route path="/importar" element={<ImportarExtrato />} />
      <Route path="/transacoes" element={<Transacoes />} />
      <Route path="/pendentes" element={<p>fila de pendentes</p>} />
    </Routes>
  </MemoryRouter>,
)
const escolher = async (campo: string, opcao: string) => {
  await userEvent.click(await screen.findByRole("combobox", { name: campo }))
  await userEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: opcao }))
}
/** A etiqueta da coluna no cabeçalho (o que ela é): um select nativo. */
const papelDa = (coluna: string) => screen.getByRole("combobox", { name: `O que é a coluna ${coluna}` })
/** A conta vem primeiro: a tela começa só com a lista de contas. */
const escolherConta = async (conta = "Nubank") =>
  userEvent.click(within(await screen.findByRole("list", { name: "Contas" })).getByRole("button", { name: new RegExp(conta) }))
const entradaDeArquivo = () => screen.getByLabelText("Arquivo do extrato")
/** Escolhe a conta e os arquivos: escolher o arquivo já lê (não existe "Ler extrato"). */
const lerExtrato = async (arquivos: string | File[] = "nu.ofx", conta = "Nubank") => {
  await escolherConta(conta)
  await userEvent.upload(entradaDeArquivo(), typeof arquivos === "string" ? new File(["conteudo"], arquivos) : arquivos)
}
const lugares = () => screen.getByRole("list", { name: "Lugares" })
const lugar = (nome: RegExp) => within(lugares()).getByRole("button", { name: nome })
/** O botão da faixa de cima manda direto (não tem tela de resumo no meio). */
const importar = async (rotulo: string) => userEvent.click(await screen.findByRole("button", { name: rotulo }))
const enviadas = () => vi.mocked(confirmarImportacao).mock.calls[0][1]

describe("ImportarExtrato", () => {
  beforeEach(() => { vi.mocked(previewImportacao).mockReset(); vi.mocked(confirmarImportacao).mockReset(); vi.mocked(ensinarNome).mockReset(); vi.mocked(enviarAnexo).mockReset() })

  // "Saí selecionando os arquivos e não entendi por que não foi pro próximo" (Gustavo, 2026-11-22).
  it("a conta vem primeiro: sem ela não tem onde pôr arquivo; escolheu, o arquivo já lê e a faixa mostra a conta", async () => {
    vi.mocked(previewImportacao).mockResolvedValue(PREVIA_OFX as never)
    renderizar()
    expect(await screen.findByText("De qual conta é o extrato?")).toBeInTheDocument()
    // A área do arquivo existe pra animar a entrada, mas fica fora de alcance até ter conta.
    expect(entradaDeArquivo().closest("[inert]")).not.toBeNull()
    expect(screen.queryByRole("heading", { name: "Nubank" })).not.toBeInTheDocument()

    await escolherConta()
    expect(screen.getByRole("heading", { name: "Nubank" })).toBeInTheDocument()
    expect(entradaDeArquivo().closest("[inert]")).toBeNull()
    expect(previewImportacao).not.toHaveBeenCalled()

    await userEvent.upload(entradaDeArquivo(), new File(["conteudo"], "nu.ofx"))
    expect(previewImportacao).toHaveBeenCalledWith("k1", expect.any(File), undefined)
    await screen.findByRole("list", { name: "Lugares" })
    // Não existe "Ler extrato" nem tela de resumo: a faixa de cima tem a conta, os números e o Importar.
    expect(screen.queryByRole("button", { name: "Ler extrato" })).not.toBeInTheDocument()
    expect(within(screen.getByRole("group", { name: "O que vai entrar" })).getByText("2 lançamentos")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Trocar conta ou arquivos" })).toBeInTheDocument()
  })

  // "O detalhe da transação tem que ser do mesmo jeito da Nova transação" (Gustavo, 2026-11-22).
  it("o lançamento tem os campos de Nova transação, já preenchidos, e o importar leva o que a pessoa conferiu", async () => {
    vi.mocked(previewImportacao).mockResolvedValue({ formato: "ofx", total: 1, duplicadas: 0, precisaMapear: false, linhas: [
      { data: "2026-05-10T14:05:00", descricao: "Compra no débito - Padaria", valor: 12, tipo: 1, fitId: "D1", duplicada: false,
        categoriaSugeridaId: "alim", categoriaSugeridaNome: "Alimentação", estabelecimento: "Padaria", chave: "d:padaria", meioSugerido: 2 },
    ] } as never)
    vi.mocked(confirmarImportacao).mockResolvedValue({ importadas: 1 })
    renderizar()
    await lerExtrato()

    // O que é do banco fica fixo (valor, tipo, data, conta); o resto vem preenchido e se acerta ali.
    expect(await screen.findByRole("heading", { name: "Padaria" })).toBeInTheDocument()
    const detalhes = screen.getByRole("group", { name: "Detalhes do lançamento" })
    expect(detalhes).toHaveTextContent("TipoDespesa")
    expect(detalhes).toHaveTextContent("Data10/05/2026")
    expect(detalhes).toHaveTextContent("14:05")
    expect(screen.getByRole("combobox", { name: "Pago com" })).toHaveTextContent("Débito")
    expect(screen.getByRole("combobox", { name: "Categoria" })).toHaveTextContent("Alimentação")

    const descricao = screen.getByLabelText("Descrição")
    expect(descricao).toHaveValue("Compra no débito - Padaria")
    await userEvent.clear(descricao)
    await userEvent.type(descricao, "Pão da manhã")
    expect(screen.getByText("No extrato: Compra no débito - Padaria")).toBeInTheDocument()
    await escolher("Pago com", "Pix")
    await escolher("Subcategoria", "Padaria")
    await importar("Importar com 1 pendente")

    expect(enviadas()).toEqual([expect.objectContaining({
      descricao: "Compra no débito - Padaria", descricaoEditada: "Pão da manhã", categoriaId: "alim",
      subcategoriaId: "pad", meioPagamento: 4, hora: "14:05:00",
    })])
  })

  // Nota e local (2026-11-07): o ponto vai junto na confirmação e o anexo sobe depois, pro lançamento que a linha virou.
  it("localização vai na confirmação e o anexo sobe pro lançamento criado", async () => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: -19.923471, longitude: -43.945712 } } as GeolocationPosition),
    } })
    vi.mocked(previewImportacao).mockResolvedValue({ formato: "ofx", total: 1, duplicadas: 0, precisaMapear: false, linhas: [
      { data: "2026-05-10T14:05:00", descricao: "Compra no débito - Padaria", valor: 12, tipo: 1, fitId: "D1", duplicada: false,
        categoriaSugeridaId: "alim", categoriaSugeridaNome: "Alimentação", estabelecimento: "Padaria", chave: "d:padaria", meioSugerido: 2 },
    ] } as never)
    vi.mocked(confirmarImportacao).mockResolvedValue({ importadas: 1, ids: ["tx1"] })
    vi.mocked(enviarAnexo).mockResolvedValue({ id: "a1", nome: "nota.webp", tipoConteudo: "image/webp", tamanho: 1, criadoEm: "" })
    renderizar()
    await lerExtrato()
    await userEvent.click(await screen.findByRole("button", { name: "Usar onde estou" }))
    const nota = new File(["x"], "nota.png", { type: "image/png" })
    await userEvent.upload(screen.getByLabelText("Escolher arquivo"), nota)
    await importar("Importar com 1 pendente")

    expect(enviadas()).toEqual([expect.objectContaining({ latitude: -19.9235, longitude: -43.9457 })])
    expect(await screen.findByRole("heading", { name: "1 lançamento importado" })).toBeInTheDocument()
    expect(enviarAnexo).toHaveBeenCalledWith("tx1", nota)
  })

  it("lugar agrupado: o formulário de cima é de um lançamento e o Editar de outro traz ele pra cima", async () => {
    const linha = (fitId: string, descricao: string) => ({ data: "2026-05-10T00:00:00", descricao, valor: 10, tipo: 1, fitId, duplicada: false,
      categoriaSugeridaId: null, categoriaSugeridaNome: null, estabelecimento: "Loja", chave: "d:loja", meioSugerido: 4 })
    vi.mocked(previewImportacao).mockResolvedValue({ formato: "ofx", total: 2, duplicadas: 0, precisaMapear: false,
      linhas: [linha("A1", "Pix - Loja 1"), linha("A2", "Pix - Loja 2")] } as never)
    vi.mocked(confirmarImportacao).mockResolvedValue({ importadas: 2 })
    renderizar()
    await lerExtrato()

    // O formulário de cima é de UM lançamento (o primeiro); os agrupados ficam embaixo.
    expect(await screen.findByRole("list", { name: "Lançamentos de Loja" })).toBeInTheDocument()
    expect(screen.getByLabelText("Descrição")).toHaveValue("Pix - Loja 1")
    await userEvent.clear(screen.getByLabelText("Descrição"))
    await userEvent.type(screen.getByLabelText("Descrição"), "Loja do bairro")

    // Editar outro: ele sobe pro formulário e só ele muda.
    await userEvent.click(screen.getByRole("button", { name: "Editar Pix - Loja 2" }))
    expect(screen.getByLabelText("Descrição")).toHaveValue("Pix - Loja 2")
    await userEvent.clear(screen.getByLabelText("Descrição"))
    await userEvent.type(screen.getByLabelText("Descrição"), "Só esse")
    await importar("Importar com 1 pendente")

    expect(enviadas().map((l) => [l.fitId, l.descricaoEditada, l.meioPagamento]))
      .toEqual([["A1", "Loja do bairro", 4], ["A2", "Só esse", 4]])
  })

  it("forma de pagamento: a de um lançamento vai pros outros do lugar com um clique, e a exceção se acerta no dele", async () => {
    const linha = (fitId: string, descricao: string) => ({ data: "2026-05-10T00:00:00", descricao, valor: 10, tipo: 1, fitId, duplicada: false,
      categoriaSugeridaId: null, categoriaSugeridaNome: null, estabelecimento: "Loja", chave: "d:loja", meioSugerido: null })
    vi.mocked(previewImportacao).mockResolvedValue({ formato: "ofx", total: 3, duplicadas: 0, precisaMapear: false,
      linhas: [linha("A1", "Pix - Loja 1"), linha("A2", "Pix - Loja 2"), linha("A3", "Pix - Loja 3")] } as never)
    vi.mocked(confirmarImportacao).mockResolvedValue({ importadas: 3 })
    renderizar()
    await lerExtrato()

    await screen.findByRole("list", { name: "Lançamentos de Loja" })
    await escolher("Pago com", "Pix")
    await userEvent.click(screen.getByRole("button", { name: "Usar Pix nos outros 2 sem forma de pagamento" }))
    await userEvent.click(screen.getByRole("button", { name: "Editar Pix - Loja 2" }))
    await escolher("Pago com", "Débito")
    await importar("Importar com 1 pendente")

    expect(enviadas().map((l) => [l.fitId, l.meioPagamento])).toEqual([["A1", 4], ["A2", 2], ["A3", 4]])
  })

  it("o começo mostra as importações anteriores da conta escolhida, e elas somem enquanto a pessoa está na fila", async () => {
    vi.mocked(getImportacoesAnteriores).mockResolvedValueOnce([
      { id: "i1", contaId: "k1", contaNome: "Nubank", criadoEm: "2026-10-05T14:00:00", de: "2026-09-01", ate: "2026-09-30", quantidade: 40 },
      { id: "i2", contaId: "k1", contaNome: "Nubank", criadoEm: "2026-09-02T14:00:00", de: "2026-08-15", ate: "2026-08-15", quantidade: 1 },
      { id: "i3", contaId: "k2", contaNome: "Inter", criadoEm: "2026-09-01T14:00:00", de: "2026-08-01", ate: "2026-08-31", quantidade: 7 },
    ])
    vi.mocked(previewImportacao).mockResolvedValue(PREVIA_OFX as never)
    renderizar()

    // Na lista de contas, até quando cada uma já foi importada.
    const contas = await screen.findByRole("list", { name: "Contas" })
    expect(await within(contas).findByRole("button", { name: /Nubank.*Importado até 30\/09\/2026/ })).toBeInTheDocument()
    await escolherConta()
    const lista = screen.getByRole("list", { name: "Importações anteriores" })
    const linhas = within(lista).getAllByRole("link")
    expect(linhas.map((l) => l.textContent)).toEqual([
      "NU01/09/2026 a 30/09/202640 lançamentosImportado em 05/10/2026",
      "NU15/08/20261 lançamentoImportado em 02/09/2026",
    ])
    expect(linhas[0]).toHaveAttribute("href", "/transacoes")

    await userEvent.upload(entradaDeArquivo(), new File(["conteudo"], "nu.ofx"))
    await screen.findByRole("list", { name: "Lugares" })
    expect(screen.queryByRole("list", { name: "Importações anteriores" })).not.toBeInTheDocument()
  })

  it("arquivo que não é OFX nem CSV é recusado antes de mandar", async () => {
    renderizar()
    await escolherConta()
    // O campo só aceita .ofx/.csv; aqui alguém força outro arquivo (o filtro do navegador não é garantia).
    await userEvent.setup({ applyAccept: false }).upload(entradaDeArquivo(), new File(["x"], "extrato.pdf"))
    expect(screen.getByText("Envie um arquivo .ofx ou .csv")).toBeInTheDocument()
    expect(previewImportacao).not.toHaveBeenCalled()
  })

  it("OFX: o que já está no app vem desmarcado; importa só as marcadas, com a chave, e volta pro começo dizendo o que entrou", async () => {
    vi.mocked(previewImportacao).mockResolvedValue(PREVIA_OFX as never)
    vi.mocked(confirmarImportacao).mockResolvedValue({ importadas: 2, jaExistiam: 0 })
    renderizar()
    await lerExtrato()

    // Cada lugar na lista; o que já está no app é um item sem categoria, desmarcado.
    await screen.findByRole("list", { name: "Lugares" })
    await userEvent.click(lugar(/^Mercado/))
    expect(screen.getByRole("button", { name: "Deixar de fora" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Categoria" })).toHaveTextContent("Alimentação")
    await userEvent.click(lugar(/^Já está no app/))
    expect(screen.getByRole("checkbox", { name: "Importar Padaria" })).not.toBeChecked()
    expect(screen.queryByRole("combobox", { name: "Categoria" })).not.toBeInTheDocument()

    await importar("Importar com 2 pendentes")
    expect(confirmarImportacao).toHaveBeenCalledWith("k1", [
      expect.objectContaining({ descricao: "Mercado", categoriaId: "alim", fitId: "F1" }),
      expect.objectContaining({ descricao: "Salário", categoriaId: "sal" }),
    ], expect.any(String), null, undefined)
    // Importou: a tela volta pro começo (a conta continua escolhida) com a faixa do que entrou.
    expect(await screen.findByRole("heading", { name: "2 lançamentos importados" })).toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Lugares" })).not.toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Contas" })).toBeInTheDocument()
    // Tudo entrou com categoria: nada pra resolver depois.
    expect(screen.queryByRole("button", { name: /^Resolver/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Ver em Transações" }))
    expect(await screen.findByText(/"contaId":"k1"/)).toBeInTheDocument()
  })

  // "A ideia é categorizar tudo": dá pra importar com pendente, e o que ficou sem categoria tem pra onde ir.
  it("importar com pendente: o que entrou sem categoria fica avisado, com o atalho pra fila de pendentes", async () => {
    const linha = (fitId: string, lugarNome: string) => ({ data: "2026-05-10T00:00:00", descricao: `Compra - ${lugarNome}`, valor: 10, tipo: 1, fitId, duplicada: false,
      categoriaSugeridaId: null, categoriaSugeridaNome: null, estabelecimento: lugarNome, chave: `d:${lugarNome.toLowerCase()}` })
    vi.mocked(previewImportacao).mockResolvedValue({ formato: "ofx", total: 2, duplicadas: 0, precisaMapear: false,
      linhas: [linha("A1", "Loja"), linha("A2", "Feira")] } as never)
    vi.mocked(confirmarImportacao).mockResolvedValue({ importadas: 2 })
    renderizar()
    await lerExtrato()

    expect(await screen.findByText("Faltam 2")).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "O que vai entrar" })).toHaveTextContent("Sem categoria2")
    // Sem categoria não confirma; "Pular" só mostra o próximo (o lugar continua pendente).
    expect(screen.getByRole("button", { name: "Confirmar e próximo" })).toBeDisabled()
    expect(screen.getByRole("heading", { name: "Loja" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Pular" }))
    expect(screen.getByRole("heading", { name: "Feira" })).toBeInTheDocument()
    expect(screen.getByText("Faltam 2")).toBeInTheDocument()
    // As sugestões nunca trazem "Outros" (é a última opção da lista, não um atalho).
    const sugestoes = screen.getByRole("group", { name: "Sugestões de categoria pra Feira" })
    expect(within(sugestoes).queryByRole("button", { name: "Outros" })).not.toBeInTheDocument()
    await userEvent.click(within(sugestoes).getByRole("button", { name: "Alimentação" }))
    await userEvent.click(screen.getByRole("button", { name: "Confirmar e próximo" }))
    expect(screen.getByText("Falta 1")).toBeInTheDocument()

    await importar("Importar com 1 pendente")
    expect(enviadas().map((l) => [l.fitId, l.categoriaId])).toEqual([["A1", null], ["A2", "alim"]])
    expect(await screen.findByRole("heading", { name: "2 lançamentos importados" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Resolver 1 pendente" }))
    expect(await screen.findByText("fila de pendentes")).toBeInTheDocument()
  })

  it("reenviar a mesma prévia usa a mesma chave (não importa duas vezes)", async () => {
    vi.mocked(previewImportacao).mockResolvedValue(PREVIA_OFX as never)
    vi.mocked(confirmarImportacao).mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValueOnce({ importadas: 2 })
    renderizar()
    await lerExtrato()
    await importar("Importar com 2 pendentes")
    expect(await screen.findByRole("alert")).toBeInTheDocument()
    await importar("Importar com 2 pendentes")
    await waitFor(() => expect(confirmarImportacao).toHaveBeenCalledTimes(2))
    const [primeira, segunda] = vi.mocked(confirmarImportacao).mock.calls
    expect(primeira[2]).toBe(segunda[2])
  })

  it("\"Deixar de fora\" tira o lugar da importação (e \"Incluir de novo\" traz de volta); a busca acha pela descrição", async () => {
    vi.mocked(previewImportacao).mockResolvedValue(PREVIA_OFX as never)
    renderizar()
    await lerExtrato()
    await userEvent.type(await screen.findByRole("textbox", { name: "Buscar lugar" }), "pada")
    expect(within(lugares()).getAllByRole("button").map((b) => b.textContent)).toEqual([expect.stringMatching(/^Já está no app/)])
    await userEvent.clear(screen.getByRole("textbox", { name: "Buscar lugar" }))

    const vaiEntrar = () => screen.getByRole("group", { name: "O que vai entrar" })
    await userEvent.click(lugar(/^Salário/))
    await userEvent.click(screen.getByRole("button", { name: "Deixar de fora" }))
    expect(within(vaiEntrar()).getByText("1 lançamento")).toBeInTheDocument()
    // Voltando no lugar, o mesmo botão traz de volta.
    await userEvent.click(lugar(/^Salário/))
    await userEvent.click(screen.getByRole("button", { name: "Incluir de novo" }))
    expect(within(vaiEntrar()).getByText("2 lançamentos")).toBeInTheDocument()
  })

  it("Pix no crédito: a entrada do cartão aparece com o gasto dela, que tem categoria; empréstimo também; pagamento de fatura é item sem categoria", async () => {
    const linha = (fitId: string, descricao: string, valor: number, tipo: number, extra: object = {}) => ({
      data: "2026-10-02T00:00:00", descricao, valor, tipo, fitId, duplicada: false, categoriaSugeridaId: null, categoriaSugeridaNome: null, ...extra,
    })
    vi.mocked(previewImportacao).mockResolvedValue({ formato: "ofx", total: 4, duplicadas: 0, precisaMapear: false, linhas: [
      linha("V1", "Valor adicionado para Pix no Crédito", 30, 2, { pixNoCredito: true, parPixNoCredito: 1 }),
      linha("P1", "Transferência enviada pelo Pix - UBER", 30, 1, { pagoNoCredito: true, parPixNoCredito: 0, estabelecimento: "UBER", chave: "d:uber" }),
      linha("F1", "Pagamento de fatura", 500, 1, { natureza: "pagamento-fatura" }),
      linha("E1", "Depósito de empréstimo", 2410, 2, { natureza: "emprestimo", estabelecimento: "Depósito de empréstimo", chave: "r:deposito de emprestimo" }),
    ] } as never)
    vi.mocked(confirmarImportacao).mockResolvedValue({ importadas: 4 })
    renderizar()
    await lerExtrato()

    // A fila: em cima o que falta categorizar (o empréstimo e o Pix pelo lugar dele); embaixo o que é só registro.
    await screen.findByRole("list", { name: "Lugares" })
    expect(within(lugares()).getAllByRole("button").map((b) => b.textContent)).toEqual([
      expect.stringMatching(/^Depósito de empréstimo/), expect.stringMatching(/^Uber/), expect.stringMatching(/^Pagamento de fatura/), expect.stringMatching(/^Pix no crédito/)])
    expect(within(lugares()).getByText("Pendentes")).toBeInTheDocument()
    expect(within(lugares()).getByText("Resolvidos")).toBeInTheDocument()

    // Pagamento de fatura: só confere, não tem categoria.
    await userEvent.click(lugar(/^Pagamento de fatura/))
    expect(screen.getByRole("checkbox", { name: "Importar Pagamento de fatura" })).toBeChecked()
    expect(screen.queryByRole("combobox", { name: "Categoria" })).not.toBeInTheDocument()

    // Pix no crédito: a entrada do cartão e, colado nela, o gasto com o lugar e a categoria (que leva pro lugar).
    await userEvent.click(lugar(/^Pix no crédito/))
    const pares = screen.getByRole("list", { name: "Lançamentos de Pix no crédito" })
    expect(within(pares).getAllByRole("listitem")).toHaveLength(2)
    await userEvent.click(within(pares).getByRole("button", { name: "Categoria de UBER: Sem categoria" }))
    expect(screen.getByRole("heading", { name: "Uber" })).toBeInTheDocument()
    await escolher("Categoria", "Alimentação")
    await userEvent.click(lugar(/^Pix no crédito/))
    expect(screen.getByRole("button", { name: "Categoria de UBER: Alimentação" })).toBeInTheDocument()

    await userEvent.click(lugar(/^Depósito de empréstimo/))
    await escolher("Categoria", "Salário")

    await importar("Importar com 2 pendentes")
    expect(enviadas().map((l) => [l.fitId, l.categoriaId])).toEqual([["V1", null], ["P1", "alim"], ["F1", null], ["E1", "sal"]])
  })

  it("separar: o lançamento sai do lugar com a categoria só dele (sem virar regra); juntar faz um grupo da pessoa", async () => {
    const est = (fit: string, valor: number) => ({
      data: "2026-10-02T00:00:00", descricao: `Pix - ESTADO DE MINAS ${fit}`, valor, tipo: 1, fitId: fit, duplicada: false,
      categoriaSugeridaId: "alim", categoriaSugeridaNome: "Alimentação", estabelecimento: "ESTADO DE MINAS", chave: "d:estado",
    })
    vi.mocked(previewImportacao).mockResolvedValue({ formato: "ofx", total: 3, duplicadas: 0, precisaMapear: false,
      linhas: [est("E1", 10), est("E2", 20), est("E3", 30)] } as never)
    vi.mocked(confirmarImportacao).mockResolvedValue({ importadas: 3 })
    renderizar()
    await lerExtrato()

    // O nome em maiúsculas do banco aparece legível (só na tela).
    expect(await screen.findByRole("heading", { name: "Estado de Minas" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Separar Pix - ESTADO DE MINAS E2" }))
    await userEvent.click(screen.getByRole("button", { name: "Separar Pix - ESTADO DE MINAS E3" }))
    // Cada separado vira um item da fila (com a data no lugar de "1 lançamento"); sobrou um só no lugar, sem lista embaixo.
    expect(within(lugares()).getAllByRole("button", { name: /^Estado de Minas02\/10\/2026/ })).toHaveLength(2)
    expect(screen.queryByRole("list", { name: "Lançamentos de ESTADO DE MINAS" })).not.toBeInTheDocument()

    // Junta os dois separados num grupo, dá um nome e a categoria vem do que já tinha.
    await userEvent.click(within(lugares()).getByRole("checkbox", { name: "Juntar Pix - ESTADO DE MINAS E2" }))
    await userEvent.click(within(lugares()).getByRole("checkbox", { name: "Juntar Pix - ESTADO DE MINAS E3" }))
    await userEvent.click(screen.getByRole("button", { name: "Juntar 2" }))
    const nome = screen.getByRole("textbox", { name: "Nome do grupo" })
    await userEvent.clear(nome)
    await userEvent.type(nome, "Doações")
    expect(screen.getByRole("combobox", { name: "Categoria" })).toHaveTextContent("Alimentação")
    expect(lugar(/^Doações/)).toBeInTheDocument()

    await importar("Importar com 2 pendentes")
    expect(enviadas().map((l) => [l.fitId, !!l.naoLembrar])).toEqual([["E1", false], ["E2", true], ["E3", true]])
  })

  it("o lugar mostra a descrição do banco com o nome destacado e avisa mesmo nome com documento diferente", async () => {
    const pix = (fit: string, cpf: string) => ({
      data: "2026-10-02T00:00:00", descricao: `PIX ENVIADO FULANA EXEMPLO CPF ${cpf}`, valor: 10, tipo: 1, fitId: fit, duplicada: false,
      categoriaSugeridaId: null, categoriaSugeridaNome: null, estabelecimento: "FULANA EXEMPLO", chave: "d:fulana exemplo",
      tipoMovimento: "Pix", documento: `CPF •••.${cpf}-••`,
      pedacos: [{ texto: "PIX ENVIADO ", parte: "tipo" }, { texto: "FULANA EXEMPLO ", parte: "nome" }, { texto: `CPF ${cpf}`, parte: "resto" }],
    })
    vi.mocked(previewImportacao).mockResolvedValue({ formato: "ofx", total: 2, duplicadas: 0, precisaMapear: false,
      linhas: [pix("P1", "123.456"), pix("P2", "987.654")] } as never)
    renderizar()
    await lerExtrato("banco.ofx")

    const lista = await screen.findByRole("list", { name: "Lançamentos de FULANA EXEMPLO" })
    const nomes = within(lista).getAllByText("FULANA EXEMPLO", { exact: false, selector: "[data-parte=nome]" })
    expect(nomes).toHaveLength(2)
    expect(lista).toHaveTextContent("Pix · CPF •••.123.456-••")
    expect(screen.getByRole("status")).toHaveTextContent("Mesmo nome, documentos diferentes")

    await userEvent.click(screen.getByRole("button", { name: "Separar" }))
    expect(screen.queryByText("Mesmo nome, documentos diferentes. Pode ser outra pessoa.")).not.toBeInTheDocument()
    // O grupo novo leva o documento no nome (a sigla continua em maiúsculas).
    expect(lugar(/Fulana Exemplo · CPF •••.987.654-••/)).toBeInTheDocument()
  })

  it("qual é o nome: abre dentro da tela (sem janela), marca as palavras seguidas, recusa o começo pra lembrar, ensina e relê", async () => {
    const desc = "TED RECEBIDA 341 0412 98765-4 CONSTRUTORA ALVORADA LTDA"
    vi.mocked(previewImportacao).mockResolvedValue({ formato: "ofx", total: 1, duplicadas: 0, precisaMapear: false, linhas: [{
      data: "2026-10-02T00:00:00", descricao: desc, valor: 10, tipo: 2, fitId: "T1", duplicada: false,
      categoriaSugeridaId: null, categoriaSugeridaNome: null, estabelecimento: "98765-4 CONSTRUTORA ALVORADA LTDA", chave: "r:x",
      pedacos: [{ texto: "TED RECEBIDA 341 0412 ", parte: "tipo" }, { texto: "98765-4 CONSTRUTORA ALVORADA LTDA", parte: "nome" }],
    }] } as never)
    vi.mocked(ensinarNome).mockResolvedValue({ nome: "CONSTRUTORA ALVORADA LTDA" })
    renderizar()
    await lerExtrato("banco.ofx")
    await userEvent.click(await screen.findByRole("button", { name: "Qual é o nome?" }))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    const trecho = screen.getByRole("region", { name: "Qual parte é o nome?" })
    const palavra = (w: string) => within(trecho).getByRole("button", { name: w })
    // Começa com o que o app leu; a ponta sai com um clique.
    expect(palavra("98765-4")).toHaveAttribute("aria-pressed", "true")
    await userEvent.click(palavra("98765-4"))
    expect(palavra("98765-4")).toHaveAttribute("aria-pressed", "false")
    expect(trecho).toHaveTextContent("NomeCONSTRUTORA ALVORADA LTDA")

    // Estender até o começo não serve de modelo.
    await userEvent.click(palavra("TED"))
    expect(palavra("0412")).toHaveAttribute("aria-pressed", "true")
    await userEvent.click(within(trecho).getByRole("button", { name: "Salvar nome" }))
    expect(within(trecho).getByRole("alert")).toHaveTextContent("O começo da descrição não serve de modelo")
    expect(ensinarNome).not.toHaveBeenCalled()

    // Clicar no meio recomeça ali; estender até o fim.
    await userEvent.click(palavra("CONSTRUTORA"))
    await userEvent.click(palavra("LTDA"))
    await userEvent.click(within(trecho).getByRole("button", { name: "Salvar nome" }))
    expect(ensinarNome).toHaveBeenCalledWith(desc, "CONSTRUTORA ALVORADA LTDA")
    await waitFor(() => expect(previewImportacao).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole("region", { name: "Qual parte é o nome?" })).not.toBeInTheDocument())
  })

  it("voltar pro lugar desfaz o separar", async () => {
    const est = (fit: string) => ({
      data: "2026-10-02T00:00:00", descricao: `Compra ${fit}`, valor: 10, tipo: 1, fitId: fit, duplicada: false,
      categoriaSugeridaId: null, categoriaSugeridaNome: null, estabelecimento: "Loja", chave: "d:loja",
    })
    vi.mocked(previewImportacao).mockResolvedValue({ formato: "ofx", total: 2, duplicadas: 0, precisaMapear: false,
      linhas: [est("L1"), est("L2")] } as never)
    renderizar()
    await lerExtrato()
    await userEvent.click(await screen.findByRole("button", { name: "Separar Compra L2" }))
    await userEvent.click(lugar(/^Loja02\/10\/2026/))
    await userEvent.click(screen.getByRole("button", { name: "Voltar pro lugar" }))
    expect(within(lugares()).queryByRole("button", { name: /^Loja02\/10\/2026/ })).not.toBeInTheDocument()
    expect(lugar(/^Loja2 lançamentos/)).toBeInTheDocument()
  })

  it("CSV não reconhecido: a etiqueta de cada coluna com palpite, erro se falta o valor, prévia ao vivo, e manda pra lembrar", async () => {
    // Sem mapeamento, não reconhece; com ele, lê.
    vi.mocked(previewImportacao).mockImplementation(async (_c, _a, m) => (m ? { ...PREVIA_OFX, formato: "csv", assinatura: "dia|texto|x|y" } : PREVIA_MAPEAR) as never)
    vi.mocked(confirmarImportacao).mockResolvedValue({ importadas: 2 })
    renderizar()
    await lerExtrato("inter.csv", "Inter")

    expect(await screen.findByText("Não reconhecemos as colunas desse arquivo")).toBeInTheDocument()
    // Palpite pelos exemplos: a coluna com cara de data e a de texto. Duas colunas de número, não adivinha qual é qual.
    expect(papelDa("Dia")).toHaveValue("data")
    expect(papelDa("Texto")).toHaveValue("descricao")
    expect(papelDa("X")).toHaveValue("ignorar")
    expect(papelDa("Y")).toHaveValue("ignorar")
    const previa = screen.getByRole("list", { name: "Como as primeiras linhas vão ficar" })
    expect(previa).toHaveTextContent("sem valor")

    // Continuar sem o valor não lê: diz o que falta.
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Falta o valor: uma coluna Valor, ou Entrada e Saída")
    expect(previewImportacao).toHaveBeenCalledTimes(1)

    await userEvent.selectOptions(papelDa("X"), "entrada")
    await userEvent.selectOptions(papelDa("Y"), "saida")
    expect(screen.getByRole("columnheader", { name: /X/ })).toHaveTextContent("você escolheu")
    expect(previa).toHaveTextContent("Salário")
    expect(previa).toHaveTextContent("entrou")
    expect(previa).toHaveTextContent("saiu")

    await userEvent.click(screen.getByRole("button", { name: "Continuar" }))
    const mapa = { data: 0, descricao: 1, valor: null, entrada: 2, saida: 3, id: null, inverterSinal: false, tipo: null }
    expect(previewImportacao).toHaveBeenLastCalledWith("k2", expect.any(File), mapa)
    await screen.findByRole("list", { name: "Lugares" })
    await importar("Importar com 2 pendentes")
    expect(confirmarImportacao).toHaveBeenCalledWith("k2", expect.any(Array), expect.any(String), mapa, "dia|texto|x|y")
  })

  it("uma coluna só é uma coisa (Ignorar pode em várias); inverter troca o sinal", async () => {
    vi.mocked(previewImportacao).mockImplementation(async (_c, _a, m) => (m ? PREVIA_OFX : PREVIA_MAPEAR) as never)
    renderizar()
    await lerExtrato("inter.csv")
    await screen.findByText("Não reconhecemos as colunas desse arquivo")

    await userEvent.selectOptions(papelDa("X"), "valor")
    // Data em outra coluna: a de antes vira Ignorar.
    await userEvent.selectOptions(papelDa("X"), "data")
    expect(papelDa("Dia")).toHaveValue("ignorar")
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Falta o valor")
    expect(previewImportacao).toHaveBeenCalledTimes(1)

    await userEvent.selectOptions(papelDa("Dia"), "data")
    expect(papelDa("X")).toHaveValue("ignorar")
    await userEvent.selectOptions(papelDa("X"), "valor")
    await userEvent.click(screen.getByRole("button", { name: "Está ao contrário? Inverter" }))
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }))
    expect(previewImportacao).toHaveBeenLastCalledWith("k1", expect.any(File),
      { data: 0, descricao: 1, valor: 2, entrada: null, saida: null, id: null, inverterSinal: true, tipo: null })
  })

  // "Elas abrem um trem em cima, não dá pra entender" (Gustavo, 2026-11-22): a faixa fica parada e as colunas entram
  // no lugar da fila.
  it("CSV reconhecido: \"Colunas do arquivo\" abre as colunas no lugar da fila, com o motivo; ler de novo volta pros lançamentos", async () => {
    const reconhecido = { ...PREVIA_OFX, formato: "csv", colunas: ["Data", "Histórico", "Valor"],
      amostra: [["05/05/2026", "Salário", "3500,00"]], assinatura: "data|historico|valor",
      mapeamento: { data: 0, descricao: 1, valor: 2, entrada: null, saida: null, id: null, inverterSinal: false },
      motivos: ["pelo nome da coluna", "lembrado desta conta", "pelo conteúdo"] }
    vi.mocked(previewImportacao).mockResolvedValue(reconhecido as never)
    renderizar()
    await lerExtrato("banco.csv")

    // Reconhecido: cai direto na fila; as colunas só abrem a pedido.
    await screen.findByRole("list", { name: "Lugares" })
    expect(screen.queryByRole("columnheader", { name: /Histórico/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Colunas do arquivo" }))
    expect(screen.getByRole("columnheader", { name: /Histórico/ })).toHaveTextContent("lembrado desta conta")
    expect(screen.getByRole("columnheader", { name: /Valor/ })).toHaveTextContent("pelo conteúdo")
    // A fila sai da frente (guardada) e a faixa de cima continua lá.
    expect(screen.queryByRole("list", { name: "Lugares" })).not.toBeInTheDocument()
    expect(screen.getByRole("group", { name: "O que vai entrar" })).toBeInTheDocument()
    // Nada mudou: nada pra ler de novo. O mesmo botão volta.
    expect(screen.queryByRole("button", { name: "Ler de novo" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Voltar pros lançamentos" }))
    expect(screen.getByRole("list", { name: "Lugares" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Colunas do arquivo" }))
    await userEvent.click(screen.getByRole("button", { name: "Está ao contrário? Inverter" }))
    await userEvent.click(screen.getByRole("button", { name: "Ler de novo" }))
    expect(previewImportacao).toHaveBeenLastCalledWith("k1", expect.any(File),
      { data: 0, descricao: 1, valor: 2, entrada: null, saida: null, id: null, inverterSinal: true, tipo: null })
    expect(await screen.findByRole("list", { name: "Lugares" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Colunas do arquivo" })).toBeInTheDocument()
  })

  it("arrastar os arquivos pra área vale igual a escolher", async () => {
    vi.mocked(previewImportacao).mockResolvedValue(PREVIA_OFX as never)
    renderizar()
    await escolherConta()
    const area = screen.getByText("Arraste o extrato do banco pra cá").closest("[role=button]")!
    const arquivos = [new File(["a"], "jan.ofx"), new File(["b"], "fev.ofx")]
    fireEvent.dragOver(area, { dataTransfer: { files: arquivos } })
    expect(screen.getByText("Pode soltar")).toBeInTheDocument()
    fireEvent.drop(area, { dataTransfer: { files: arquivos } })
    await waitFor(() => expect(previewImportacao).toHaveBeenCalledWith("k1", arquivos, undefined))
    await screen.findByRole("list", { name: "Lugares" })
  })

  it("OFX, CSV e cópia do mesmo extrato viram um cartão só (pelo mês do Nubank ou pelo nome)", async () => {
    vi.mocked(previewImportacao).mockResolvedValue(PREVIA_OFX as never)
    renderizar()
    await lerExtrato([
      new File(["a"], "NU_1_01JAN2026_31JAN2026.ofx"), new File(["b"], "NU_1_01JAN2026_31JAN2026.csv"),
      new File(["c"], "Extrato-06-01-2026-a-03-11-2026-OFX.ofx"), new File(["d"], "Extrato-06-01-2026-a-03-11-2026-CSV.csv"),
      new File(["e"], "Extrato-06-01-2026-a-03-11-2026-CSV (1).csv"),
    ])
    await screen.findByRole("list", { name: "Lugares" })
    // Na faixa: "Todos os arquivos" (um atalho, não um arquivo) e um cartão por extrato.
    expect(screen.getByRole("button", { name: /^Todos os arquivos/ })).toBeInTheDocument()
    const cartoes = within(screen.getByRole("list", { name: "Arquivos escolhidos" })).getAllByRole("listitem")
    expect(cartoes).toHaveLength(2)
    const cartao = (titulo: string) => cartoes.find((c) => c.textContent?.startsWith(titulo))
    expect(cartao("Jan 2026")).toHaveTextContent("OFX + CSV")
    expect(cartao("06/01 a 03/11/2026")).toHaveTextContent("OFX + CSV")
  })

  it("vários arquivos: uma leitura só, e o arquivo que não deu pra ler aparece com o motivo", async () => {
    vi.mocked(previewImportacao).mockResolvedValue({
      ...PREVIA_OFX,
      arquivos: [{ nome: "NU_SET.ofx", linhas: 2 }, { nome: "NU_OUT.ofx", linhas: 1 }, { nome: "estranho.csv", linhas: 0, erro: "Não reconhecemos as colunas." }],
    } as never)
    renderizar()
    await lerExtrato([new File(["a"], "NU_SET.ofx"), new File(["b"], "NU_OUT.ofx"), new File(["c"], "estranho.csv")])

    expect(previewImportacao).toHaveBeenCalledTimes(1)
    expect(previewImportacao).toHaveBeenCalledWith("k1", [expect.any(File), expect.any(File), expect.any(File)], undefined)
    await screen.findByRole("list", { name: "Lugares" })
    const lista = screen.getByRole("list", { name: "Arquivos escolhidos" })
    const ficha = (nome: string) => within(lista).getAllByRole("listitem").find((li) => li.title.startsWith(nome))!
    expect(ficha("NU_SET.ofx")).toHaveTextContent("2 lançamentos")
    expect(ficha("estranho.csv")).toHaveTextContent("Não deu pra ler")
    expect(ficha("estranho.csv")).toHaveAttribute("title", "estranho.csv: Não reconhecemos as colunas.")
  })

  it("os arquivos lidos ficam na faixa: escolher um mostra só os lançamentos dele, e a categoria segue sendo do lugar inteiro", async () => {
    const linha = (fitId: string, arquivo: string, valor: number) => ({
      data: "2026-10-02T00:00:00", descricao: `Compra ${fitId}`, valor, tipo: 1, fitId, duplicada: false,
      categoriaSugeridaId: null, categoriaSugeridaNome: null, estabelecimento: "Loja", chave: "d:loja", arquivo,
    })
    vi.mocked(previewImportacao).mockResolvedValue({ formato: "ofx", total: 3, duplicadas: 0, precisaMapear: false,
      linhas: [linha("A1", "a.ofx", 10), linha("A2", "a.ofx", 20), linha("B1", "b.ofx", 30)],
      arquivos: [{ nome: "a.ofx", linhas: 2 }, { nome: "b.ofx", linhas: 1 }] } as never)
    vi.mocked(confirmarImportacao).mockResolvedValue({ importadas: 3 })
    renderizar()
    await lerExtrato([new File(["a"], "a.ofx"), new File(["b"], "b.ofx")])

    // Tudo junto: a Loja com os 3. Escolhendo o b.ofx, só o lançamento dele.
    await screen.findByRole("list", { name: "Lugares" })
    expect(lugar(/^Loja3 lançamentos/)).toBeInTheDocument()
    // O primeiro cartão é "Todos os arquivos"; escolher um arquivo mostra só os lançamentos dele.
    expect(screen.getByRole("button", { name: /^Todos os arquivos/ })).toHaveAttribute("aria-pressed", "true")
    await userEvent.click(within(screen.getByRole("list", { name: "Arquivos escolhidos" })).getByRole("button", { name: /^b/ }))
    expect(screen.getByRole("button", { name: /^Todos os arquivos/ })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("button", { name: "Ver todos os arquivos" })).toBeInTheDocument()
    expect(lugar(/^Loja1 lançamento/)).toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Lançamentos de Loja" })).not.toBeInTheDocument()

    // A categoria escolhida vendo só um arquivo vale pro lugar inteiro; o importar leva os 3.
    await escolher("Categoria", "Alimentação")
    await userEvent.click(screen.getByRole("button", { name: /^Todos os arquivos/ }))
    expect(lugar(/^Loja3 lançamentos · Alimentação/)).toBeInTheDocument()
    await importar("Importar com 1 pendente")
    expect(enviadas().map((l) => [l.fitId, l.categoriaId])).toEqual([["A1", "alim"], ["A2", "alim"], ["B1", "alim"]])
  })

  // "Trocar conta ou arquivos" é um passo atrás (o começo sozinho na tela, sem a fila embaixo); "Pronto" volta.
  it("trocar conta ou arquivos: volta pro começo, somar um arquivo relê e a fila guarda o que já foi escolhido", async () => {
    const linha = (fit: string, lugarNome: string) => ({
      data: "2026-10-02T00:00:00", descricao: `Compra no débito - ${lugarNome}`, valor: 10, tipo: 1, fitId: fit, duplicada: false,
      categoriaSugeridaId: null, categoriaSugeridaNome: null, estabelecimento: lugarNome, chave: `d:${lugarNome.toLowerCase()}`,
    })
    const um = { formato: "ofx", total: 1, duplicadas: 0, precisaMapear: false, linhas: [linha("A1", "Padaria")], arquivos: [{ nome: "jan.ofx", linhas: 1 }] }
    const dois = { formato: "ofx", total: 2, duplicadas: 0, precisaMapear: false, linhas: [linha("A1", "Padaria"), linha("B1", "Mercado")],
      arquivos: [{ nome: "jan.ofx", linhas: 1 }, { nome: "fev.ofx", linhas: 1 }] }
    vi.mocked(previewImportacao).mockImplementation(async (_c, a) => (Array.isArray(a) && a.length > 1 ? dois : um) as never)
    vi.mocked(confirmarImportacao).mockResolvedValue({ importadas: 2 })
    renderizar()
    await lerExtrato("jan.ofx")

    await screen.findByRole("heading", { name: "Padaria" })
    await escolher("Categoria", "Alimentação")
    await userEvent.click(screen.getByRole("button", { name: "Trocar conta ou arquivos" }))
    // O começo sozinho: a fila e a faixa saem da frente.
    expect(screen.getByRole("list", { name: "Contas" })).toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Lugares" })).not.toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "O que vai entrar" })).not.toBeInTheDocument()

    await userEvent.upload(entradaDeArquivo(), new File(["b"], "fev.ofx"))
    await waitFor(() => expect(previewImportacao).toHaveBeenLastCalledWith("k1", [expect.any(File), expect.any(File)], undefined))
    await userEvent.click(await screen.findByRole("button", { name: "Pronto" }))

    expect(lugar(/Mercado/)).toBeInTheDocument()
    expect(lugar(/^Padaria1 lançamento · Alimentação/)).toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Contas" })).not.toBeInTheDocument()
    await importar("Importar com 2 pendentes")
    expect(enviadas().map((l) => l.categoriaId)).toEqual(["alim", null])
  })

  // "Só posso enviar um arquivo por vez?" (Gustavo, 2026-11-22): o primeiro já lê, então somar outro fica à vista na faixa.
  it("adicionar arquivo pela faixa: relê com os dois sem sair da fila", async () => {
    const linha = (fit: string, lugarNome: string) => ({
      data: "2026-10-02T00:00:00", descricao: `Compra no débito - ${lugarNome}`, valor: 10, tipo: 1, fitId: fit, duplicada: false,
      categoriaSugeridaId: null, categoriaSugeridaNome: null, estabelecimento: lugarNome, chave: `d:${lugarNome.toLowerCase()}`,
    })
    const um = { formato: "ofx", total: 1, duplicadas: 0, precisaMapear: false, linhas: [linha("A1", "Padaria")], arquivos: [{ nome: "jan.ofx", linhas: 1 }] }
    const dois = { formato: "ofx", total: 2, duplicadas: 0, precisaMapear: false, linhas: [linha("A1", "Padaria"), linha("B1", "Mercado")],
      arquivos: [{ nome: "jan.ofx", linhas: 1 }, { nome: "fev.ofx", linhas: 1 }] }
    vi.mocked(previewImportacao).mockImplementation(async (_c, a) => (Array.isArray(a) && a.length > 1 ? dois : um) as never)
    renderizar()
    await lerExtrato("jan.ofx")
    await screen.findByRole("heading", { name: "Padaria" })
    await escolher("Categoria", "Alimentação")

    await userEvent.upload(screen.getByLabelText("Adicionar arquivo"), new File(["b"], "fev.ofx"))
    await waitFor(() => expect(previewImportacao).toHaveBeenLastCalledWith("k1", [expect.any(File), expect.any(File)], undefined))
    expect(await within(await screen.findByRole("list", { name: "Lugares" })).findByRole("button", { name: /Mercado/ })).toBeInTheDocument()
    expect(lugar(/^Padaria1 lançamento · Alimentação/)).toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Contas" })).not.toBeInTheDocument()
    expect(within(screen.getByRole("list", { name: "Arquivos escolhidos" })).getAllByRole("listitem")).toHaveLength(2)
  })

  it("por lugar: a categoria escolhida pro lugar vale pra todos os lançamentos dele", async () => {
    const phl = (fit: string, valor: number) => ({
      data: "2026-10-02T00:00:00", descricao: "Compra no débito - MP *PHLANCHESLTDA", valor, tipo: 1, fitId: fit, duplicada: false,
      categoriaSugeridaId: null, categoriaSugeridaNome: null, estabelecimento: "MP *PHLANCHESLTDA", chave: "d:mp phlanchesltda",
    })
    vi.mocked(previewImportacao).mockResolvedValue({
      formato: "ofx", total: 4, duplicadas: 0, precisaMapear: false,
      linhas: [phl("P1", 12), phl("P2", 15), phl("P3", 9),
        { data: "2026-10-03T00:00:00", descricao: "Compra no débito via NuPay - iFood", valor: 30, tipo: 1, fitId: "P4", duplicada: false,
          categoriaSugeridaId: "alim", categoriaSugeridaNome: "Alimentação", estabelecimento: "iFood", chave: "d:ifood", sugestaoDe: "regra" }],
    } as never)
    vi.mocked(confirmarImportacao).mockResolvedValue({ importadas: 4 })
    renderizar()
    await lerExtrato()

    // Abre no lugar que veio sem categoria.
    expect(await screen.findByRole("list", { name: "Lançamentos de MP *PHLANCHESLTDA" })).toBeInTheDocument()
    await escolher("Categoria", "Alimentação")

    await importar("Importar com 1 pendente")
    expect(enviadas().map((l) => l.categoriaId)).toEqual(["alim", "alim", "alim", "alim"])
  })

  it("a fila: um lugar por vez, a categoria vale pro lugar inteiro, e o que veio por regra já vem resolvido", async () => {
    const phl = (fit: string, valor: number) => ({
      data: "2026-10-02T00:00:00", descricao: "Compra no débito - MP *PHLANCHESLTDA", valor, tipo: 1, fitId: fit, duplicada: false,
      categoriaSugeridaId: null, categoriaSugeridaNome: null, estabelecimento: "MP *PHLANCHESLTDA", chave: "d:mp phlanchesltda",
    })
    vi.mocked(previewImportacao).mockResolvedValue({
      formato: "ofx", total: 5, duplicadas: 0, precisaMapear: false,
      linhas: [phl("P1", 12), phl("P2", 15), phl("P3", 9),
        { data: "2026-10-03T00:00:00", descricao: "Compra no débito via NuPay - iFood", valor: 30, tipo: 1, fitId: "P4", duplicada: false,
          categoriaSugeridaId: "alim", categoriaSugeridaNome: "Alimentação", estabelecimento: "iFood", chave: "d:ifood", sugestaoDe: "regra" },
        { data: "2026-10-04T00:00:00", descricao: "Compra no débito - Posto", valor: 100, tipo: 1, fitId: "P5", duplicada: false,
          categoriaSugeridaId: "alim", categoriaSugeridaNome: "Alimentação", estabelecimento: "Posto", chave: "d:posto", sugestaoDe: "nome" }],
    } as never)
    vi.mocked(confirmarImportacao).mockResolvedValue({ importadas: 5 })
    renderizar()
    await lerExtrato()

    // A fila: o iFood veio por regra (forte) e já está resolvido; o Posto veio pelo nome e entra; o sem categoria vem primeiro.
    expect(await screen.findByText("Faltam 2")).toBeInTheDocument()
    expect(within(lugares()).getAllByRole("button").map((b) => b.textContent?.replace(/R\$.*$/, ""))).toEqual([
      "MP *Phlanchesltda3 lançamentos · Sem categoria", "Posto1 lançamento · Alimentação", "iFood1 lançamento · Alimentação"])
    const cartao = screen.getByRole("list", { name: "Lançamentos de MP *PHLANCHESLTDA" })
    expect(within(cartao).getAllByRole("listitem")).toHaveLength(3)
    expect(screen.getByRole("button", { name: "Confirmar e próximo" })).toBeDisabled()

    await escolher("Categoria", "Alimentação")
    await userEvent.click(screen.getByRole("button", { name: "Confirmar e próximo" }))

    // O próximo: o Posto, com a sugestão já no campo. Deixar de fora desmarca os lançamentos dele.
    expect(screen.getByRole("heading", { name: "Posto" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Categoria" })).toHaveTextContent("Alimentação")
    expect(screen.queryByText(/Pelo nome/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Deixar de fora" }))
    expect(screen.getByText("Fila zerada")).toBeInTheDocument()
    expect(screen.getByText("Nada pendente")).toBeInTheDocument()
    // Na lista dá pra voltar em qualquer um, inclusive o que veio pronto.
    await userEvent.click(lugar(/iFood/))
    expect(screen.getByRole("heading", { name: "iFood" })).toBeInTheDocument()

    // Sem pendente, o botão diz quantos entram.
    await importar("Importar 4 lançamentos")
    expect(enviadas().map((l) => l.fitId)).toEqual(["P1", "P2", "P3", "P4"])
    expect(enviadas().map((l) => l.categoriaId)).toEqual(["alim", "alim", "alim", "alim"])
  })

  it("confirmação repetida: avisa que já tinha sido importado", async () => {
    vi.mocked(previewImportacao).mockResolvedValue(PREVIA_OFX as never)
    vi.mocked(confirmarImportacao).mockResolvedValue({ importadas: 0, repetido: true })
    renderizar()
    await lerExtrato()
    await importar("Importar com 2 pendentes")
    expect(await screen.findByRole("heading", { name: "Esse extrato já tinha sido importado" })).toBeInTheDocument()
  })
})
