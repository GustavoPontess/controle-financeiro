import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import type { AcertoContas, AindaVemDaCasa, BalancoFamilia, Dependente, DespesaCompartilhada, FamiliaDetalhe } from "../../types/Familia"
import type { RendaFamilia } from "../../types/Renda"

const EU = { id: "u1", nome: "Gabriel Dev", email: "dev@pontes.app" }
vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ usuario: EU }) }))

const detalhe = (extra: Partial<FamiliaDetalhe> = {}): FamiliaDetalhe => ({
  id: "f1", nome: "Casa Dev", criadoPorUsuarioId: "u1", criadoEm: "2026-01-01", ehAdmin: true, modoRateioPadrao: 1, limiteAprovacao: null,
  membros: [
    { id: "m1", usuarioId: "u1", nomeUsuario: "Gabriel Dev", emailUsuario: "dev@pontes.app", papel: "Companheiro(a)", entrouEm: "2026-01-01", papelPermissao: 1, visibilidadeRenda: 1, rendaVisivelPara: [] },
    { id: "m2", usuarioId: "u2", nomeUsuario: "Marina Dev", emailUsuario: "conjuge@pontes.app", papel: "Companheiro(a)", entrouEm: "2026-01-02", papelPermissao: 2, visibilidadeRenda: 3, rendaVisivelPara: null },
  ],
  convitesPendentes: [{ id: "c1", familiaId: "f1", nomeFamilia: "Casa Dev", emailConvidado: "avo@exemplo.com", papel: "Avó", status: 1, expiraEm: "2026-10-25", criadoEm: "2026-10-18", token: "t", papelPermissao: 3 }],
  ...extra,
})
const balanco: BalancoFamilia = { mes: 10, ano: 2026, modo: 1, total: 1000, cota: 500, saldos: [
  { usuarioId: "u1", nome: "Gabriel Dev", pagou: 800, cota: 500, saldo: 300, saiuEm: null },
  { usuarioId: "u2", nome: "Marina Dev", pagou: 200, cota: 500, saldo: -300, saiuEm: null },
] }
const despesas: DespesaCompartilhada[] = [
  { id: "t1", descricao: "Supermercado", valor: 300, data: "2026-10-05", categoriaNome: "Alimentação", pagadorUsuarioId: "u1", pagadorNome: "Gabriel Dev", statusAprovacao: 0, aprovadoPorNome: null, responsavelUsuarioId: null, responsavelNome: null, minhaParte: 150 },
  { id: "t2", descricao: "Sofá novo", valor: 2500, data: "2026-10-09", categoriaNome: "Casa", pagadorUsuarioId: "u2", pagadorNome: "Marina Dev", statusAprovacao: 1, aprovadoPorNome: null, responsavelUsuarioId: null, responsavelNome: null, minhaParte: 1250 },
]
const acertos: AcertoContas[] = [{ id: "a1", deUsuarioId: "u2", deNome: "Marina Dev", paraUsuarioId: "u1", paraNome: "Gabriel Dev", valor: 150, mes: 10, ano: 2026, observacao: "Pix", criadoEm: "2026-10-10", data: "2026-10-10", confirmadoEm: "2026-10-10T12:00:00", minhaTransacaoId: null }]
let aindaVem: AindaVemDaCasa = { total: 0, minhaParte: 0, itens: [] }
const dependentes: Dependente[] = [{ id: "d1", familiaId: "f1", nome: "Theo", apelido: null, dataNascimento: "2021-03-10", tipo: 1, ativo: true }]

let familia = detalhe()
let renda: RendaFamilia = { ano: 2026, mes: 10, total: 9500, previsto: 10000, membros: [] }
vi.mock("../../services/rendaService", () => ({ getRendaFamilia: vi.fn(async () => renda), definirVisibilidadeRenda: vi.fn(async () => {}) }))
vi.mock("../../services/familiaService", () => ({
  getFamilias: vi.fn(async () => []),
  getConvitesPendentes: vi.fn(async () => []),
  getFamilia: vi.fn(async () => familia),
  getDependentes: vi.fn(async () => dependentes),
  getGastoDependente: vi.fn(async () => ({ dependenteId: "d1", nome: "Theo", mes: 10, ano: 2026, total: 320 })),
  getBalancoFamilia: vi.fn(async () => balanco),
  getDespesasFamilia: vi.fn(async () => despesas),
  getAcertos: vi.fn(async () => acertos),
  getAindaVemFamilia: vi.fn(async () => aindaVem),
  aprovarDespesa: vi.fn(async () => {}),
  rejeitarDespesa: vi.fn(async () => {}),
  atribuirResponsavel: vi.fn(async () => {}),
  cancelarAcerto: vi.fn(async () => {}),
  definirLimiteAprovacao: vi.fn(async () => {}),
  definirModoRateio: vi.fn(async () => {}),
  dissolverFamilia: vi.fn(async () => {}),
  editarPapel: vi.fn(async () => {}),
  editarPermissao: vi.fn(async () => {}),
  inativarDependente: vi.fn(async () => {}),
  removerMembro: vi.fn(async () => {}),
  revogarConvite: vi.fn(async () => {}),
}))
import { aprovarDespesa, dissolverFamilia, editarPermissao, inativarDependente, rejeitarDespesa, removerMembro, revogarConvite } from "../../services/familiaService"
import { definirVisibilidadeRenda } from "../../services/rendaService"
import FamiliaVisaoGeral from "../../telas/FamiliaVisaoGeral"
import FamiliaTransacoes from "../../telas/FamiliaTransacoes"
import FamiliaEntreVoces from "../../telas/FamiliaEntreVoces"
import FamiliaMembros from "../../telas/FamiliaMembros"
import FamiliaPessoa from "../../telas/FamiliaPessoa"
import FamiliaDependente from "../../telas/FamiliaDependente"
import FamiliaRegras from "../../telas/FamiliaRegras"

const Acerto = () => { const { state } = useLocation(); return <p>novo acerto {JSON.stringify(state)}</p> }
const renderizar = (inicio = "/familias/f1") => render(
  <MemoryRouter initialEntries={[inicio]}>
    <Routes>
      <Route path="/dashboard" element={<p>painel pessoal</p>} />
      <Route path="/familias/:id" element={<FamiliaVisaoGeral />} />
      <Route path="/familias/:id/transacoes" element={<FamiliaTransacoes />} />
      <Route path="/familias/:id/entre-voces" element={<FamiliaEntreVoces />} />
      <Route path="/familias/:id/membros" element={<FamiliaMembros />} />
      <Route path="/familias/:id/membros/:membroId" element={<FamiliaPessoa />} />
      <Route path="/familias/:id/dependentes/:depId" element={<FamiliaDependente />} />
      <Route path="/familias/:id/dependentes/novo" element={<p>adicionar sem conta</p>} />
      <Route path="/familias/:id/dependentes/:depId/editar" element={<p>editar dependente</p>} />
      <Route path="/familias/:id/regras" element={<FamiliaRegras />} />
      <Route path="/familias/:id/convidar" element={<p>convidar</p>} />
      <Route path="/familias/:id/acertos/novo" element={<Acerto />} />
      <Route path="/transacoes/:id" element={<p>lançamento</p>} />
      <Route path="/renda" element={<p>página de renda</p>} />
    </Routes>
  </MemoryRouter>,
)

describe("Espaço da família: a parte de cada um fica gravada", () => {
  it("a despesa mostra a sua parte; quem saiu continua no equilíbrio com a data que saiu", async () => {
    renderizar("/familias/f1/transacoes")
    expect(await screen.findByText("Supermercado")).toBeInTheDocument()
    expect(screen.getAllByText(/sua parte/).length).toBe(2)

    balanco.saldos[1].saiuEm = "2026-10-15T00:00:00"
    try {
      renderizar("/familias/f1")
      expect(await screen.findByText(/saiu em out\/2026/)).toBeInTheDocument()
    } finally { balanco.saldos[1].saiuEm = null }
  })
})

describe("Espaço da família (páginas)", () => {
  beforeEach(() => {
    vi.clearAllMocks(); familia = detalhe()
    renda = { ano: 2026, mes: 10, total: 9500, previsto: 10000, membros: [
      { usuarioId: "u1", nome: "Gabriel Dev", mostrada: true, recebido: 6000, previsto: 6500 },
      { usuarioId: "u2", nome: "Marina Dev", mostrada: true, recebido: 3500, previsto: 3500 },
    ] }
  })

  it("Visão geral: equilíbrio como fato (pagou a mais / a menos), quem passa quanto, renda da casa de quem liberou, só o que aguarda aprovação", async () => {
    renderizar()
    const saldos = await screen.findByRole("list", { name: "Quanto cada um pagou" })
    expect(saldos).toHaveTextContent("Gabriel")
    expect(saldos).toHaveTextContent("pagou a mais")
    expect(saldos).toHaveTextContent("pagou a menos")
    expect(saldos).not.toHaveTextContent(/deve|a receber|a acertar/i)
    const sugestao = screen.getByRole("list", { name: "Pra equilibrar o mês" })
    expect(sugestao).toHaveTextContent("Marina")
    expect(sugestao).toHaveTextContent("Gabriel")
    expect(sugestao).toHaveTextContent("300,00")
    // Renda da casa: só porque a Marina liberou o valor pra mim; soma o que está mostrado.
    const rendaCasa = await screen.findByLabelText("Renda por pessoa")
    expect(rendaCasa).toHaveTextContent("Marina")
    expect(rendaCasa).toHaveTextContent("3.500,00")
    expect(screen.getByText(/Renda da casa/)).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Entre vocês" })).toHaveTextContent("Marina")
    // Embaixo só o que pede ação: a despesa aguardando; a já aprovada fica na página de despesas.
    const aguardando = await screen.findByRole("list", { name: "Aguardando aprovação" })
    expect(aguardando).toHaveTextContent("Sofá novo")
    expect(aguardando).not.toHaveTextContent("Supermercado")
    expect(screen.getByRole("link", { name: "Ver todas" })).toHaveAttribute("href", "/familias/f1/transacoes")
    // Sem cabeçalho repetindo o nome, sem contador, sem abas: o espaço já diz onde a pessoa está.
    expect(screen.queryByRole("heading", { name: "Casa Dev" })).not.toBeInTheDocument()
    expect(screen.queryByText(/pessoas/)).not.toBeInTheDocument()
    expect(screen.queryByRole("radio")).not.toBeInTheDocument()

    await userEvent.click(within(sugestao).getByRole("button", { name: "Marcar como feito" }))
    expect(screen.getByText(/novo acerto/)).toHaveTextContent('"de":"u2","para":"u1","valor":300')
  })

  it("Transações da família: aguardando aprovação primeiro; o dinheiro entre vocês junto; aprova ou recusa na própria linha", async () => {
    renderizar("/familias/f1/transacoes")
    const lista = await screen.findByRole("list", { name: "Transações da família" })
    expect(within(lista).getByRole("list", { name: "Outubro de 2026" })).toHaveTextContent("Pix")
    expect(within(lista).getByRole("list", { name: "Aguardando aprovação" })).toHaveTextContent("Sofá novo")
    expect(within(lista).getByRole("list", { name: "Outubro de 2026" })).toHaveTextContent("Supermercado")
    await userEvent.click(screen.getByRole("button", { name: /Sofá novo/ }))
    await userEvent.click(screen.getByRole("button", { name: "Aprovar" }))
    expect(aprovarDespesa).toHaveBeenCalledWith("f1", "t2")
    await userEvent.click(screen.getByRole("button", { name: "Recusar" }))
    expect(rejeitarDespesa).toHaveBeenCalledWith("f1", "t2")
    expect(screen.queryByRole("button", { name: /Rejeitar/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Sofá novo/ })) // fecha
    await userEvent.click(screen.getByRole("button", { name: /Supermercado/ }))
    expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Abrir lançamento" }))
    expect(screen.getByText("lançamento")).toBeInTheDocument()
  })

  it("Entre vocês: o equilíbrio e o que passou no mês, com o botão de registrar", async () => {
    renderizar("/familias/f1/entre-voces")
    expect(await screen.findByRole("list", { name: "Pra equilibrar o mês" })).toHaveTextContent("300,00")
    expect(screen.getByRole("list", { name: "Entre vocês" })).toHaveTextContent("Marina")
    await userEvent.click(screen.getByRole("button", { name: /Dinheiro entre vocês/ }))
    expect(screen.getByText(/novo acerto/)).toHaveTextContent('"voltarPara":"/familias/f1/entre-voces"')
  })

  it("Membros: convidar e adicionar à vista; uma linha por pessoa com o perfil, que leva pra página dela; convites", async () => {
    renderizar("/familias/f1/membros")
    const casa = await screen.findByRole("list", { name: "Na casa" })
    expect(within(casa).getByRole("link", { name: /Gabriel Dev/ })).toHaveTextContent("Responsável")
    expect(within(casa).getByRole("link", { name: /Marina Dev/ })).toHaveAttribute("href", "/familias/f1/membros/m2")
    expect(within(casa).getByRole("link", { name: /Marina Dev/ })).toHaveTextContent("Adulto")
    expect(await within(casa).findByRole("link", { name: /Theo/ })).toHaveAttribute("href", "/familias/f1/dependentes/d1")
    expect(within(casa).getByRole("link", { name: /Theo/ })).toHaveTextContent("Sem conta")
    // Nada de ficha abrindo na linha: a pessoa tem página.
    expect(within(casa).queryByRole("button")).not.toBeInTheDocument()

    const convites = screen.getByRole("list", { name: "Convites" })
    expect(convites).toHaveTextContent("avo@exemplo.com")
    expect(convites).toHaveTextContent("Só vê")
    await userEvent.click(within(convites).getByRole("button", { name: "Cancelar convite" }))
    expect(revogarConvite).toHaveBeenCalledWith("f1", "c1")

    await userEvent.click(screen.getByRole("button", { name: /Adicionar alguém sem conta/ }))
    expect(screen.getByText("adicionar sem conta")).toBeInTheDocument()
    renderizar("/familias/f1/membros")
    await userEvent.click(await screen.findByRole("button", { name: /Convidar/ }))
    expect(screen.getByText("convidar")).toBeInTheDocument()
  })

  it("página da pessoa: quem administra muda o perfil (com confirmação dizendo o que muda) e remove", async () => {
    renderizar("/familias/f1/membros/m2")
    const perfil = await screen.findByRole("radiogroup", { name: "Perfil de Marina" })
    expect(within(perfil).getByRole("radio", { name: "Adulto" })).toBeChecked()
    expect(screen.getByRole("list", { name: "O que pode nesta casa" })).toHaveTextContent("Muda as regras, convida e cuida dos membros: não pode")
    await userEvent.click(within(perfil).getByRole("radio", { name: "Responsável" }))
    const dialogo = await screen.findByRole("alertdialog")
    expect(dialogo).toHaveTextContent("Como Responsável, Marina passa a mudar as regras")
    expect(editarPermissao).not.toHaveBeenCalled()
    await userEvent.click(within(dialogo).getByRole("button", { name: "Mudar" }))
    expect(editarPermissao).toHaveBeenCalledWith("f1", "m2", 1)

    await userEvent.click(await screen.findByRole("button", { name: "Remover" }))
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remover" }))
    expect(removerMembro).toHaveBeenCalledWith("f1", "m2")
    expect(await screen.findByRole("list", { name: "Na casa" })).toBeInTheDocument()
  })

  it("a minha página: perfil sem trocar (nem o meu, nem de quem criou), quem vê a minha renda é uma caixa por pessoa", async () => {
    renderizar("/familias/f1/membros/m1")
    expect(await screen.findByText("Criou a casa")).toBeInTheDocument()
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument() // quem criou dissolve, em Regras
    // Quem vê a sua renda: marcar a Marina = ela vê o valor (nível "pra alguns"); desmarcar = só o peso.
    const quemVe = await screen.findByRole("group", { name: "Quem vê a sua renda" })
    const marina = within(quemVe).getByRole("checkbox", { name: "Marina" })
    expect(marina).not.toBeChecked()
    await userEvent.click(marina)
    expect(definirVisibilidadeRenda).toHaveBeenCalledWith("f1", "m1", 2, ["u2"])
    await userEvent.click(within(await screen.findByRole("group", { name: "Quem vê a sua renda" })).getByRole("checkbox", { name: "Marina" }))
    expect(definirVisibilidadeRenda).toHaveBeenLastCalledWith("f1", "m1", 1, [])
    expect(screen.queryByText(/Só o peso/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("link", { name: "Ver renda" }))
    expect(screen.getByText("página de renda")).toBeInTheDocument()
  })

  it("página do outro membro: renda só quando a pessoa liberou pra mim (senão nem linha); a renda da casa some da Visão geral", async () => {
    renda = { ...renda, total: 6000, previsto: 6500, membros: [renda.membros[0], { ...renda.membros[1], mostrada: false, recebido: null, previsto: null }] }
    renderizar("/familias/f1/membros/m2")
    await screen.findByRole("radiogroup", { name: "Perfil de Marina" })
    expect(screen.queryByText(/Renda em/)).not.toBeInTheDocument()
    expect(screen.queryByText(/peso|não mostra|não compartilha/i)).not.toBeInTheDocument()
    renderizar("/familias/f1")
    await screen.findByRole("list", { name: "Quanto cada um pagou" })
    expect(screen.queryByText(/Renda da casa/)).not.toBeInTheDocument()
  })

  it("quem é da casa sem conta tem página: idade, gasto do mês, editar e tirar da família com confirmação", async () => {
    renderizar("/familias/f1/dependentes/d1")
    expect(await screen.findByRole("heading", { name: "Theo" })).toBeInTheDocument()
    expect(screen.getByText(/Criança/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/320,00/)).toBeInTheDocument())
    await userEvent.click(screen.getByRole("button", { name: "Tirar da família" }))
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Tirar" }))
    expect(inativarDependente).toHaveBeenCalledWith("f1", "d1")
    expect(await screen.findByRole("list", { name: "Na casa" })).toBeInTheDocument()
  })

  it("Visão geral: o que ainda vem da casa no mês, com o total e a sua parte do servidor", async () => {
    aindaVem = { total: 220, minhaParte: 110, itens: [
      { recorrenteId: "r1", descricao: "Internet", valor: 100, dia: 20, pagadorUsuarioId: "u2", pagadorNome: "Marina Dev", categoriaNome: "Casa", ehMinha: false, cobrancaData: "2026-10-20", cobrancaPaga: false, minhaParte: 50 },
      { recorrenteId: "r2", descricao: "Luz", valor: 120, dia: 25, pagadorUsuarioId: "u1", pagadorNome: "Gabriel Dev", categoriaNome: "Moradia", ehMinha: true, cobrancaData: "2026-10-25", cobrancaPaga: false, minhaParte: 60 },
    ] }
    try {
      renderizar()
      const lista = await screen.findByRole("list", { name: /Ainda vem da casa em/ })
      expect(lista).toHaveTextContent("Internet")
      expect(lista).toHaveTextContent("Vem dia 20/10")
      const grupo = lista.closest("li")!
      expect(within(grupo).getByRole("heading").textContent?.replace(/ /g, " ")).toContain("R$ 220,00 · sua parte R$ 110,00")
    } finally { aindaVem = { total: 0, minhaParte: 0, itens: [] } }
  })

  it("Membros: quem saiu (ou excluiu a conta) continua em Saíram, com a data", async () => {
    familia = detalhe({ quemSaiu: [
      { usuarioId: "u9", nome: "Membro que saiu", saiuEm: "2026-10-15T10:00:00" },
      { usuarioId: "u8", nome: "Ana Antiga", saiuEm: "2026-09-02T10:00:00" },
    ] })
    renderizar("/familias/f1/membros")
    const saiu = await screen.findByRole("list", { name: "Saíram" })
    expect(saiu).toHaveTextContent("Membro que saiu")
    expect(saiu).toHaveTextContent("saiu em out/2026")
    expect(saiu).toHaveTextContent("Ana Antiga")
  })

  it("quem só vê não tem ações em página nenhuma; quem não criou vê Sair em vez de Dissolver", async () => {
    familia = detalhe({ ehAdmin: false, criadoPorUsuarioId: "u2", membros: detalhe().membros.map((m) => (m.usuarioId === "u1" ? { ...m, papelPermissao: 3 } : { ...m, papelPermissao: 1 })) })
    renderizar()
    await screen.findByRole("list", { name: "Quanto cada um pagou" })
    expect(screen.queryByRole("button", { name: "Marcar como feito" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Dinheiro entre vocês/ })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole("button", { name: /Sofá novo/ }))
    expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument()

    renderizar("/familias/f1/membros")
    await screen.findByRole("list", { name: "Na casa" })
    expect(screen.queryByRole("button", { name: /Convidar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Adicionar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Cancelar convite" })).not.toBeInTheDocument()

    renderizar("/familias/f1/dependentes/d1")
    await screen.findByRole("heading", { name: "Theo" })
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument()

    renderizar("/familias/f1/membros/m2")
    await screen.findByText("Muda as regras, convida e cuida dos membros")
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument()

    renderizar("/familias/f1/regras")
    expect(await screen.findByText("Divisão")).toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Dissolver" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument()

    // Sair fica na própria página.
    renderizar("/familias/f1/membros/m1")
    expect(await screen.findByText("Só vê")).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Quem vê a sua renda" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Sair" }))
    expect(within(await screen.findByRole("alertdialog")).getByText(/Seus lançamentos continuam com você/)).toBeInTheDocument()
  })

  it("Regras: o criador dissolve com confirmação e volta pro espaço pessoal", async () => {
    renderizar("/familias/f1/regras")
    await userEvent.click(await screen.findByRole("button", { name: "Dissolver" }))
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Dissolver" }))
    expect(dissolverFamilia).toHaveBeenCalledWith("f1")
    expect(await screen.findByText("painel pessoal")).toBeInTheDocument()
  })
})
