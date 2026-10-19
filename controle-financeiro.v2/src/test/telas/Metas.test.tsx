import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import type { ContaLivre, Meta } from "../../types/Meta"

const meta = (extra: Partial<Meta>): Meta => ({
  id: "m1", nome: "Entrada do apê", descricao: null, valorAlvo: 60000, guardado: 5000, falta: 55000, percentualConcluido: 8.33,
  concluida: false, dataLimite: "2027-12-01T00:00:00", mesesRestantes: 16, porMes: 3437.5, situacao: "atras",
  reservas: [
    { contaId: "c1", contaNome: "Conta Corrente", bancoNome: "Nubank", bancoCor: null, valor: 1500 },
    { contaId: "c2", contaNome: "Poupança", bancoNome: "Inter", bancoCor: null, valor: 3500 },
  ],
  usuarioId: "u1", familiaId: null, categoriaId: null, ativo: true, criadoEm: "2026-06-01", atualizadoEm: "2026-10-01", ...extra,
})
let metas: Meta[] = []
let contas: ContaLivre[] = []
vi.mock("../../services/metaService", () => ({
  getMetas: vi.fn(async () => metas),
  getMeta: vi.fn(async (id: string) => metas.find((m) => m.id === id)),
  getContasLivres: vi.fn(async () => contas),
  criarMeta: vi.fn(async (dto: { nome: string }) => ({ ...meta({}), id: "nova", nome: dto.nome })),
  atualizarMeta: vi.fn(async () => meta({})),
  excluirMeta: vi.fn(async () => {}),
  guardarNaMeta: vi.fn(async () => meta({})),
  tirarDaMeta: vi.fn(async () => meta({})),
}))
import { criarMeta, excluirMeta, getMetas, guardarNaMeta, tirarDaMeta } from "../../services/metaService"
import Metas from "../../telas/Metas"
import MetaFormulario from "../../telas/MetaFormulario"
import MovimentoMeta from "../../telas/MovimentoMeta"

const Lista = () => { const { state } = useLocation(); return <p>lista de metas {JSON.stringify(state)}</p> }
const renderizar = (inicio: string, lista = false) => render(
  <MemoryRouter initialEntries={[inicio]}>
    <Routes>
      <Route path="/metas" element={lista ? <Metas /> : <Lista />} />
      <Route path="/metas/nova" element={<MetaFormulario />} />
      <Route path="/metas/:id/editar" element={<MetaFormulario />} />
      <Route path="/metas/:id/guardar" element={<MovimentoMeta modo="guardar" />} />
      <Route path="/metas/:id/tirar" element={<MovimentoMeta modo="tirar" />} />
    </Routes>
  </MemoryRouter>,
)

describe("Metas (modelo de reserva)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    metas = [
      meta({}),
      meta({ id: "m2", nome: "Reserva de emergência", valorAlvo: 10000, guardado: 2300, falta: 7700, percentualConcluido: 23, dataLimite: null, mesesRestantes: null, porMes: null, situacao: "sem-prazo", reservas: [{ contaId: "c2", contaNome: "Poupança", bancoNome: "Inter", bancoCor: null, valor: 2300 }] }),
      meta({ id: "m3", nome: "Viagem de férias", valorAlvo: 6000, guardado: 6000, falta: 0, percentualConcluido: 100, concluida: true, porMes: null, situacao: "concluida", reservas: [] }),
    ]
    contas = [
      { contaId: "c1", nome: "Conta Corrente", bancoNome: "Nubank", bancoCor: null, saldo: 3000, reservado: 1500, livre: 1500 },
      { contaId: "c2", nome: "Poupança", bancoNome: "Inter", bancoCor: null, saldo: 6100, reservado: 5800, livre: 300 },
    ]
  })

  it("lista: só as pessoais; faixa soma guardado, falta e o por mês; situação na linha; ficha mostra onde está guardado; concluídas à parte", async () => {
    renderizar("/metas", true)
    const lista = await screen.findByRole("list", { name: "Metas" })
    expect(getMetas).toHaveBeenCalledWith(true)
    expect(screen.getByText("Guardado nas metas").parentElement).toHaveTextContent("13.300,00")
    expect(screen.getByText("Falta").parentElement).toHaveTextContent("62.700,00")
    expect(screen.getByText("Por mês pra chegar no prazo").parentElement).toHaveTextContent("3.437,50")
    const andamento = within(lista).getByRole("list", { name: "Em andamento" })
    expect(andamento).toHaveTextContent("Atrás do ritmo")
    expect(andamento).toHaveTextContent("até dez/2027")
    expect(andamento).toHaveTextContent("sem prazo")
    expect(within(lista).getByRole("list", { name: "Concluídas" })).toHaveTextContent("Chegou lá")

    await userEvent.click(within(andamento).getByRole("button", { name: /Entrada do apê/ }))
    const guardado = screen.getByRole("list", { name: "Onde está guardado" })
    expect(guardado).toHaveTextContent("Conta Corrente")
    expect(guardado).toHaveTextContent("1.500,00")
    expect(guardado).toHaveTextContent("3.500,00")
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tirar" })).toBeInTheDocument()
  })

  it("excluir pede confirmação e avisa que o dinheiro volta a ficar livre", async () => {
    renderizar("/metas", true)
    await userEvent.click(await screen.findByRole("button", { name: /Entrada do apê/ }))
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }))
    const dialogo = await screen.findByRole("alertdialog")
    expect(dialogo).toHaveTextContent("volta a ficar livre")
    await userEvent.click(within(dialogo).getByRole("button", { name: "Excluir" }))
    expect(excluirMeta).toHaveBeenCalledWith("m1")
  })

  it("nova meta: vazio bloqueia com erro em cada campo; prazo pede mês e ano; payload exato", async () => {
    renderizar("/metas/nova")
    await userEvent.click(screen.getByRole("button", { name: "Criar meta" }))
    expect(screen.getByText("Dê um nome pra meta.")).toBeInTheDocument()
    expect(screen.getByText("Diga quanto quer juntar.")).toBeInTheDocument()
    expect(screen.getByText("Escolha o mês e o ano.")).toBeInTheDocument()
    expect(criarMeta).not.toHaveBeenCalled()

    await userEvent.type(screen.getByRole("textbox", { name: "Nome" }), " Carro novo ")
    await userEvent.type(screen.getByLabelText("Quanto quer juntar"), "4000000")
    await userEvent.click(screen.getByRole("switch", { name: "Tem prazo" })) // sem prazo
    await userEvent.click(screen.getByRole("button", { name: "Criar meta" }))
    expect(criarMeta).toHaveBeenCalledWith({ nome: "Carro novo", valorAlvo: 40000, dataLimite: null })
    expect(await screen.findByText(/lista de metas/)).toHaveTextContent('"abrir":"nova"')
  })

  it("guardar: escolhe a conta (com o livre), não passa do livre, manda a mesma chave nas tentativas", async () => {
    vi.mocked(guardarNaMeta).mockRejectedValueOnce({ response: { status: 500, data: {} } })
    renderizar("/metas/m1/guardar")
    await screen.findByRole("heading", { name: /Guardar em Entrada do apê/ })
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }))
    expect(screen.getByText("Escolha de qual conta.")).toBeInTheDocument()
    expect(screen.getByText("Diga quanto.")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("combobox", { name: "De qual conta" }))
    await userEvent.click(screen.getByRole("option", { name: /Conta Corrente/ }))
    await userEvent.type(screen.getByLabelText("Quanto"), "200000")
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }))
    expect(screen.getByText("Só tem R$ 1.500,00 livre nessa conta.")).toBeInTheDocument()
    expect(guardarNaMeta).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("button", { name: /Usar tudo que está livre/ }))
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }))
    await userEvent.click(await screen.findByRole("button", { name: "Guardar" }))
    expect(guardarNaMeta).toHaveBeenCalledTimes(2)
    const [[, c1, v1, k1], [, c2, v2, k2]] = vi.mocked(guardarNaMeta).mock.calls
    expect([c1, v1, c2, v2]).toEqual(["c1", 1500, "c1", 1500])
    expect(k1).toBe(k2)
    expect(await screen.findByText(/lista de metas/)).toHaveTextContent('"abrir":"m1"')
  })

  it("tirar: só as contas onde a meta tem dinheiro, até o que tem lá", async () => {
    renderizar("/metas/m1/tirar")
    await screen.findByRole("heading", { name: /Tirar de Entrada do apê/ })
    await userEvent.click(screen.getByRole("combobox", { name: "Tirar de qual conta" }))
    expect(screen.getAllByRole("option")).toHaveLength(2)
    await userEvent.click(screen.getByRole("option", { name: /Poupança/ }))
    await userEvent.type(screen.getByLabelText("Quanto"), "400000")
    await userEvent.click(screen.getByRole("button", { name: "Tirar" }))
    expect(screen.getByText("Nessa conta a meta só tem R$ 3.500,00.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Tirar tudo/ }))
    await userEvent.click(screen.getByRole("button", { name: "Tirar" }))
    expect(tirarDaMeta).toHaveBeenCalledWith("m1", "c2", 3500, expect.any(String))
  })
})
