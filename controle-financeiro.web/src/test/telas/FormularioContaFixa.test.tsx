import { beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("../../services/recorrenteService", () => ({ createRecorrente: vi.fn(async () => ({ id: "r-nova" })), updateRecorrente: vi.fn(async () => {}) }))
vi.mock("../../services/familiaService", () => ({ getFamilias: vi.fn(async () => []) }))
import { createRecorrente, updateRecorrente } from "../../services/recorrenteService"
import { getFamilias } from "../../services/familiaService"
import FormularioContaFixa from "../../telas/FormularioContaFixa"
import { descreverRegra, limitesDoInicio } from "../../dominio/contaFixa"
import { dataLocalISO } from "../../utils/dateTime"

const contas = [
  { id: "k1", nome: "Carteira", tipo: 4, tipoDescricao: "", saldoAtual: 0, isCarteira: true },
  { id: "k2", nome: "Nubank", tipo: 1, tipoDescricao: "", saldoAtual: 0, isCarteira: false },
]
const cartoes = [{ id: "c1", nome: "Roxinho", temCredito: true, ativo: true, ultimosDigitos: "1234" }]
const categorias = [
  { id: "cat1", descricao: "Moradia", finalidade: 1, isPadrao: true },
  { id: "cat2", descricao: "Salário", finalidade: 2, isPadrao: true },
]
const subcategorias = [
  { id: "s1", nome: "Aluguel", categoriaId: "cat1", isPadrao: true },
  { id: "s2", nome: "Condomínio", categoriaId: "cat1", isPadrao: true },
  { id: "s3", nome: "Bônus", categoriaId: "cat2", isPadrao: true },
]
const regra = (r: Record<string, unknown>) => ({
  id: "r1", descricao: "Aluguel", valor: 2000, tipo: 1, tipoDescricao: "", categoriaId: "cat1", contaId: "k2",
  meioPagamento: 6, frequencia: 2, frequenciaDescricao: "", dia: 10, dataInicio: "2026-05-10T00:00:00",
  ativo: true, situacao: "ativa", ...r,
}) as never
const renderizar = (props: Partial<Parameters<typeof FormularioContaFixa>[0]> = {}) => {
  const aoSalvo = vi.fn()
  render(<FormularioContaFixa contas={contas as never} cartoes={cartoes as never} categorias={categorias as never}
    subcategorias={subcategorias as never} aoSair={vi.fn()} aoSalvo={aoSalvo} {...props} />)
  return { aoSalvo }
}
const escolher = async (campo: string, opcao: string) => {
  await userEvent.click(screen.getByRole("combobox", { name: campo }))
  await userEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: opcao }))
}
const preencher = async (valor: string, descricao: string) => {
  await userEvent.type(screen.getByLabelText("Valor"), valor)
  await userEvent.type(screen.getByPlaceholderText("Aluguel"), descricao)
}
// A primeira cobrança começa hoje (dentro do limite de criar: 12 meses atrás a 5 anos à frente).
const HOJE = dataLocalISO()
const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const erroDoCampo = (texto: string) => screen.getByText(texto, { selector: "small > span" })

describe("FormularioContaFixa", () => {
  beforeEach(() => {
    vi.mocked(createRecorrente).mockClear()
    vi.mocked(updateRecorrente).mockClear()
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

  it("não tem hora, parcela nem 'Já paguei'", () => {
    renderizar()
    expect(screen.queryByPlaceholderText("HH:MM")).not.toBeInTheDocument()
    expect(screen.queryByText("Parcelas")).not.toBeInTheDocument()
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
  })

  it("subcategoria: só as da categoria escolhida, opcional, e troca de categoria limpa", async () => {
    renderizar()
    expect(screen.getByRole("combobox", { name: "Subcategoria" })).toBeDisabled()
    await escolher("Categoria", "Moradia")
    await userEvent.click(screen.getByRole("combobox", { name: "Subcategoria" }))
    const opcoes = within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent)
    expect(opcoes).toEqual(["Sem subcategoria", "Aluguel", "Condomínio"])
    await userEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Aluguel" }))
    expect(screen.getByText(/Moradia › Aluguel/)).toBeInTheDocument()

    await preencher("200000", "Aluguel")
    await escolher("Como paga", "Boleto")
    await escolher("Sai da conta", "Nubank")
    await userEvent.click(screen.getByRole("button", { name: "Criar conta fixa" }))
    expect(createRecorrente).toHaveBeenCalledWith(expect.objectContaining({ categoriaId: "cat1", subcategoriaId: "s1" }), expect.any(String))

    await userEvent.click(screen.getByRole("radio", { name: "Receita" }))
    expect(screen.getByRole("combobox", { name: "Subcategoria" })).toHaveTextContent("Nenhuma")
  })

  it("sem subcategoria não manda o campo", async () => {
    renderizar({ recorrente: regra({}) })
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(updateRecorrente).toHaveBeenCalledWith("r1", expect.objectContaining({ subcategoriaId: undefined }))
  })

  it("débito automático numa conta: manda o meio e a regra", async () => {
    const { aoSalvo } = renderizar()
    await preencher("15000", "Internet")
    await escolher("Como paga", "Débito automático")
    await escolher("Sai da conta", "Nubank")
    await escolher("Categoria", "Moradia")
    expect(screen.getByText(`Todo dia ${Number(HOJE.slice(8, 10))}, a partir de ${br(HOJE)}. Sai do Nubank.`)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Criar conta fixa" }))
    expect(createRecorrente).toHaveBeenCalledWith(expect.objectContaining({
      descricao: "Internet", valor: 150, tipo: 1, categoriaId: "cat1", contaId: "k2", cartaoCreditoId: undefined,
      meioPagamento: 7, frequencia: 2, dia: Number(HOJE.slice(8, 10)), dataInicio: HOJE, dataFim: undefined,
    }), expect.any(String))
    expect(aoSalvo).toHaveBeenCalledWith("r-nova")
  })

  it("cartão de crédito troca a conta pelo cartão e não manda meio (o servidor grava Crédito)", async () => {
    renderizar()
    await preencher("5590", "Streaming")
    await escolher("Categoria", "Moradia")
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
    renderizar({ recorrente: regra({ dataFim: "2026-03-01T00:00:00" }) })
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(screen.getByText("Precisa ser depois do começo")).toBeInTheDocument()
    expect(updateRecorrente).not.toHaveBeenCalled()
  })

  it("editar a regra: vem preenchida (Boleto, Aluguel) e salva no PUT da conta fixa", async () => {
    // Começo há mais de 12 meses: na edição continua valendo.
    const { aoSalvo } = renderizar({ recorrente: regra({ dataInicio: "2025-01-10T00:00:00", subcategoriaId: "s1", subcategoriaNome: "Aluguel" }) })
    expect(screen.getByRole("combobox", { name: "Como paga" })).toHaveTextContent("Boleto")
    expect(screen.getByRole("combobox", { name: "Subcategoria" })).toHaveTextContent("Aluguel")
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(updateRecorrente).toHaveBeenCalledWith("r1", expect.objectContaining({ meioPagamento: 6, dataInicio: "2025-01-10", contaId: "k2", subcategoriaId: "s1" }))
    expect(aoSalvo).toHaveBeenCalledWith("r1")
  })

  it("conta fixa antiga sem meio: pede pra escolher", async () => {
    renderizar({ recorrente: regra({ meioPagamento: null }) })
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(erroDoCampo("Escolha como paga")).toBeInTheDocument()
    expect(updateRecorrente).not.toHaveBeenCalled()
  })

  it("meio gravado que não serve pro tipo começa vazio (receita em débito)", () => {
    renderizar({ recorrente: regra({ tipo: 2, categoriaId: "cat2", meioPagamento: 2 }) })
    expect(screen.getByRole("combobox", { name: "Como recebe" })).toHaveTextContent("Escolha")
  })

  it("erro do servidor aparece no topo e libera o botão", async () => {
    vi.mocked(createRecorrente).mockRejectedValueOnce({ response: { status: 400, data: { message: "Data de início fora do período permitido." } } })
    renderizar()
    await preencher("1000", "Teste")
    await escolher("Como paga", "Boleto")
    await escolher("Sai da conta", "Nubank")
    await escolher("Categoria", "Moradia")
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

  it("conta da casa: 'Dividir com a família' manda a família; desligar manda null; receita não divide", async () => {
    vi.mocked(getFamilias).mockResolvedValue([{ id: "f1", nome: "Casa Pontes", criadoPorUsuarioId: "u1", criadoEm: "", ehAdmin: true, totalMembros: 2 }])
    renderizar({ recorrente: regra({ familiaId: "f1" }) })
    const interruptor = await screen.findByRole("switch", { name: "Dividir com Casa Pontes" })
    expect(interruptor).toHaveAttribute("aria-checked", "true")
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(updateRecorrente).toHaveBeenLastCalledWith("r1", expect.objectContaining({ familiaId: "f1" }))

    cleanup()
    renderizar({ recorrente: regra({ familiaId: "f1" }) })
    await userEvent.click(await screen.findByRole("switch", { name: "Dividir com Casa Pontes" }))
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(updateRecorrente).toHaveBeenLastCalledWith("r1", expect.objectContaining({ familiaId: null }))

    cleanup()
    renderizar({ recorrente: regra({ tipo: 2, categoriaId: "cat2", meioPagamento: 4 }) })
    await waitFor(() => expect(getFamilias).toHaveBeenCalled())
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    vi.mocked(getFamilias).mockResolvedValue([])
  })
})
