import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import type { UsuarioAdmin } from "../../types/Admin"

const auth = vi.hoisted(() => ({ usuario: { id: "eu", nome: "Gustavo", email: "pontes@pontesdev.com.br", isAdmin: true } as { id: string; nome: string; email: string; isAdmin?: boolean } | null }))
const sair = vi.hoisted(() => vi.fn(() => Promise.resolve()))
vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ usuario: auth.usuario, autenticado: !!auth.usuario, carregando: false, sair }) }))
const mfa = vi.hoisted(() => ({ ativo: true }))
vi.mock("../../services/mfaService", () => ({ default: { status: vi.fn(() => Promise.resolve({ ativo: mfa.ativo })) } }))
vi.mock("../../admin/irPara", () => ({ irPara: vi.fn() }))
vi.mock("../../services/adminService", () => ({
  default: {
    metricas: vi.fn(), pendentes: vi.fn(), usuarios: vi.fn(),
    aprovar: vi.fn(), recusar: vi.fn(), bloquear: vi.fn(), reativar: vi.fn(), forcarReset: vi.fn(),
  },
}))
import adminService from "../../services/adminService"
import { setHideBalance } from "../../estado/ocultar"
import { irPara } from "../../admin/irPara"
import Admin from "../../admin/AreaAdmin"

const svc = vi.mocked(adminService)

const pessoa = (id: string, nome: string, status: number, extra: Partial<UsuarioAdmin> = {}): UsuarioAdmin => ({
  id, nome, email: `${id}@teste.com`, status: status as UsuarioAdmin["status"], criadoEm: "2026-10-20T12:00:00", ...extra,
})
const ana = pessoa("ana", "Ana Pendente", 0, { emailConfirmado: true })
const bia = pessoa("bia", "Bia Ativa", 1, { ultimoAcessoEm: "2026-10-23T10:00:00" })
const caio = pessoa("caio", "Caio Bloqueado", 3)
const eu = pessoa("eu", "Gustavo", 1)

// O mini-app vive debaixo do endereço secreto do deploy (basename); aqui, um de mentira.
const BASE = "/x-endereco-secreto"
const renderizar = (rota = "/usuarios") => render(
  <MemoryRouter basename={BASE} initialEntries={[`${BASE}${rota}`]}>
    <Admin />
  </MemoryRouter>,
)

/** Abre o menu ⋯ da linha da pessoa e escolhe a ação. */
async function acao(nome: string, item: string) {
  await userEvent.click(screen.getByRole("button", { name: `Ações de ${nome}` }))
  await userEvent.click(screen.getByRole("menuitem", { name: item }))
}

describe("Admin", () => {
  beforeEach(() => {
    auth.usuario = { id: "eu", nome: "Gustavo", email: "pontes@pontesdev.com.br", isAdmin: true }
    mfa.ativo = true
    vi.mocked(irPara).mockReset()
    for (const f of Object.values(svc)) vi.mocked(f).mockReset()
    svc.metricas.mockResolvedValue({ total: 4, pendentes: 1, ativos: 2, recusados: 0, bloqueados: 1, marcadosParaExclusao: 0, cadastrosUltimos7Dias: 3, ativosUltimos7Dias: 1 })
    svc.pendentes.mockResolvedValue([ana])
    svc.usuarios.mockResolvedValue({ items: [eu, bia, caio, ana], total: 4, page: 1, pageSize: 25, totalPages: 1 })
    svc.aprovar.mockResolvedValue({ ...ana, status: 1 })
    svc.recusar.mockResolvedValue({ ...ana, status: 2 })
    svc.bloquear.mockResolvedValue({ ...bia, status: 3 })
    svc.reativar.mockResolvedValue({ ...caio, status: 1 })
    svc.forcarReset.mockResolvedValue(undefined)
  })

  it("quem não é admin vai pra Visão geral (sem mensagem) e não chama a API de admin", () => {
    auth.usuario = { id: "x", nome: "Ana", email: "a@b.c", isAdmin: false }
    const { container } = renderizar()
    expect(irPara).toHaveBeenCalledWith("/dashboard")
    expect(container).toBeEmptyDOMElement()
    expect(svc.metricas).not.toHaveBeenCalled()
  })

  it("sem login vai pro login do app", () => {
    auth.usuario = null
    renderizar()
    expect(irPara).toHaveBeenCalledWith("/entrar")
    expect(svc.metricas).not.toHaveBeenCalled()
  })

  it("admin sem as duas etapas: só o pedido pra ligar, nada de admin", async () => {
    mfa.ativo = false
    renderizar()
    await userEvent.click(await screen.findByRole("button", { name: "Ir pra Configurações" }))
    expect(irPara).toHaveBeenCalledWith("/configuracoes")
    expect(screen.queryByRole("navigation", { name: "Administração" })).not.toBeInTheDocument()
    expect(svc.metricas).not.toHaveBeenCalled()
  })

  it("mostra quem espera aprovação e os números; aprovar chama a API e recarrega", async () => {
    renderizar()
    const cadastros = await screen.findByRole("list", { name: "Usuários" })
    expect(within(cadastros).getByText("Ana Pendente")).toBeInTheDocument()
    expect(screen.getAllByText("Esperando aprovação").length).toBeGreaterThanOrEqual(2) // o número no topo e a etiqueta da linha
    await acao("Ana Pendente", "Aprovar")
    expect(svc.aprovar).toHaveBeenCalledWith("ana")
    expect(await screen.findByRole("status")).toHaveTextContent("Ana Pendente pode entrar.")
    expect(svc.usuarios).toHaveBeenCalledTimes(2) // recarregou a lista
  })

  it("e-mail não confirmado: Aprovar fica desligado e a linha avisa", async () => {
    svc.usuarios.mockResolvedValue({ items: [{ ...ana, emailConfirmado: false }], total: 1, page: 1, pageSize: 25, totalPages: 1 })
    renderizar()
    const cadastros = await screen.findByRole("list", { name: "Usuários" })
    expect(within(cadastros).getAllByText("E-mail não confirmado").length).toBeGreaterThan(0)
    await userEvent.click(within(cadastros).getByRole("button", { name: "Ações de Ana Pendente" }))
    expect(screen.queryByRole("menuitem", { name: "Aprovar" })).not.toBeInTheDocument() // sem e-mail confirmado, não aprova
    expect(screen.getByRole("menuitem", { name: "Recusar cadastro" })).toBeInTheDocument()
  })

  it("recusar pede confirmação; cancelar não chama a API", async () => {
    renderizar()
    await screen.findByRole("list", { name: "Usuários" })
    await acao("Ana Pendente", "Recusar cadastro")
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(svc.recusar).not.toHaveBeenCalled()
    await acao("Ana Pendente", "Recusar cadastro")
    await userEvent.click(screen.getByRole("button", { name: "Recusar cadastro" }))
    expect(svc.recusar).toHaveBeenCalledWith("ana")
  })

  it("usuários: ações pela situação; a própria conta não tem ação", async () => {
    renderizar("/usuarios")
    const lista = await screen.findByRole("list", { name: "Usuários" })
    expect(within(lista).getByText("Gustavo (você)")).toBeInTheDocument()
    expect(within(lista).queryByRole("button", { name: /Gustavo/ })).not.toBeInTheDocument()
    expect(within(lista).getByText("23/10/2026")).toBeInTheDocument() // último acesso da Bia
    expect(within(lista).getAllByText("Nunca")).toHaveLength(3) // eu, o Caio e a Ana

    await userEvent.click(within(lista).getByRole("button", { name: "Ações de Bia Ativa" }))
    expect(screen.getByRole("menuitem", { name: "Mandar link de trocar senha" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("menuitem", { name: "Bloquear" }))
    await userEvent.click(screen.getByRole("button", { name: "Bloquear" }))
    expect(svc.bloquear).toHaveBeenCalledWith("bia")

    await userEvent.click(within(lista).getByRole("button", { name: "Ações de Caio Bloqueado" }))
    expect(screen.queryByRole("menuitem", { name: "Bloquear" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("menuitem", { name: "Reativar" }))
    expect(svc.reativar).toHaveBeenCalledWith("caio")
  })

  it("trocar senha confirma e manda o link", async () => {
    renderizar("/usuarios")
    await screen.findByRole("list", { name: "Usuários" })
    await acao("Bia Ativa", "Mandar link de trocar senha")
    await userEvent.click(screen.getByRole("button", { name: "Enviar link" }))
    expect(svc.forcarReset).toHaveBeenCalledWith("bia")
    expect(await screen.findByRole("status")).toHaveTextContent("Link de trocar senha enviado pra Bia Ativa.")
  })

  it("busca vai pro servidor, da página 1", async () => {
    renderizar("/usuarios")
    await screen.findByRole("list", { name: "Usuários" })
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar por nome ou e-mail" }), "bia")
    await vi.waitFor(() => expect(svc.usuarios).toHaveBeenLastCalledWith("bia", 1, 25, undefined))
  })

  it("filtro de situação vai pro servidor, da página 1", async () => {
    renderizar("/usuarios")
    await screen.findByRole("list", { name: "Usuários" })
    await userEvent.click(screen.getByRole("radio", { name: "Bloqueados" }))
    await vi.waitFor(() => expect(svc.usuarios).toHaveBeenLastCalledWith(undefined, 1, 25, 3))
    await userEvent.click(screen.getByRole("radio", { name: "Esperando" }))
    await vi.waitFor(() => expect(svc.usuarios).toHaveBeenLastCalledWith(undefined, 1, 25, 0))
  })

  it("erro do servidor aparece em vermelho e a lista continua", async () => {
    svc.aprovar.mockRejectedValue({ response: { status: 409, data: { message: "Este cadastro não está aguardando aprovação." } } })
    renderizar()
    await screen.findByRole("list", { name: "Usuários" })
    await acao("Ana Pendente", "Aprovar")
    expect(await screen.findByRole("alert")).toHaveTextContent("Este cadastro não está aguardando aprovação.")
  })

  it("olho fechado: e-mail mascarado na lista (dado de terceiro não fica à vista)", async () => {
    setHideBalance(true)
    try {
      const { unmount } = renderizar()
      const lista = await screen.findByRole("list", { name: "Usuários" })
      expect(within(lista).getByText(/an•••@t•••\.com/)).toBeInTheDocument()
      expect(within(lista).getByText(/bi•••@t•••\.com/)).toBeInTheDocument()
      expect(within(lista).queryByText(/ana@teste\.com/)).not.toBeInTheDocument()
      unmount()
    } finally { setHideBalance(false) }
  })

  it("área própria: uma página só (Usuários), com quem espera aprovação em cima; /cadastros antigo cai nela", async () => {
    renderizar("/cadastros")
    const menu = await screen.findByRole("navigation", { name: "Administração" })
    expect(within(menu).getByRole("link", { name: "Usuários" })).toHaveAttribute("href", `${BASE}/usuarios`)
    expect(within(menu).queryByRole("link", { name: "Cadastros" })).not.toBeInTheDocument()
    expect(await screen.findByRole("list", { name: "Usuários" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Nova transação" })).not.toBeInTheDocument() // nada do app financeiro
  })

  it("bloco da conta igual ao do app: nome, e o menu leva pro app, Configurações e Sair", async () => {
    renderizar("")
    await userEvent.click(await screen.findByRole("button", { name: "Gustavo" }))
    const menu = screen.getByRole("menu", { name: "Conta" })
    expect(within(menu).getByText("pontes@pontesdev.com.br")).toBeInTheDocument()
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Voltar ao app" }))
    expect(irPara).toHaveBeenCalledWith("/dashboard")
    await userEvent.click(await screen.findByRole("button", { name: "Gustavo" }))
    await userEvent.click(screen.getByRole("menuitem", { name: "Configurações" }))
    expect(irPara).toHaveBeenCalledWith("/configuracoes")
    await userEvent.click(await screen.findByRole("button", { name: "Gustavo" }))
    await userEvent.click(screen.getByRole("menuitem", { name: "Sair" }))
    expect(sair).toHaveBeenCalled()
  })

  it("uma tabela só: quem espera aparece na lista de usuários, com Aprovar e Recusar no menu da linha", async () => {
    renderizar()
    const lista = await screen.findByRole("list", { name: "Usuários" })
    expect(within(lista).getAllByText("Esperando aprovação").length).toBeGreaterThan(0)
    await userEvent.click(within(lista).getByRole("button", { name: "Ações de Ana Pendente" }))
    expect(screen.getByRole("menuitem", { name: "Aprovar" })).toBeInTheDocument()
    expect(screen.getAllByRole("list")).toHaveLength(1)
  })
})
