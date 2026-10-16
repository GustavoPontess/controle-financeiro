import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
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
  ]),
}))
vi.mock("../../services/importacaoService", () => ({ previewImportacao: vi.fn(), confirmarImportacao: vi.fn() }))
import { confirmarImportacao, previewImportacao } from "../../services/importacaoService"
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
  colunas: ["Dia", "Texto", "X", "Y"], amostra: [["05/05/2026", "Salário", "3500,00", ""]], mapeamento: null, assinatura: "dia|texto|x|y",
}

const Transacoes = () => { const { state } = useLocation(); return <p>transações {JSON.stringify(state)}</p> }
const renderizar = () => render(
  <MemoryRouter initialEntries={["/importar"]}>
    <Routes>
      <Route path="/importar" element={<ImportarExtrato />} />
      <Route path="/transacoes" element={<Transacoes />} />
    </Routes>
  </MemoryRouter>,
)
const escolher = async (campo: string, opcao: string) => {
  await userEvent.click(await screen.findByRole("combobox", { name: campo }))
  await userEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: opcao }))
}
const subir = (nome: string) => userEvent.upload(screen.getByLabelText("Arquivo do extrato"), new File(["conteudo"], nome))

describe("ImportarExtrato", () => {
  beforeEach(() => { vi.mocked(previewImportacao).mockReset(); vi.mocked(confirmarImportacao).mockReset() })

  it("sem conta e sem arquivo: bloqueia e mostra o erro em cada campo", async () => {
    renderizar()
    await userEvent.click(await screen.findByRole("button", { name: "Ler extrato" }))
    expect(screen.getByText("Escolha a conta", { selector: "small > span" })).toBeInTheDocument()
    expect(screen.getByText("Escolha o arquivo", { selector: "small > span" })).toBeInTheDocument()
    expect(previewImportacao).not.toHaveBeenCalled()
  })

  it("arquivo que não é OFX nem CSV é recusado antes de mandar", async () => {
    renderizar()
    await escolher("Conta", "Nubank")
    // O campo só aceita .ofx/.csv; aqui alguém força outro arquivo (o filtro do navegador não é garantia).
    await userEvent.setup({ applyAccept: false }).upload(screen.getByLabelText("Arquivo do extrato"), new File(["x"], "extrato.pdf"))
    await userEvent.click(screen.getByRole("button", { name: "Ler extrato" }))
    expect(screen.getByText("Envie um arquivo .ofx ou .csv")).toBeInTheDocument()
    expect(previewImportacao).not.toHaveBeenCalled()
  })

  it("OFX: prévia com o que já está no app desmarcado; importa só as marcadas, com a chave", async () => {
    vi.mocked(previewImportacao).mockResolvedValue(PREVIA_OFX as never)
    vi.mocked(confirmarImportacao).mockResolvedValue({ importadas: 2, jaExistiam: 0 })
    renderizar()
    await escolher("Conta", "Nubank")
    await subir("nu.ofx")
    await userEvent.click(screen.getByRole("button", { name: "Ler extrato" }))

    expect(await screen.findByRole("checkbox", { name: "Importar Mercado" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Importar Padaria" })).not.toBeChecked()
    expect(screen.getByText("Já está no app")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Categoria de Mercado" })).toHaveTextContent("Alimentação")

    await userEvent.click(screen.getByRole("button", { name: "Importar 2 lançamentos" }))
    expect(confirmarImportacao).toHaveBeenCalledWith("k1", [
      expect.objectContaining({ descricao: "Mercado", categoriaId: "alim", fitId: "F1" }),
      expect.objectContaining({ descricao: "Salário", categoriaId: "sal" }),
    ], expect.any(String), null, undefined)
    expect(await screen.findByRole("heading", { name: "2 lançamentos importados" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Ver em Transações" }))
    expect(await screen.findByText(/"contaId":"k1"/)).toBeInTheDocument()
  })

  it("reenviar a mesma prévia usa a mesma chave (não importa duas vezes)", async () => {
    vi.mocked(previewImportacao).mockResolvedValue(PREVIA_OFX as never)
    vi.mocked(confirmarImportacao).mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValueOnce({ importadas: 2 })
    renderizar()
    await escolher("Conta", "Nubank")
    await subir("nu.ofx")
    await userEvent.click(screen.getByRole("button", { name: "Ler extrato" }))
    await userEvent.click(await screen.findByRole("button", { name: "Importar 2 lançamentos" }))
    expect(await screen.findByRole("alert")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Importar 2 lançamentos" }))
    const [primeira, segunda] = vi.mocked(confirmarImportacao).mock.calls
    expect(primeira[2]).toBe(segunda[2])
  })

  it("marcar todos desmarca e marca tudo", async () => {
    vi.mocked(previewImportacao).mockResolvedValue(PREVIA_OFX as never)
    renderizar()
    await escolher("Conta", "Nubank")
    await subir("nu.ofx")
    await userEvent.click(screen.getByRole("button", { name: "Ler extrato" }))
    const todos = await screen.findByRole("checkbox", { name: "Marcar todos" })
    await userEvent.click(todos)
    expect(screen.getByRole("button", { name: "Importar 3 lançamentos" })).toBeInTheDocument()
    await userEvent.click(todos)
    expect(screen.getByRole("button", { name: "Importar 0 lançamentos" })).toBeDisabled()
  })

  it("CSV não reconhecido: pergunta as colunas, lê de novo com elas e manda pra lembrar na conta", async () => {
    vi.mocked(previewImportacao)
      .mockResolvedValueOnce(PREVIA_MAPEAR as never)
      .mockResolvedValueOnce({ ...PREVIA_OFX, formato: "csv", assinatura: "dia|texto|x|y" } as never)
    vi.mocked(confirmarImportacao).mockResolvedValue({ importadas: 2 })
    renderizar()
    await escolher("Conta", "Inter")
    await subir("inter.csv")
    await userEvent.click(screen.getByRole("button", { name: "Ler extrato" }))

    expect(await screen.findByText("Qual coluna é o quê")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Dia" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Ler com essas colunas" }))
    expect(screen.getByText("Escolha a coluna da data", { selector: "small > span" })).toBeInTheDocument()

    await escolher("Data", "Dia")
    await escolher("Descrição", "Texto")
    await userEvent.click(screen.getByRole("radio", { name: "Entrada e saída separadas" }))
    await escolher("Entrada", "X")
    await escolher("Saída", "Y")
    await userEvent.click(screen.getByRole("button", { name: "Ler com essas colunas" }))

    const mapa = { data: 0, descricao: 1, valor: null, entrada: 2, saida: 3, id: null, inverterSinal: false }
    expect(previewImportacao).toHaveBeenLastCalledWith("k2", expect.any(File), mapa)
    await userEvent.click(await screen.findByRole("button", { name: "Importar 2 lançamentos" }))
    expect(confirmarImportacao).toHaveBeenCalledWith("k2", expect.any(Array), expect.any(String), mapa, "dia|texto|x|y")
  })

  it("mesma coluna em dois papéis: avisa e não lê", async () => {
    vi.mocked(previewImportacao).mockResolvedValueOnce(PREVIA_MAPEAR as never)
    renderizar()
    await escolher("Conta", "Inter")
    await subir("inter.csv")
    await userEvent.click(screen.getByRole("button", { name: "Ler extrato" }))
    await screen.findByText("Qual coluna é o quê")
    await escolher("Data", "Dia")
    await escolher("Descrição", "Dia")
    await escolher("Valor", "X")
    await userEvent.click(screen.getByRole("button", { name: "Ler com essas colunas" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Cada coluna só pode ter um papel.")
    expect(previewImportacao).toHaveBeenCalledTimes(1)
  })

  it("confirmação repetida: avisa que já tinha sido importado", async () => {
    vi.mocked(previewImportacao).mockResolvedValue(PREVIA_OFX as never)
    vi.mocked(confirmarImportacao).mockResolvedValue({ importadas: 0, repetido: true })
    renderizar()
    await escolher("Conta", "Nubank")
    await subir("nu.ofx")
    await userEvent.click(screen.getByRole("button", { name: "Ler extrato" }))
    await userEvent.click(await screen.findByRole("button", { name: "Importar 2 lançamentos" }))
    expect(await screen.findByRole("heading", { name: "Esse extrato já tinha sido importado" })).toBeInTheDocument()
  })
})
