import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import type { AcertoContas, FamiliaDetalhe } from "../../types/Familia"

vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ usuario: { id: "u1", nome: "Gustavo Pontes", email: "" } }) }))
vi.mock("../../services/contaService", () => ({
  getContas: vi.fn(async () => [
    { id: "k1", nome: "Carteira", tipo: 4, tipoDescricao: "", saldoAtual: 0, isCarteira: true },
    { id: "k2", nome: "Nubank", tipo: 1, tipoDescricao: "", saldoAtual: 0, isCarteira: false },
  ]),
}))
vi.mock("../../services/familiaService", async (orig) => ({
  ...(await orig<typeof import("../../services/familiaService")>()),
  getFamilia: vi.fn(), getBalancoFamilia: vi.fn(), registrarAcerto: vi.fn(),
  confirmarAcerto: vi.fn(), lancarAcerto: vi.fn(), cancelarAcerto: vi.fn(),
}))
import { cancelarAcerto, confirmarAcerto, getBalancoFamilia, getFamilia, lancarAcerto, registrarAcerto } from "../../services/familiaService"
import NovoAcerto from "../../telas/NovoAcerto"
import { Acerto } from "../../telas/FamiliaPecas"

const familia: FamiliaDetalhe = {
  id: "f1", nome: "Casa", criadoPorUsuarioId: "u1", criadoEm: "", ehAdmin: true, modoRateioPadrao: 1, limiteAprovacao: null, convitesPendentes: [],
  membros: [
    { id: "m1", usuarioId: "u1", nomeUsuario: "Gustavo Pontes", emailUsuario: "", papel: "", entrouEm: "", papelPermissao: 1, visibilidadeRenda: 1, rendaVisivelPara: [] },
    { id: "m2", usuarioId: "u2", nomeUsuario: "Gabriel Dev", emailUsuario: "", papel: "", entrouEm: "", papelPermissao: 2, visibilidadeRenda: 1, rendaVisivelPara: null },
    { id: "m3", usuarioId: "u3", nomeUsuario: "Marina Dev", emailUsuario: "", papel: "", entrouEm: "", papelPermissao: 3, visibilidadeRenda: 0, rendaVisivelPara: null },
  ],
}
const acerto = (extra: Partial<AcertoContas> = {}): AcertoContas => ({
  id: "a1", deUsuarioId: "u2", deNome: "Gabriel Dev", paraUsuarioId: "u1", paraNome: "Gustavo Pontes", valor: 90, mes: 10, ano: 2026,
  observacao: null, criadoEm: "2026-10-18T12:00:00", data: "2026-10-18", confirmadoEm: null, minhaTransacaoId: null, ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getFamilia).mockResolvedValue(familia)
  vi.mocked(getBalancoFamilia).mockResolvedValue({ mes: 10, ano: 2026, modo: 1, total: 180, cota: 90, saldos: [
    { usuarioId: "u1", nome: "Gustavo Pontes", pagou: 0, cota: 90, saldo: -90, saiuEm: null },
    { usuarioId: "u2", nome: "Gabriel Dev", pagou: 180, cota: 90, saldo: 90, saiuEm: null },
  ] })
})

describe("Dinheiro entre vocês (formulário)", () => {
  const abrir = () => render(
    <MemoryRouter initialEntries={["/familias/f1/acertos/novo"]}>
      <Routes>
        <Route path="/familias/:id/acertos/novo" element={<NovoAcerto />} />
        <Route path="/familias/:id/entre-voces" element={<p>Entre vocês</p>} />
      </Routes>
    </MemoryRouter>,
  )

  it("vem preenchido pelo equilíbrio (eu passei pro Gabriel) e manda a conta e o dia", async () => {
    vi.mocked(registrarAcerto).mockResolvedValue(acerto())
    abrir()
    expect(await screen.findByRole("radio", { name: "Eu passei" })).toBeChecked()
    // Quem só vê (Marina) não aparece pra passar/receber.
    await userEvent.click(screen.getByRole("combobox", { name: "Pra quem" }))
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Gabriel"])
    await userEvent.click(screen.getByRole("option", { name: "Gabriel" }))
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }))
    await waitFor(() => expect(registrarAcerto).toHaveBeenCalledWith("f1", expect.objectContaining({
      deUsuarioId: "u1", paraUsuarioId: "u2", valor: 90, contaId: "k1",
    })))
    expect(await screen.findByText("Entre vocês")).toBeInTheDocument()
  })

  it("eu recebi, sem registrar em conta", async () => {
    vi.mocked(registrarAcerto).mockResolvedValue(acerto())
    abrir()
    await userEvent.click(await screen.findByRole("radio", { name: "Eu recebi" }))
    await userEvent.click(screen.getByRole("combobox", { name: "Entrou em" }))
    await userEvent.click(screen.getByRole("option", { name: "Não registrar em conta" }))
    await userEvent.click(screen.getByRole("button", { name: "Registrar" }))
    await waitFor(() => expect(registrarAcerto).toHaveBeenCalledWith("f1", expect.objectContaining({
      deUsuarioId: "u2", paraUsuarioId: "u1", contaId: null,
    })))
  })
})

describe("Dinheiro entre vocês (linha)", () => {
  const linha = (a: AcertoContas) => render(<MemoryRouter><ul><Acerto a={a} familiaId="f1" podeAgir aoMudar={vi.fn()} /></ul></MemoryRouter>)

  it("quem recebeu vê 'Esperando você confirmar' e confirma dizendo em qual conta entrou", async () => {
    vi.mocked(confirmarAcerto).mockResolvedValue(acerto({ confirmadoEm: "2026-10-19T10:00:00" }))
    linha(acerto())
    expect(screen.getByText("Esperando você confirmar")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Gabriel/ }))
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    const dialogo = await screen.findByRole("alertdialog")
    expect(within(dialogo).getByText(/Gabriel passou R\$\s90,00 pra você/)).toBeInTheDocument()
    await waitFor(() => expect(within(dialogo).getByRole("combobox", { name: "Em qual conta entrou" })).toHaveTextContent("Carteira"))
    await userEvent.click(within(dialogo).getByRole("button", { name: "Confirmar" }))
    expect(confirmarAcerto).toHaveBeenCalledWith("f1", "a1", "k1", "2026-10-18")
  })

  it("quem recebeu pode dizer que não recebeu", async () => {
    vi.mocked(cancelarAcerto).mockResolvedValue()
    linha(acerto())
    await userEvent.click(screen.getByRole("button", { name: /Gabriel/ }))
    await userEvent.click(screen.getByRole("button", { name: "Não recebi" }))
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Não recebi" }))
    expect(cancelarAcerto).toHaveBeenCalledWith("f1", "a1")
  })

  it("confirmado e sem o meu lançamento: lança na minha conta; com lançamento, leva pra ele", async () => {
    vi.mocked(lancarAcerto).mockResolvedValue(acerto())
    const { unmount } = linha(acerto({ confirmadoEm: "2026-10-19T10:00:00" }))
    expect(screen.queryByText(/Esperando/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Gabriel/ }))
    await userEvent.click(screen.getByRole("button", { name: "Lançar na minha conta" }))
    const dialogo = await screen.findByRole("alertdialog")
    await waitFor(() => expect(within(dialogo).getByRole("combobox", { name: "Conta" })).toHaveTextContent("Carteira"))
    await userEvent.click(within(dialogo).getByRole("button", { name: "Lançar" }))
    expect(lancarAcerto).toHaveBeenCalledWith("f1", "a1", "k1", "2026-10-18")
    unmount()

    linha(acerto({ confirmadoEm: "2026-10-19T10:00:00", minhaTransacaoId: "t9" }))
    await userEvent.click(screen.getByRole("button", { name: /Gabriel/ }))
    expect(screen.getByRole("link", { name: "Ver na minha conta" })).toHaveAttribute("href", "/transacoes/t9")
    expect(screen.queryByRole("button", { name: "Lançar na minha conta" })).not.toBeInTheDocument()
  })

  it("quem passou vê que espera a outra pessoa confirmar", () => {
    linha(acerto({ deUsuarioId: "u1", deNome: "Gustavo Pontes", paraUsuarioId: "u2", paraNome: "Gabriel Dev" }))
    expect(screen.getByText("Esperando Gabriel confirmar")).toBeInTheDocument()
  })
})
