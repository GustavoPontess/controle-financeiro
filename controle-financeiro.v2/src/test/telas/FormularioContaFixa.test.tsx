import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("../../services/recorrenteService", () => ({ createRecorrente: vi.fn(async () => ({ id: "r-nova" })), updateRecorrente: vi.fn(async () => {}) }))
vi.mock("../../services/transactionService", () => ({ updateTransaction: vi.fn(async () => ({ tipo: "contaFixa", id: "r-da-transacao" })) }))
import { createRecorrente, updateRecorrente } from "../../services/recorrenteService"
import { updateTransaction } from "../../services/transactionService"
import FormularioContaFixa from "../../telas/FormularioContaFixa"
import { descreverRegra, limitesDoInicio } from "../../dominio/contaFixa"
import { dataLocalISO, somaDias } from "../../utils/dateTime"

const contas = [
  { id: "k1", nome: "Carteira", tipo: 4, tipoDescricao: "", saldoAtual: 0, isCarteira: true },
  { id: "k2", nome: "Nubank", tipo: 1, tipoDescricao: "", saldoAtual: 0, isCarteira: false },
]
const cartoes = [{ id: "c1", nome: "Roxinho", temCredito: true, ativo: true, ultimosDigitos: "1234" }]
const categorias = [
  { id: "cat1", descricao: "Moradia", finalidade: 1, isPadrao: true },
  { id: "cat2", descricao: "Salário", finalidade: 2, isPadrao: true },
]
const renderizar = (props: Partial<Parameters<typeof FormularioContaFixa>[0]> = {}) => {
  const aoSalvo = vi.fn()
  render(<FormularioContaFixa contas={contas as never} cartoes={cartoes as never} categorias={categorias as never} aoSair={vi.fn()} aoSalvo={aoSalvo} {...props} />)
  return { aoSalvo }
}
const escolher = async (campo: string, opcao: string) => {
  await userEvent.click(screen.getByRole("combobox", { name: campo }))
  await userEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: opcao }))
}
// Datas relativas a hoje: criar só aceita começo entre 12 meses atrás e 5 anos à frente.
const EM_30_DIAS = somaDias(dataLocalISO(), 30)
const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const erroDoCampo = (texto: string) => screen.getByText(texto, { selector: "small > span" })

describe("FormularioContaFixa", () => {
  beforeEach(() => {
    vi.mocked(createRecorrente).mockClear()
    vi.mocked(updateRecorrente).mockClear()
    vi.mocked(updateTransaction).mockClear()
  })

  it("submit vazio bloqueia e mostra o erro em cada campo, inclusive como paga", async () => {
    renderizar()
    await userEvent.click(screen.getByRole("button", { name: "Criar conta fixa" }))
    expect(screen.getByText("Informe um valor")).toBeInTheDocument()
    expect(screen.getByText("Informe a descrição")).toBeInTheDocument()
    expect(erroDoCampo("Escolha como paga")).toBeInTheDocument()
    expect(erroDoCampo("Escolha a categoria")).toBeInTheDocument()
    expect(createRecorrente).not.toHaveBeenCalled()
  })

  it("não tem hora, parcela, subcategoria nem 'Já paguei'", () => {
    renderizar()
    expect(screen.queryByPlaceholderText("HH:MM")).not.toBeInTheDocument()
    expect(screen.queryByText("Parcelas")).not.toBeInTheDocument()
    expect(screen.queryByText("Subcategoria")).not.toBeInTheDocument()
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
  })

  it("débito automático numa conta: manda o meio e a regra", async () => {
    const { aoSalvo } = renderizar({ inicial: { data: EM_30_DIAS } })
    await userEvent.type(screen.getByLabelText("Valor"), "15000")
    await userEvent.type(screen.getByPlaceholderText("Aluguel"), "Internet")
    await escolher("Como paga", "Débito automático")
    await escolher("Sai da conta", "Nubank")
    await escolher("Categoria", "Moradia")
    expect(screen.getByText(`Todo dia ${Number(EM_30_DIAS.slice(8, 10))}, a partir de ${br(EM_30_DIAS)}. Sai do Nubank.`)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Criar conta fixa" }))
    expect(createRecorrente).toHaveBeenCalledWith(expect.objectContaining({
      descricao: "Internet", valor: 150, tipo: 1, categoriaId: "cat1", contaId: "k2", cartaoCreditoId: undefined,
      meioPagamento: 7, frequencia: 2, dia: Number(EM_30_DIAS.slice(8, 10)), dataInicio: EM_30_DIAS, dataFim: undefined,
    }), expect.any(String))
    expect(aoSalvo).toHaveBeenCalledWith("r-nova")
  })

  it("cartão de crédito troca a conta pelo cartão e não manda meio (o servidor grava Crédito)", async () => {
    renderizar({ inicial: { data: EM_30_DIAS, valor: "55,90", descricao: "Streaming", categoriaId: "cat1" } })
    await escolher("Como paga", "Cartão de crédito")
    expect(screen.queryByRole("combobox", { name: "Sai da conta" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Criar conta fixa" }))
    expect(erroDoCampo("Escolha o cartão")).toBeInTheDocument()
    await escolher("Cartão", "Roxinho •••• 1234")
    await userEvent.click(screen.getByRole("button", { name: "Criar conta fixa" }))
    expect(createRecorrente).toHaveBeenCalledWith(expect.objectContaining({ contaId: undefined, cartaoCreditoId: "c1", meioPagamento: undefined }), expect.any(String))
  })

  it("receita não oferece cartão nem débito automático", async () => {
    renderizar()
    await userEvent.click(screen.getByRole("radio", { name: "Receita" }))
    await userEvent.click(screen.getByRole("combobox", { name: "Como recebe" }))
    const opcoes = within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent)
    expect(opcoes).toEqual(["Pix", "TED / DOC", "Dinheiro", "Boleto"])
  })

  it("'Até' antes do começo bloqueia", async () => {
    renderizar({ recorrente: {
      id: "r1", descricao: "Aluguel", valor: 2000, tipo: 1, tipoDescricao: "", categoriaId: "cat1", contaId: "k2",
      meioPagamento: 6, frequencia: 2, frequenciaDescricao: "", dia: 10, dataInicio: "2026-05-10T00:00:00", dataFim: "2026-03-01T00:00:00",
      ativo: true, situacao: "ativa",
    } as never })
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(screen.getByText("Precisa ser depois do começo")).toBeInTheDocument()
    expect(updateRecorrente).not.toHaveBeenCalled()
  })

  it("editar a regra: vem preenchida (Boleto) e salva no PUT da conta fixa", async () => {
    const { aoSalvo } = renderizar({ recorrente: {
      id: "r1", descricao: "Aluguel", valor: 2000, tipo: 1, tipoDescricao: "", categoriaId: "cat1", contaId: "k2",
      meioPagamento: 6, frequencia: 2, frequenciaDescricao: "", dia: 10, dataInicio: "2025-01-10T00:00:00",
      ativo: true, situacao: "ativa",
    } as never })
    expect(screen.getByRole("combobox", { name: "Como paga" })).toHaveTextContent("Boleto")
    // Começo há mais de 12 meses: na edição continua valendo.
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(updateRecorrente).toHaveBeenCalledWith("r1", expect.objectContaining({ meioPagamento: 6, dataInicio: "2025-01-10", contaId: "k2" }))
    expect(aoSalvo).toHaveBeenCalledWith("r1")
  })

  it("conta fixa antiga sem meio: pede pra escolher", async () => {
    renderizar({ recorrente: {
      id: "r2", descricao: "Água", valor: 90, tipo: 1, tipoDescricao: "", categoriaId: "cat1", contaId: "k2",
      meioPagamento: null, frequencia: 2, frequenciaDescricao: "", dia: 5, dataInicio: "2026-09-05T00:00:00",
      ativo: true, situacao: "ativa",
    } as never })
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(erroDoCampo("Escolha como paga")).toBeInTheDocument()
    expect(updateRecorrente).not.toHaveBeenCalled()
  })

  it("transformar um lançamento: usa a conversão do servidor (PUT da transação com contaFixa)", async () => {
    const { aoSalvo } = renderizar({ transacao: {
      id: "t1", descricao: "Academia", valor: 120, tipo: 1, categoriaId: "cat1", contaId: "k2", meioPagamento: 4,
      statusTransacao: 1, data: "2026-10-03", hora: "07:30:00",
    } as never })
    expect(screen.getByRole("combobox", { name: "Como paga" })).toHaveTextContent("Pix")
    await userEvent.click(screen.getByRole("button", { name: "Transformar em conta fixa" }))
    expect(updateTransaction).toHaveBeenCalledWith("t1", expect.objectContaining({
      descricao: "Academia", valor: 120, contaId: "k2", cartaoCreditoId: null, meioPagamento: 4, data: "2026-10-03",
      hora: null, parcelas: null, transferencia: null, contaFixa: { frequencia: 2, dataFim: null },
    }), expect.any(String))
    expect(createRecorrente).not.toHaveBeenCalled()
    expect(aoSalvo).toHaveBeenCalledWith("r-da-transacao")
  })

  it("meio que veio de fora e não serve pro tipo começa vazio (receita em débito)", () => {
    renderizar({ inicial: { tipo: 2, meio: 2 } })
    expect(screen.getByRole("combobox", { name: "Como recebe" })).toHaveTextContent("Escolha")
  })

  it("erro do servidor aparece no topo e libera o botão", async () => {
    vi.mocked(createRecorrente).mockRejectedValueOnce({ response: { status: 400, data: { message: "Data de início fora do período permitido." } } })
    renderizar({ inicial: { data: EM_30_DIAS, valor: "10,00", descricao: "Teste", meio: 6, contaId: "k2", categoriaId: "cat1" } })
    await userEvent.click(screen.getByRole("button", { name: "Criar conta fixa" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Data de início fora do período permitido.")
    expect(screen.getByRole("button", { name: "Criar conta fixa" })).toBeEnabled()
  })
})

describe("regra por extenso", () => {
  it("mensal, semanal (todo/toda) e anual, com e sem fim", () => {
    expect(descreverRegra(2, "2026-11-10")).toBe("Todo dia 10, a partir de 10/11/2026")
    expect(descreverRegra(1, "2026-10-19")).toBe("Toda segunda-feira, a partir de 19/10/2026")
    expect(descreverRegra(1, "2026-10-17")).toBe("Todo sábado, a partir de 17/10/2026")
    expect(descreverRegra(3, "2026-06-15", "2030-06-15")).toBe("Todo ano em 15/06, a partir de 15/06/2026 até 15/06/2030")
  })
  it("limites do começo: 12 meses atrás e 5 anos à frente", () => {
    expect(limitesDoInicio("2026-10-15")).toEqual({ min: "2025-10-15", max: "2031-10-15" })
  })
})
