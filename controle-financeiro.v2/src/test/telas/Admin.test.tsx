import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import type { UsuarioAdmin } from "../../types/Admin"

const auth = vi.hoisted(() => ({ usuario: { id: "eu", nome: "Gustavo", email: "pontes@pontesdev.com.br", isAdmin: true } as { id: string; nome: string; email: string; isAdmin?: boolean } | null }))
vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ usuario: auth.usuario, autenticado: true, carregando: false }) }))
vi.mock("../../services/adminService", () => ({
  default: {
    metricas: vi.fn(), pendentes: vi.fn(), usuarios: vi.fn(),
    aprovar: vi.fn(), recusar: vi.fn(), bloquear: vi.fn(), reativar: vi.fn(), forcarReset: vi.fn(),
  },
}))
import adminService from "../../services/adminService"
import { setHideBalance } from "../../estado/ocultar"
import Admin from "../../telas/Admin"

const svc = vi.mocked(adminService)

const pessoa = (id: string, nome: string, status: number, extra: Partial<UsuarioAdmin> = {}): UsuarioAdmin => ({
  id, nome, email: `${id}@teste.com`, status: status as UsuarioAdmin["status"], criadoEm: "2026-10-20T12:00:00", ...extra,
})
const ana = pessoa("ana", "Ana Pendente", 0)
const bia = pessoa("bia", "Bia Ativa", 1, { ultimoAcessoEm: "2026-10-23T10:00:00" })
const caio = pessoa("caio", "Caio Bloqueado", 3)
const eu = pessoa("eu", "Gustavo", 1)

const renderizar = () => render(
  <MemoryRouter initialEntries={["/admin"]}>
    <Routes>
      <Route path="/admin" element={<Admin />} />
      <Route path="/dashboard" element={<p>visão geral</p>} />
    </Routes>
  </MemoryRouter>,
)

describe("Admin", () => {
  beforeEach(() => {
    auth.usuario = { id: "eu", nome: "Gustavo", email: "pontes@pontesdev.com.br", isAdmin: true }
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

  it("quem não é admin vai pra Visão geral e não chama a API de admin", () => {
    auth.usuario = { id: "x", nome: "Ana", email: "a@b.c", isAdmin: false }
    renderizar()
    expect(screen.getByText("visão geral")).toBeInTheDocument()
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
    renderizar()
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
    renderizar()
    const lista = await screen.findByRole("list", { name: "Usuários" })
    await userEvent.click(within(lista).getByRole("button", { name: "Trocar a senha de Bia Ativa" }))
    await userEvent.click(screen.getByRole("button", { name: "Enviar link" }))
    expect(svc.forcarReset).toHaveBeenCalledWith("bia")
    expect(await screen.findByRole("status")).toHaveTextContent("Link de trocar senha enviado pra Bia Ativa.")
  })

  it("busca vai pro servidor, da página 1", async () => {
    renderizar()
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

  it("olho fechado: e-mail mascarado nas duas listas (dado de terceiro não fica à vista)", async () => {
    setHideBalance(true)
    try {
      renderizar()
      const cadastros = await screen.findByRole("list", { name: "Cadastros" })
      expect(within(cadastros).getByText("an•••@t•••.com")).toBeInTheDocument()
      expect(within(cadastros).queryByText("ana@teste.com")).not.toBeInTheDocument()
      const lista = await screen.findByRole("list", { name: "Usuários" })
      expect(within(lista).getByText("bi•••@t•••.com")).toBeInTheDocument()
    } finally { setHideBalance(false) }
  })
})
