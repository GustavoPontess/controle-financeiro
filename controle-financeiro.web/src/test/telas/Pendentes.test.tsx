import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

vi.mock("../../services/categoryService", () => ({
  getCategories: vi.fn(async () => [
    { id: "alim", descricao: "Alimentação", finalidade: 1, isPadrao: true },
    { id: "saude", descricao: "Saúde", finalidade: 1, isPadrao: true },
    { id: "sal", descricao: "Salário", finalidade: 2, isPadrao: true },
  ]),
}))
vi.mock("../../services/subcategoryService", () => ({ getSubcategories: vi.fn(async () => []) }))
vi.mock("../../services/importacaoService", () => ({
  getPendentes: vi.fn(), getQuantidadePendentes: vi.fn(async () => 0), categorizarPendentes: vi.fn(), ensinarNome: vi.fn(),
}))
import { categorizarPendentes, ensinarNome, getPendentes } from "../../services/importacaoService"
vi.mock("../../services/anexoService", () => ({
  listarAnexos: vi.fn(async () => []), enviarAnexo: vi.fn(async () => ({})), definirLocalizacao: vi.fn(async () => undefined),
  urlDoAnexo: (t: string, a: string) => `/api/v1/transacoes/${t}/anexos/${a}`,
}))
import { enviarAnexo } from "../../services/anexoService"
vi.mock("../../services/contaService", () => ({
  getContas: vi.fn(async () => [{ id: "c1", nome: "Conta de teste" }, { id: "c2", nome: "Carteira de vale" }]),
}))
vi.mock("../../services/transferenciaService", () => ({ juntarComoTransferencia: vi.fn(async () => ({})) }))
import { juntarComoTransferencia } from "../../services/transferenciaService"
import Pendentes from "../../telas/Pendentes"

const pendente = (id: string, lugar: string, valor: number, extra: Record<string, unknown> = {}) => ({
  id, data: "2026-10-12", hora: null, descricao: `COMPRA CARTAO DEB ${lugar}`, valor, tipo: 1, origem: "Conta de teste", meioPagamento: 2,
  lugar, chave: `d:${lugar.toLowerCase()}`, categoriaSugeridaId: null, categoriaSugeridaNome: null, ...extra,
})

const renderizar = () => render(
  <MemoryRouter initialEntries={["/pendentes"]}>
    <Routes><Route path="/pendentes" element={<Pendentes />} /></Routes>
  </MemoryRouter>,
)

describe("Pendentes (fila de lançamentos sem categoria)", () => {
  beforeEach(() => { vi.mocked(getPendentes).mockReset(); vi.mocked(categorizarPendentes).mockReset(); vi.mocked(ensinarNome).mockReset() })

  // "Tô sentindo falta do qual é o nome... e das sugestões" (Gustavo, 2026-11-22).
  it("mostra nome e valor no topo e sugere categorias mesmo sem sugestão do lugar (sem Outros)", async () => {
    vi.mocked(getPendentes).mockResolvedValue({ total: 1, itens: [pendente("f1", "FARMACIA EXEMPLO", 60)] })
    renderizar()
    expect(await screen.findByRole("heading", { name: "Farmacia Exemplo" })).toBeInTheDocument()
    expect(screen.getByText("60,00")).toBeInTheDocument()
    const sugestoes = screen.getByRole("group", { name: "Sugestões de categoria pra FARMACIA EXEMPLO" })
    expect(within(sugestoes).getAllByRole("button").map((b) => b.textContent)).toEqual(["Alimentação", "Saúde"])
  })

  // A MESMA peça do Importar: as palavras da descrição, já com o nome que o app leu marcado.
  it("qual é o nome: marca as palavras; sem Usar nas próximas só renomeia, com ele ensina e relê", async () => {
    const pedacos = [{ texto: "COMPRA CARTAO DEB ", parte: "tipo" }, { texto: "FARMACIA EXEMPLO", parte: "nome" }]
    vi.mocked(getPendentes).mockResolvedValue({ total: 1, itens: [pendente("f1", "FARMACIA EXEMPLO", 60, { pedacos })] })
    vi.mocked(ensinarNome).mockResolvedValue({ nome: "FARMACIA" })
    renderizar()
    await userEvent.click(await screen.findByRole("button", { name: "Qual é o nome?" }))
    const trecho = screen.getByRole("region", { name: "Qual parte é o nome?" })
    const palavra = (w: string) => within(trecho).getByRole("button", { name: w })
    expect(palavra("FARMACIA")).toHaveAttribute("aria-pressed", "true")
    expect(palavra("EXEMPLO")).toHaveAttribute("aria-pressed", "true")

    // Tira a ponta e salva sem guardar o padrão: só o lugar muda aqui.
    await userEvent.click(palavra("EXEMPLO"))
    await userEvent.click(within(trecho).getByRole("checkbox"))
    await userEvent.click(within(trecho).getByRole("button", { name: "Salvar nome" }))
    expect(ensinarNome).not.toHaveBeenCalled()
    expect(await screen.findByRole("heading", { name: "Farmacia" })).toBeInTheDocument()

    // Com Usar nas próximas: guarda o padrão e a fila vem de novo.
    await userEvent.click(screen.getByRole("button", { name: "Qual é o nome?" }))
    const deNovo = screen.getByRole("region", { name: "Qual parte é o nome?" })
    await userEvent.click(within(deNovo).getByRole("button", { name: "Salvar nome" }))
    expect(ensinarNome).toHaveBeenCalledWith("COMPRA CARTAO DEB FARMACIA EXEMPLO", "FARMACIA EXEMPLO")
    await waitFor(() => expect(getPendentes).toHaveBeenCalledTimes(2))
  })

  it("sem nada pendente, diz que está tudo com categoria", async () => {
    vi.mocked(getPendentes).mockResolvedValue({ total: 0, itens: [] })
    renderizar()
    expect(await screen.findByText("Nada pendente")).toBeInTheDocument()
  })

  it("sem categoria não confirma; com a sugestão, grava os lançamentos do lugar e ele sai da fila", async () => {
    vi.mocked(getPendentes).mockResolvedValue({ total: 3, itens: [
      pendente("p1", "PADARIA EXEMPLO", 23.5, { categoriaSugeridaId: "alim", categoriaSugeridaNome: "Alimentação" }),
      pendente("p2", "PADARIA EXEMPLO", 18.9, { categoriaSugeridaId: "alim", categoriaSugeridaNome: "Alimentação" }),
      pendente("f1", "FARMACIA EXEMPLO", 60),
    ] })
    vi.mocked(categorizarPendentes).mockResolvedValue({ categorizados: 2, restam: 1 })
    renderizar()

    // A fila junta por lugar: a padaria (2 lançamentos) e a farmácia.
    const fila = await screen.findByRole("list", { name: "Lugares pendentes" })
    expect(within(fila).getAllByRole("listitem")).toHaveLength(2)
    expect(screen.getByText("Faltam 3")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Padaria Exemplo" })).toBeInTheDocument()

    // Sem categoria o botão não manda nada.
    const confirmar = screen.getByRole("button", { name: "Confirmar e próximo" })
    expect(confirmar).toBeDisabled()
    expect(categorizarPendentes).not.toHaveBeenCalled()

    await userEvent.click(within(screen.getByRole("group", { name: "Sugestões de categoria pra PADARIA EXEMPLO" })).getByRole("button", { name: "Alimentação" }))
    expect(confirmar).toBeEnabled()
    await userEvent.click(confirmar)

    // Os dois da padaria, com a categoria, e vira regra do lugar (o lote inteiro foi junto).
    expect(categorizarPendentes).toHaveBeenCalledWith(["p1", "p2"], "alim", null, true, [])
    // A padaria saiu; sobra a farmácia, já aberta.
    expect(await screen.findByRole("heading", { name: "Farmacia Exemplo" })).toBeInTheDocument()
    expect(within(screen.getByRole("list", { name: "Lugares pendentes" })).getAllByRole("listitem")).toHaveLength(1)
    expect(screen.getByText("Falta 1")).toBeInTheDocument()
  })

  it("foi entre minhas contas: sem conta não junta; com a conta, cada lançamento vira transferência e o lugar sai", async () => {
    vi.mocked(getPendentes).mockResolvedValue({ total: 3, itens: [
      pendente("v1", "VALE EXEMPLO", 1144, { tipo: 2, meioPagamento: null }),
      pendente("v2", "VALE EXEMPLO", 1144, { tipo: 2, meioPagamento: null }),
      pendente("f1", "FARMACIA EXEMPLO", 60),
    ] })
    renderizar()

    await screen.findByRole("heading", { name: "Vale Exemplo" })
    await userEvent.click(screen.getByRole("button", { name: "Foi entre minhas contas" }))
    await userEvent.click(screen.getByRole("button", { name: "Juntar os 2" }))
    expect(await screen.findByText("Escolha a conta")).toBeInTheDocument()
    expect(juntarComoTransferencia).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("combobox", { name: "Veio da conta" }))
    // A própria conta do lançamento não aparece.
    expect(within(screen.getByRole("listbox")).queryByRole("option", { name: "Conta de teste" })).not.toBeInTheDocument()
    await userEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Carteira de vale" }))
    await userEvent.click(screen.getByRole("button", { name: "Juntar os 2" }))

    expect(vi.mocked(juntarComoTransferencia).mock.calls.map((c) => [c[0], c[1]])).toEqual([["v1", "c2"], ["v2", "c2"]])
    expect(await screen.findByRole("heading", { name: "Farmacia Exemplo" })).toBeInTheDocument()
    expect(screen.getByText("Falta 1")).toBeInTheDocument()
  })

  it("tirar um lançamento do lote categoriza só os marcados e não vira regra do lugar", async () => {
    vi.mocked(getPendentes).mockResolvedValue({ total: 2, itens: [pendente("p1", "PADARIA EXEMPLO", 23.5), pendente("p2", "PADARIA EXEMPLO", 18.9)] })
    vi.mocked(categorizarPendentes).mockResolvedValue({ categorizados: 1, restam: 1 })
    renderizar()

    await screen.findByRole("heading", { name: "Padaria Exemplo" })
    await userEvent.click(screen.getAllByRole("checkbox")[1])
    await userEvent.click(screen.getByRole("combobox", { name: "Categoria" }))
    await userEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Alimentação" }))
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }))

    expect(categorizarPendentes).toHaveBeenCalledWith(["p1"], "alim", null, false, [])
  })

  // "Cadê localização, cadê o documento? Tá faltando campo" (Gustavo, 2026-11-22).
  it("a ficha tem os mesmos campos da transação, e o que a pessoa acerta vai junto com a categoria", async () => {
    vi.mocked(getPendentes).mockResolvedValue({ total: 1, itens: [pendente("p1", "PADARIA EXEMPLO", 23.5, { categoriaSugeridaId: "alim" })] })
    vi.mocked(categorizarPendentes).mockResolvedValue({ categorizados: 1, restam: 0 })
    renderizar()

    const descricao = await screen.findByLabelText("Descrição")
    expect(descricao).toHaveValue("COMPRA CARTAO DEB PADARIA EXEMPLO")
    expect(screen.getByRole("combobox", { name: "Pago com" })).toHaveTextContent("Débito")
    expect(screen.getByText("Localização")).toBeInTheDocument()
    expect(screen.getByText("Anexos")).toBeInTheDocument()

    await userEvent.clear(descricao)
    await userEvent.type(descricao, "Pão de sábado")
    await userEvent.click(screen.getByRole("button", { name: "Editar hora" }))
    await userEvent.type(screen.getByLabelText("Hora"), "0830")
    await userEvent.upload(document.querySelector('input[type="file"]') as HTMLInputElement, new File(["x"], "nota.png", { type: "image/png" }))
    await userEvent.click(within(screen.getByRole("group", { name: "Sugestões de categoria pra PADARIA EXEMPLO" })).getByRole("button", { name: "Alimentação" }))
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }))

    expect(categorizarPendentes).toHaveBeenCalledWith(["p1"], "alim", null, true, [{ transacaoId: "p1", descricao: "Pão de sábado", hora: "08:30:00" }])
    expect(enviarAnexo).toHaveBeenCalledWith("p1", expect.any(File))
    expect(await screen.findByText("Nada pendente")).toBeInTheDocument()
  })

  it("erro do servidor aparece e o lugar continua na fila", async () => {
    vi.mocked(getPendentes).mockResolvedValue({ total: 1, itens: [pendente("p1", "PADARIA EXEMPLO", 23.5, { categoriaSugeridaId: "alim" })] })
    vi.mocked(categorizarPendentes).mockRejectedValue(new Error("falhou"))
    renderizar()

    await userEvent.click(within(await screen.findByRole("group", { name: "Sugestões de categoria pra PADARIA EXEMPLO" })).getByRole("button", { name: "Alimentação" }))
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }))

    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Padaria Exemplo" })).toBeInTheDocument()
  })
})
