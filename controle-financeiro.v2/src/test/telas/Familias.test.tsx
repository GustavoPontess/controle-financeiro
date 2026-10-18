import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import type { ConviteFamilia, Familia } from "../../types/Familia"

vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ usuario: { id: "u1", nome: "Gabriel Dev", email: "dev@pontes.app" } }) }))
let familias: Familia[] = []
let convites: ConviteFamilia[] = []
vi.mock("../../services/familiaService", () => ({
  getFamilias: vi.fn(async () => familias),
  getConvitesPendentes: vi.fn(async () => convites),
  getFamilia: vi.fn(async () => ({ id: "f1", nome: "Casa Dev", criadoPorUsuarioId: "u1", criadoEm: "", ehAdmin: true, modoRateioPadrao: 2, limiteAprovacao: null, convitesPendentes: [],
    membros: [{ id: "m1", usuarioId: "u1", nomeUsuario: "Gabriel Dev", emailUsuario: "", papel: "", entrouEm: "", rendaMensal: null, rendaInformada: false, papelPermissao: 1 },
      { id: "m2", usuarioId: "u2", nomeUsuario: "Marina Dev", emailUsuario: "", papel: "", entrouEm: "", rendaMensal: null, rendaInformada: false, papelPermissao: 2 }] })),
  getBalancoFamilia: vi.fn(async () => ({ mes: 10, ano: 2026, modo: 2, total: 900, cota: 450, saldos: [{ usuarioId: "u1", nome: "Gabriel Dev", pagou: 100, cota: 450, saldo: -350 }] })),
  aceitarConvite: vi.fn(async () => {}),
  recusarConvite: vi.fn(async () => {}),
  criarFamilia: vi.fn(async (nome: string) => ({ id: "f9", nome, criadoPorUsuarioId: "u1", criadoEm: "", ehAdmin: true, totalMembros: 1 })),
}))
import { aceitarConvite, criarFamilia } from "../../services/familiaService"
import Familias from "../../telas/Familias"
import NovaFamilia from "../../telas/NovaFamilia"

const renderizar = (inicio = "/familias") => render(
  <MemoryRouter initialEntries={[inicio]}>
    <Routes>
      <Route path="/familias" element={<Familias />} />
      <Route path="/familias/nova" element={<NovaFamilia />} />
      <Route path="/familias/:id" element={<p>página da família</p>} />
    </Routes>
  </MemoryRouter>,
)

describe("Famílias (lista)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    familias = [{ id: "f1", nome: "Casa Dev", criadoPorUsuarioId: "u1", criadoEm: "", ehAdmin: true, totalMembros: 2 }]
    convites = [{ id: "c1", familiaId: "f2", nomeFamilia: "Sítio", emailConvidado: "dev@pontes.app", papel: "Filho(a)", status: 1, expiraEm: "", criadoEm: "", token: "tok", papelPermissao: 2 }]
  })

  it("convite pra mim aceita aqui; a família abre a ficha com o resumo do mês e entra na página", async () => {
    renderizar()
    const convite = await screen.findByRole("list", { name: "Convites pra você" })
    expect(convite).toHaveTextContent("Sítio te convidou como Filho(a)")
    await userEvent.click(within(convite).getByRole("button", { name: "Aceitar" }))
    expect(aceitarConvite).toHaveBeenCalledWith("tok")

    await userEvent.click(within(screen.getByRole("list", { name: "Famílias" })).getByRole("button", { name: /Casa Dev/ }))
    expect(await screen.findByText("Gabriel, Marina")).toBeInTheDocument()
    expect(screen.getByText("Proporcional à renda")).toBeInTheDocument()
    expect(screen.getByText(/a acertar/)).toHaveTextContent("350,00")
    await userEvent.click(screen.getByRole("button", { name: "Abrir família" }))
    expect(screen.getByText("página da família")).toBeInTheDocument()
  })

  it("sem família: convida a criar; nova família exige nome e vai pra página dela", async () => {
    familias = []; convites = []
    renderizar()
    expect(await screen.findByText(/Você ainda não está em nenhuma família/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Nova família" }))
    await userEvent.click(screen.getByRole("button", { name: "Criar família" }))
    expect(screen.getByText("Dê um nome pra família.")).toBeInTheDocument()
    expect(criarFamilia).not.toHaveBeenCalled()
    await userEvent.type(screen.getByRole("textbox", { name: "Nome" }), "Apê 302")
    await userEvent.click(screen.getByRole("button", { name: "Criar família" }))
    expect(criarFamilia).toHaveBeenCalledWith("Apê 302")
    expect(await screen.findByText("página da família")).toBeInTheDocument()
  })
})
