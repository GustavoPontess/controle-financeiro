import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import type { UsuarioAdmin } from "../../types/Admin"

const auth = vi.hoisted(() => ({ usuario: { id: "eu", nome: "Gustavo", email: "pontes@pontesdev.com.br", isAdmin: true } as { id: string; nome: string; email: string; isAdmin?: boolean } | null }))
vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ usuario: auth.usuario, autenticado: !!auth.usuario, carregando: false }) }))
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
const ana = pessoa("ana", "Ana Pendente", 0)
const bia = pessoa("bia", "Bia Ativa", 1, { ultimoAcessoEm: "2026-10-23T10:00:00" })
const caio = pessoa("caio", "Caio Bloqueado", 3)
const eu = pessoa("eu", "Gustavo", 1)

// O mini-app vive debaixo do endereço secreto do deploy (basename); aqui, um de mentira.
const BASE = "/x-endereco-secreto"
const renderizar = (rota = "/cadastros") => render(
  <MemoryRouter basename={BASE} initialEntries={[`${BASE}${rota}`]}>
    <Admin />
  </MemoryRouter>,
)

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

  it("mostra a fila de cadastros e os números; aprovar chama a API e recarrega", async () => {
    renderizar()
    const cadastros = await screen.findByRole("list", { name: "Cadastros" })
    expect(within(cadastros).getByText("Ana Pendente")).toBeInTheDocument()
    expect(screen.getByText("Esperando")).toBeInTheDocument()
    await userEvent.click(within(cadastros).getByRole("button", { name: "Aprovar Ana Pendente" }))
    expect(svc.aprovar).toHaveBeenCalledWith("ana")
    expect(await screen.findByRole("status")).toHaveTextContent("Ana Pendente pode entrar.")
    expect(svc.pendentes).toHaveBeenCalledTimes(2) // recarregou a fila
  })

  it("recusar pede confirmação; cancelar não chama a API", async () => {
    renderizar()
    const cadastros = await screen.findByRole("list", { name: "Cadastros" })
    await userEvent.click(within(cadastros).getByRole("button", { name: "Recusar Ana Pendente" }))
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(svc.recusar).not.toHaveBeenCalled()
    await userEvent.click(within(cadastros).getByRole("button", { name: "Recusar Ana Pendente" }))
    await userEvent.click(screen.getByRole("button", { name: "Recusar cadastro" }))
    expect(svc.recusar).toHaveBeenCalledWith("ana")
  })

  it("usuários: ações pela situação; a própria conta não tem ação", async () => {
    renderizar("/usuarios")
    const lista = await screen.findByRole("list", { name: "Usuários" })
    expect(within(lista).getByText("Gustavo (você)")).toBeInTheDocument()
    expect(within(lista).queryByRole("button", { name: /Gustavo/ })).not.toBeInTheDocument()
    expect(within(lista).getByRole("button", { name: "Bloquear Bia Ativa" })).toBeInTheDocument()
    expect(within(lista).getByRole("button", { name: "Trocar a senha de Bia Ativa" })).toBeInTheDocument()
    expect(within(lista).queryByRole("button", { name: "Bloquear Caio Bloqueado" })).not.toBeInTheDocument()
    expect(within(lista).getAllByText("Nunca")).toHaveLength(3) // só a Bia já entrou

    await userEvent.click(within(lista).getByRole("button", { name: "Bloquear Bia Ativa" }))
    await userEvent.click(screen.getByRole("button", { name: "Bloquear" }))
    expect(svc.bloquear).toHaveBeenCalledWith("bia")

    await userEvent.click(within(lista).getByRole("button", { name: "Reativar Caio Bloqueado" }))
    expect(svc.reativar).toHaveBeenCalledWith("caio")
  })

  it("trocar senha confirma e manda o link", async () => {
    renderizar("/usuarios")
    const lista = await screen.findByRole("list", { name: "Usuários" })
    await userEvent.click(within(lista).getByRole("button", { name: "Trocar a senha de Bia Ativa" }))
    await userEvent.click(screen.getByRole("button", { name: "Enviar link" }))
    expect(svc.forcarReset).toHaveBeenCalledWith("bia")
    expect(await screen.findByRole("status")).toHaveTextContent("Link de trocar senha enviado pra Bia Ativa.")
  })

  it("busca vai pro servidor, da página 1", async () => {
    renderizar("/usuarios")
    await screen.findByRole("list", { name: "Usuários" })
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar por nome ou e-mail" }), "bia")
    await vi.waitFor(() => expect(svc.usuarios).toHaveBeenLastCalledWith("bia", 1, 25))
  })

  it("erro do servidor aparece em vermelho e a lista continua", async () => {
    svc.aprovar.mockRejectedValue({ response: { status: 409, data: { message: "Este cadastro não está aguardando aprovação." } } })
    renderizar()
    const cadastros = await screen.findByRole("list", { name: "Cadastros" })
    await userEvent.click(within(cadastros).getByRole("button", { name: "Aprovar Ana Pendente" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Este cadastro não está aguardando aprovação.")
  })

  it("olho fechado: e-mail mascarado nas duas páginas (dado de terceiro não fica à vista)", async () => {
    setHideBalance(true)
    try {
      const { unmount } = renderizar()
      const cadastros = await screen.findByRole("list", { name: "Cadastros" })
      expect(within(cadastros).getByText("an•••@t•••.com")).toBeInTheDocument()
      expect(within(cadastros).queryByText("ana@teste.com")).not.toBeInTheDocument()
      unmount()
      renderizar("/usuarios")
      const lista = await screen.findByRole("list", { name: "Usuários" })
      expect(within(lista).getByText("bi•••@t•••.com")).toBeInTheDocument()
    } finally { setHideBalance(false) }
  })

  it("área própria: menu só do admin (Cadastros, Usuários, Voltar ao app), cada página no seu endereço", async () => {
    renderizar("")
    const menu = await screen.findByRole("navigation", { name: "Administração" })
    expect(within(menu).getByRole("link", { name: "Cadastros" })).toHaveAttribute("href", `${BASE}/cadastros`)
    expect(within(menu).getByRole("link", { name: "Usuários" })).toHaveAttribute("href", `${BASE}/usuarios`)
    expect(screen.getByRole("link", { name: "Voltar ao app" })).toHaveAttribute("href", "/dashboard")
    expect(await screen.findByRole("list", { name: "Cadastros" })).toBeInTheDocument() // o endereço puro abre Cadastros
    expect(screen.queryByRole("list", { name: "Usuários" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Nova transação" })).not.toBeInTheDocument() // nada do app financeiro
  })
})
