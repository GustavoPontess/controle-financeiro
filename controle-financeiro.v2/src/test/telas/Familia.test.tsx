import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import type { AcertoContas, BalancoFamilia, Dependente, DespesaCompartilhada, FamiliaDetalhe } from "../../types/Familia"

const EU = { id: "u1", nome: "Gabriel Dev", email: "dev@pontes.app" }
vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ usuario: EU }) }))

const detalhe = (extra: Partial<FamiliaDetalhe> = {}): FamiliaDetalhe => ({
  id: "f1", nome: "Casa Dev", criadoPorUsuarioId: "u1", criadoEm: "2026-01-01", ehAdmin: true, modoRateioPadrao: 1, limiteAprovacao: null,
  membros: [
    { id: "m1", usuarioId: "u1", nomeUsuario: "Gabriel Dev", emailUsuario: "dev@pontes.app", papel: "Companheiro(a)", entrouEm: "2026-01-01", rendaMensal: null, rendaInformada: false, papelPermissao: 1 },
    { id: "m2", usuarioId: "u2", nomeUsuario: "Marina Dev", emailUsuario: "conjuge@pontes.app", papel: "Companheiro(a)", entrouEm: "2026-01-02", rendaMensal: null, rendaInformada: true, papelPermissao: 2 },
  ],
  convitesPendentes: [{ id: "c1", familiaId: "f1", nomeFamilia: "Casa Dev", emailConvidado: "avo@exemplo.com", papel: "Avó", status: 1, expiraEm: "2026-10-25", criadoEm: "2026-10-18", token: "t", papelPermissao: 3 }],
  ...extra,
})
const balanco: BalancoFamilia = { mes: 10, ano: 2026, modo: 1, total: 1000, cota: 500, saldos: [
  { usuarioId: "u1", nome: "Gabriel Dev", pagou: 800, cota: 500, saldo: 300 },
  { usuarioId: "u2", nome: "Marina Dev", pagou: 200, cota: 500, saldo: -300 },
] }
const despesas: DespesaCompartilhada[] = [
  { id: "t1", descricao: "Supermercado", valor: 300, data: "2026-10-05", categoriaNome: "Alimentação", pagadorUsuarioId: "u1", pagadorNome: "Gabriel Dev", statusAprovacao: 0, aprovadoPorNome: null, responsavelUsuarioId: null, responsavelNome: null },
  { id: "t2", descricao: "Sofá novo", valor: 2500, data: "2026-10-09", categoriaNome: "Casa", pagadorUsuarioId: "u2", pagadorNome: "Marina Dev", statusAprovacao: 1, aprovadoPorNome: null, responsavelUsuarioId: null, responsavelNome: null },
]
const acertos: AcertoContas[] = [{ id: "a1", deUsuarioId: "u2", deNome: "Marina Dev", paraUsuarioId: "u1", paraNome: "Gabriel Dev", valor: 150, mes: 10, ano: 2026, observacao: "Pix", criadoEm: "2026-10-10" }]
const dependentes: Dependente[] = [{ id: "d1", familiaId: "f1", nome: "Theo", apelido: null, dataNascimento: "2021-03-10", tipo: 1, ativo: true }]

let familia = detalhe()
vi.mock("../../services/familiaService", () => ({
  getFamilia: vi.fn(async () => familia),
  getDependentes: vi.fn(async () => dependentes),
  getBalancoFamilia: vi.fn(async () => balanco),
  getDespesasFamilia: vi.fn(async () => despesas),
  getAcertos: vi.fn(async () => acertos),
  aprovarDespesa: vi.fn(async () => {}),
  rejeitarDespesa: vi.fn(async () => {}),
  atribuirResponsavel: vi.fn(async () => {}),
  cancelarAcerto: vi.fn(async () => {}),
  definirLimiteAprovacao: vi.fn(async () => {}),
  definirModoRateio: vi.fn(async () => {}),
  definirRendaMembro: vi.fn(async () => {}),
  dissolverFamilia: vi.fn(async () => {}),
  editarPapel: vi.fn(async () => {}),
  editarPermissao: vi.fn(async () => {}),
  inativarDependente: vi.fn(async () => {}),
  removerMembro: vi.fn(async () => {}),
  revogarConvite: vi.fn(async () => {}),
}))
import { aprovarDespesa, definirRendaMembro, dissolverFamilia, editarPermissao, removerMembro } from "../../services/familiaService"
import Familia from "../../telas/Familia"

const Acerto = () => { const { state } = useLocation(); return <p>novo acerto {JSON.stringify(state)}</p> }
const renderizar = (inicio = "/familias/f1") => render(
  <MemoryRouter initialEntries={[inicio]}>
    <Routes>
      <Route path="/familias" element={<p>lista de famílias</p>} />
      <Route path="/familias/:id" element={<Familia />} />
      <Route path="/familias/:id/convidar" element={<p>convidar</p>} />
      <Route path="/familias/:id/acertos/novo" element={<Acerto />} />
      <Route path="/transacoes/:id" element={<p>lançamento</p>} />
    </Routes>
  </MemoryRouter>,
)
const aba = (nome: string) => screen.getByRole("radio", { name: nome })
const linha = (lista: string, nome: RegExp) => within(screen.getByRole("list", { name: lista })).getByRole("button", { name: nome })

describe("Família (página)", () => {
  beforeEach(() => { vi.clearAllMocks(); familia = detalhe() })

  it("aba Mês: equilíbrio como fato (pagou a mais / a menos), sugestão de quem passa quanto, despesas com aprovação", async () => {
    renderizar()
    expect(await screen.findByRole("heading", { name: "Casa Dev" })).toBeInTheDocument()
    const saldos = await screen.findByRole("list", { name: "Quanto cada um pagou" })
    expect(saldos).toHaveTextContent("Gabriel")
    expect(saldos).toHaveTextContent("pagou a mais")
    expect(saldos).toHaveTextContent("pagou a menos")
    expect(saldos).not.toHaveTextContent(/deve|a receber|a acertar/i)
    const sugestao = screen.getByRole("list", { name: "Pra equilibrar o mês" })
    expect(sugestao).toHaveTextContent("Marina")
    expect(sugestao).toHaveTextContent("Gabriel")
    expect(sugestao).toHaveTextContent("300,00")
    expect(await screen.findByText("Sofá novo")).toBeInTheDocument()
    expect(screen.getByText("Aguardando aprovação")).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Entre vocês" })).toHaveTextContent("Marina")
    // Pessoas e Regras ficam nas outras abas.
    expect(screen.queryByRole("list", { name: "Quem está" })).not.toBeInTheDocument()

    await userEvent.click(within(sugestao).getByRole("button", { name: "Marcar como feito" }))
    expect(screen.getByText(/novo acerto/)).toHaveTextContent('"de":"u2","para":"u1","valor":300')
  })

  it("despesa de outra pessoa aguardando aprovação: aprova na própria linha; a minha abre o lançamento", async () => {
    renderizar()
    await userEvent.click(await screen.findByRole("button", { name: /Sofá novo/ }))
    await userEvent.click(screen.getByRole("button", { name: "Aprovar" }))
    expect(aprovarDespesa).toHaveBeenCalledWith("f1", "t2")
    await userEvent.click(screen.getByRole("button", { name: /Sofá novo/ })) // fecha
    await userEvent.click(screen.getByRole("button", { name: /Supermercado/ }))
    expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Abrir lançamento" }))
    expect(screen.getByText("lançamento")).toBeInTheDocument()
  })

  it("aba Pessoas: admin promove e remove outro membro (nunca o criador); eu edito a minha renda; convites e dependentes", async () => {
    renderizar("/familias/f1?aba=pessoas")
    await screen.findByRole("list", { name: "Quem está" })
    expect(screen.getByRole("list", { name: "Convites pendentes" })).toHaveTextContent("avo@exemplo.com")
    expect(screen.getByRole("list", { name: "Dependentes" })).toHaveTextContent("Theo")
    expect(screen.getByRole("button", { name: "Convidar" })).toBeInTheDocument()

    await userEvent.click(linha("Quem está", /Marina Dev/))
    await userEvent.click(screen.getByRole("button", { name: "Tornar admin" }))
    expect(editarPermissao).toHaveBeenCalledWith("f1", "m2", 1)
    await userEvent.click(screen.getByRole("button", { name: "Remover" }))
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remover" }))
    expect(removerMembro).toHaveBeenCalledWith("f1", "m2")

    await userEvent.click(linha("Quem está", /Marina Dev/)) // fecha
    await userEvent.click(linha("Quem está", /Gabriel Dev/))
    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Minha renda" }))
    await userEvent.type(screen.getByRole("textbox", { name: "Sua renda por mês" }), "650000")
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(definirRendaMembro).toHaveBeenCalledWith("f1", "m1", 6500)
  })

  it("quem só vê não tem ações; quem não criou vê Sair em vez de Dissolver (aba Regras)", async () => {
    familia = detalhe({ ehAdmin: false, criadoPorUsuarioId: "u2", membros: detalhe().membros.map((m) => (m.usuarioId === "u1" ? { ...m, papelPermissao: 3 } : { ...m, papelPermissao: 1 })) })
    renderizar()
    await screen.findByRole("heading", { name: "Casa Dev" })
    expect(screen.queryByRole("button", { name: "Registrar" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Marcar como feito" })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole("button", { name: /Sofá novo/ }))
    expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument()
    await userEvent.click(aba("Pessoas"))
    expect(screen.queryByRole("button", { name: "Convidar" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Adicionar" })).not.toBeInTheDocument()
    await userEvent.click(aba("Regras"))
    expect(screen.getByText("Só quem é admin muda as regras.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sair da família" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Dissolver" })).not.toBeInTheDocument()
  })

  it("aba Regras: o criador dissolve com confirmação e volta pra lista", async () => {
    renderizar("/familias/f1?aba=regras")
    await userEvent.click(await screen.findByRole("button", { name: "Dissolver" }))
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Dissolver" }))
    expect(dissolverFamilia).toHaveBeenCalledWith("f1")
    expect(await screen.findByText("lista de famílias")).toBeInTheDocument()
  })
})
