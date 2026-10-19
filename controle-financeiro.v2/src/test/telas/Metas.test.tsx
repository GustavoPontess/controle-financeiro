import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import type { Meta, MovimentoMeta as Movimento } from "../../types/Meta"
import type { Conta } from "../../types/Conta"

const meta = (extra: Partial<Meta>): Meta => ({
  id: "m1", nome: "Entrada do apê", descricao: null, icone: "casa", valorAlvo: 60000, guardado: 5000, falta: 55000, percentualConcluido: 8.33,
  concluida: false, dataLimite: "2027-12-01T00:00:00", mesesRestantes: 16, porMes: 3437.5, situacao: "atras", contaId: "cx1",
  usuarioId: "u1", familiaId: null, categoriaId: null, ativo: true, criadoEm: "2026-06-01T00:00:00", atualizadoEm: "2026-10-01T00:00:00",
  concluidaEm: null, valorJuntado: null, ...extra,
})
const conta = (id: string, nome: string, saldoAtual: number): Conta => ({ id, nome, tipo: 1, tipoDescricao: "Conta Corrente", saldoAtual, isCarteira: false })
let metas: Meta[] = []
let contas: Conta[] = []
let historico: Movimento[] = []
vi.mock("../../services/metaService", () => ({
  getMetas: vi.fn(async () => metas),
  getMeta: vi.fn(async (id: string) => metas.find((m) => m.id === id)),
  getHistoricoMeta: vi.fn(async () => historico),
  criarMeta: vi.fn(async (dto: { nome: string }) => ({ ...meta({}), id: "m9", nome: dto.nome })),
  atualizarMeta: vi.fn(async () => meta({})),
  excluirMeta: vi.fn(async () => {}),
  guardarNaMeta: vi.fn(async () => meta({})),
  resgatarDaMeta: vi.fn(async () => meta({})),
  concluirMeta: vi.fn(async () => meta({})),
  getViabilidadeDasMetas: vi.fn(async () => ({
    pedemPorMes: 2800, folga: 1000,
    resposta: { tom: "alerta", texto: "As metas pedem R$ 2.800,00 por mês, mas sobram uns R$ 1.000,00. Pra caber, estique o prazo de Entrada do apê pra março de 2029.",
      acoes: [{ rotulo: "Ajustar Entrada do apê", para: "/metas/m1/editar" }] },
  })),
  getViabilidadeMeta: vi.fn(async () => ({
    porMes: 1666.67, meses: 3, folga: 200, rendaEsperada: 3000, gastoTipico: 2000, outrasMetasPorMes: 800, parcelasPorMes: 0, prazoQueCabe: "2028-10-01",
    resposta: { tom: "alerta", texto: "Precisa guardar R$ 1.666,67 por mês, mas sobram uns R$ 200,00.", acoes: [] },
  })),
}))
vi.mock("../../services/contaService", () => ({ getContas: vi.fn(async () => contas) }))
import { concluirMeta, criarMeta, excluirMeta, getMetas, getViabilidadeMeta, guardarNaMeta, resgatarDaMeta } from "../../services/metaService"
import Metas from "../../telas/Metas"
import MetaFormulario from "../../telas/MetaFormulario"
import MetaPagina from "../../telas/MetaPagina"
import MovimentoMeta from "../../telas/MovimentoMeta"

const Onde = () => <p>em {useLocation().pathname}</p>
const renderizar = (inicio: string, { lista = false, pagina = false } = {}) => render(
  <MemoryRouter initialEntries={[inicio]}>
    <Routes>
      <Route path="/metas" element={lista ? <Metas /> : <Onde />} />
      <Route path="/metas/nova" element={<MetaFormulario />} />
      <Route path="/metas/:id" element={pagina ? <MetaPagina /> : <Onde />} />
      <Route path="/metas/:id/editar" element={<MetaFormulario />} />
      <Route path="/metas/:id/guardar" element={<MovimentoMeta modo="guardar" />} />
      <Route path="/metas/:id/resgatar" element={<MovimentoMeta modo="resgatar" />} />
      <Route path="/metas/:id/concluir" element={<MovimentoMeta modo="concluir" />} />
    </Routes>
  </MemoryRouter>,
)

describe("Metas (caixinhas)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    metas = [
      meta({}),
      meta({ id: "m2", nome: "Reserva de emergência", icone: "emergencia", valorAlvo: 10000, guardado: 2300, falta: 7700, percentualConcluido: 23, dataLimite: null, mesesRestantes: null, porMes: null, situacao: "sem-prazo" }),
      meta({ id: "m3", nome: "Viagem de férias", icone: "viagem", valorAlvo: 6000, guardado: 6000, falta: 0, percentualConcluido: 100, dataLimite: "2027-03-01T00:00:00", porMes: null, situacao: "chegou-la" }),
      meta({ id: "m4", nome: "Notebook novo", icone: "celular", valorAlvo: 3500, guardado: 0, falta: 0, percentualConcluido: 100, concluida: true, porMes: null, situacao: "concluida", concluidaEm: "2026-10-19T02:00:00", valorJuntado: 3500 }),
    ]
    contas = [conta("c1", "Conta Corrente", 3000), conta("c2", "Poupança", 300)]
    historico = [
      { transferenciaId: "t2", data: "2026-10-10T00:00:00", tipo: "resgatou", contaId: "c2", contaNome: "Poupança", valor: 500 },
      { transferenciaId: "t1", data: "2026-10-01T00:00:00", tipo: "guardou", contaId: "c1", contaNome: "Conta Corrente", valor: 5500 },
    ]
  })

  it("lista: só as pessoais; faixa soma guardado, falta e o por mês; Chegou lá fica em andamento; Concluídas só as marcadas", async () => {
    const user = userEvent.setup()
    renderizar("/metas", { lista: true })
    const grade = await screen.findByRole("list", { name: "Metas" })

    expect(getMetas).toHaveBeenCalledWith(true)
    expect(screen.getByText("R$ 13.300,00")).toBeInTheDocument() // guardado: 5000 + 2300 + 6000 (a concluída já usou o dela)
    expect(screen.getByText("R$ 62.700,00")).toBeInTheDocument() // falta: só das em andamento
    const cartoes = within(grade).getAllByRole("link")
    expect(cartoes).toHaveLength(3) // em andamento: o prazo mais perto primeiro, depois sem prazo
    expect(cartoes[0]).toHaveTextContent("Viagem de férias")
    expect(cartoes[0]).toHaveTextContent("Chegou lá") // bateu o valor, mas só vai pra Concluídas quando marcar
    expect(cartoes[1]).toHaveTextContent("Entrada do apê")
    expect(cartoes[1]).toHaveTextContent("Atrás do ritmo")
    expect(cartoes[1]).toHaveTextContent("Até dez/2027")
    expect(cartoes[1]).toHaveAttribute("href", "/metas/m1")
    expect(cartoes[2]).toHaveTextContent("Sem prazo")
    expect(screen.getByRole("button", { name: /Nova meta/ })).toBeInTheDocument()

    await user.click(screen.getByRole("radio", { name: "Concluídas (1)" }))
    const concluida = within(screen.getByRole("list", { name: "Metas" })).getByRole("link")
    expect(concluida).toHaveTextContent("Notebook novo") // marcada: mostra o que juntou e quando
    expect(concluida).toHaveTextContent("R$ 3.500,00")
    expect(concluida).toHaveTextContent("Concluída em out/2026")
  })

  it("chegou lá: Concluir e usar o dinheiro leva o guardado todo pra conta escolhida", async () => {
    const user = userEvent.setup()
    renderizar("/metas/m3", { pagina: true })
    await user.click(await screen.findByRole("button", { name: "Concluir e usar o dinheiro" }))
    expect(await screen.findByRole("heading", { name: "Concluir Viagem de férias" })).toBeInTheDocument()
    expect(screen.getAllByText("R$ 6.000,00").length).toBeGreaterThan(1) // guardado no resumo e o valor fixo

    await user.click(screen.getByRole("button", { name: "Concluir meta" }))
    expect(screen.getByText("Escolha pra qual conta vai o dinheiro.")).toBeInTheDocument()
    expect(concluirMeta).not.toHaveBeenCalled()
    await user.click(screen.getByRole("combobox"))
    await user.click(screen.getByRole("option", { name: /Conta Corrente/ }))
    await user.click(screen.getByRole("button", { name: "Concluir meta" }))
    expect(concluirMeta).toHaveBeenCalledWith("m3", "c1", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), expect.any(String))
    expect(await screen.findByRole("heading", { name: "Viagem de férias" })).toBeInTheDocument() // volta pra página da meta
  })

  it("concluída é registro: só o que juntou e o histórico; o único botão cria outra igual, zerada", async () => {
    const user = userEvent.setup()
    renderizar("/metas/m4", { pagina: true })
    expect(await screen.findByText("Juntou")).toBeInTheDocument()
    expect(screen.getAllByText("R$ 3.500,00").length).toBeGreaterThan(0)
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Criar outra igual"])

    await user.click(screen.getByRole("button", { name: "Criar outra igual" }))
    expect(await screen.findByRole("heading", { name: "Nova meta" })).toBeInTheDocument()
    expect(screen.getByLabelText("Nome")).toHaveValue("Notebook novo")
    expect(screen.getByLabelText("Quanto quer juntar")).toHaveValue("3.500,00")
    expect(screen.getByRole("radio", { name: "Celular" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("switch")).toBeChecked() // a original tinha prazo: a nova também (mesma duração)
  })

  it("página da meta: guardado, histórico de guardar e resgatar, e Guardar/Resgatar levam pras telas", async () => {
    const user = userEvent.setup()
    renderizar("/metas/m1", { pagina: true })

    expect(await screen.findByRole("heading", { name: "Entrada do apê" })).toBeInTheDocument()
    expect(screen.getByText("Até dezembro de 2027")).toBeInTheDocument()
    expect(await screen.findByText("de Conta Corrente")).toBeInTheDocument()
    expect(screen.getByText("pra Poupança")).toBeInTheDocument()
    expect(screen.getByText("Guardou")).toBeInTheDocument()
    expect(screen.getByText("Resgatou")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Resgatar" }))
    expect(await screen.findByRole("heading", { name: "Resgatar de Entrada do apê" })).toBeInTheDocument()
  })

  it("excluir com dinheiro guardado pede pra resgatar antes; zerada, confirma e exclui", async () => {
    const user = userEvent.setup()
    const { unmount } = renderizar("/metas/m1", { pagina: true })
    await user.click(await screen.findByRole("button", { name: "Excluir" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Resgate pra uma conta antes de excluir")
    expect(excluirMeta).not.toHaveBeenCalled()
    unmount()

    metas = [meta({ guardado: 0, falta: 60000, percentualConcluido: 0 })]
    historico = []
    renderizar("/metas/m1", { pagina: true })
    expect(await screen.findByText("Nada guardado ainda.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Resgatar" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Excluir" }))
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }))
    expect(excluirMeta).toHaveBeenCalledWith("m1")
    expect(await screen.findByText("em /metas")).toBeInTheDocument()
  })

  it("nova meta: submit vazio bloqueia com erros; sugestão preenche nome e ícone; cria e vai pra página dela", async () => {
    const user = userEvent.setup()
    renderizar("/metas/nova")
    await user.click(await screen.findByRole("button", { name: "Criar meta" }))
    expect(screen.getByText("Dê um nome pra meta.")).toBeInTheDocument()
    expect(screen.getByText("Diga quanto quer juntar.")).toBeInTheDocument()
    expect(screen.getByText("Escolha o mês e o ano.")).toBeInTheDocument()
    expect(criarMeta).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Viagem" }))
    expect(screen.getByLabelText("Nome")).toHaveValue("Viagem")
    expect(screen.getByRole("radio", { name: "Viagem" })).toHaveAttribute("aria-checked", "true")
    await user.type(screen.getByLabelText("Quanto quer juntar"), "500000")
    await user.click(screen.getByRole("switch"))
    await user.click(screen.getByRole("button", { name: "Criar meta" }))
    expect(criarMeta).toHaveBeenCalledWith({ nome: "Viagem", valorAlvo: 5000, dataLimite: null, icone: "viagem" })
    expect(await screen.findByText("em /metas/m9")).toBeInTheDocument()
  })

  it("nova meta: responde se cabe enquanto preenche e oferece o mês em que dá pra chegar como prazo", async () => {
    const user = userEvent.setup()
    renderizar("/metas/nova")
    await user.type(await screen.findByLabelText("Quanto quer juntar"), "500000")
    const [mes, ano] = screen.getAllByRole("combobox")
    await user.click(mes)
    await user.click(screen.getByRole("option", { name: "Dezembro" }))
    await user.click(ano)
    await user.click(screen.getByRole("option", { name: String(new Date().getFullYear()) }))

    expect(await screen.findByText("Precisa guardar R$ 1.666,67 por mês, mas sobram uns R$ 200,00.")).toBeInTheDocument()
    expect(getViabilidadeMeta).toHaveBeenLastCalledWith(5000, `${new Date().getFullYear()}-12-01`, undefined)
    await user.click(screen.getByRole("button", { name: "Usar outubro de 2028 como prazo" }))
    const [mesDepois, anoDepois] = screen.getAllByRole("combobox")
    expect(mesDepois).toHaveTextContent("Outubro")
    expect(anoDepois).toHaveTextContent("2028")
  })

  it("guardar: não passa do saldo da conta; guarda com a mesma chave e volta pra página da meta", async () => {
    const user = userEvent.setup()
    renderizar("/metas/m1/guardar")
    expect(await screen.findByRole("heading", { name: "Guardar em Entrada do apê" })).toBeInTheDocument()
    // Duas contas com saldo: nenhuma vem escolhida.
    await user.click(screen.getByRole("button", { name: "Guardar" }))
    expect(screen.getByText("Escolha de qual conta sai.")).toBeInTheDocument()

    await user.click(screen.getByRole("combobox"))
    await user.click(screen.getByRole("option", { name: /Poupança/ }))
    await user.type(screen.getByLabelText("Quanto"), "50000")
    await user.click(screen.getByRole("button", { name: "Guardar" }))
    expect(screen.getByText("Só tem R$ 300,00 nessa conta.")).toBeInTheDocument()
    expect(guardarNaMeta).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: /Guardar tudo que tem na conta/ }))
    await user.click(screen.getByRole("button", { name: "Guardar" }))
    expect(guardarNaMeta).toHaveBeenCalledWith("m1", "c2", 300, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), expect.any(String))
    expect(await screen.findByText("em /metas/m1")).toBeInTheDocument()
  })

  it("resgatar: não passa do guardado na meta", async () => {
    const user = userEvent.setup()
    contas = [conta("c1", "Conta Corrente", 3000)]
    renderizar("/metas/m1/resgatar")
    expect(await screen.findByRole("heading", { name: "Resgatar de Entrada do apê" })).toBeInTheDocument()
    await user.type(screen.getByLabelText("Quanto"), "600000") // conta única já vem escolhida
    await user.click(screen.getByRole("button", { name: "Resgatar" }))
    expect(screen.getByText("A meta só tem R$ 5.000,00 guardado.")).toBeInTheDocument()
    expect(resgatarDaMeta).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: /Resgatar tudo/ }))
    await user.click(screen.getByRole("button", { name: "Resgatar" }))
    expect(resgatarDaMeta).toHaveBeenCalledWith("m1", "c1", 5000, expect.any(String), expect.any(String))
  })
})

describe("Metas: as metas juntas cabem?", () => {
  beforeEach(() => { vi.clearAllMocks(); metas = [meta({})]; contas = [] })

  it("a lista responde com o que as metas pedem × a folga e leva pra ajustar o prazo da que mais pede", async () => {
    renderizar("/metas", { lista: true })
    expect(await screen.findByText(/As metas pedem R\$\s2\.800,00 por mês, mas sobram/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Ajustar Entrada do apê" }))
    expect(await screen.findByRole("heading", { name: /Editar meta|Entrada do apê/ })).toBeInTheDocument()
  })
})
