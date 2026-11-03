import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

const trocarConta = vi.fn(async () => {})
vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({
  usuario: { id: "u1", nome: "Gabriel Dev", email: "dev@pontes.app" }, sair: vi.fn(async () => {}), trocarConta,
  contas: [{ id: "u1", nome: "Gabriel Dev", email: "dev@pontes.app" }, { id: "u2", nome: "Marina Dev", email: "conjuge@pontes.app" }],
}) }))
vi.mock("../../services/notificacaoService", () => ({
  getContagemNaoLidas: vi.fn(async () => ({ naoLidas: 0 })),
  getNotificacoes: vi.fn(async () => []),
  marcarNotificacaoLida: vi.fn(async () => {}),
  marcarTodasLidas: vi.fn(async () => {}),
}))
vi.mock("../../services/familiaService", () => ({
  getFamilias: vi.fn(async () => [{ id: "f1", nome: "Casa Dev", criadoPorUsuarioId: "u1", criadoEm: "", ehAdmin: true, totalMembros: 2 }]),
  getConvitesPendentes: vi.fn(async () => [{ id: "c1", familiaId: "f2", nomeFamilia: "Sítio", emailConvidado: "dev@pontes.app", papel: "Filho(a)", status: 1, expiraEm: "", criadoEm: "", token: "tok", papelPermissao: 2 }]),
}))
import V2Layout from "../../layout/V2Layout"

const renderizar = (inicio: string) => render(
  <MemoryRouter initialEntries={[inicio]}>
    <Routes>
      <Route element={<V2Layout />}>
        <Route path="/dashboard" element={<p>painel pessoal</p>} />
        <Route path="/familias" element={<p>lista de famílias</p>} />
        <Route path="/familias/nova" element={<p>nova família</p>} />
        <Route path="/familias/:id" element={<p>visão da família</p>} />
        <Route path="/familias/:id/membros" element={<p>membros da família</p>} />
        <Route path="/familias/:id/convidar" element={<p>convidar</p>} />
        <Route path="/entrar" element={<p>entrar</p>} />
      </Route>
    </Routes>
  </MemoryRouter>,
)
const menu = () => screen.getByRole("navigation", { name: "Principal" })

describe("Espaços (Pessoal | família) no menu da conta", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("dentro de uma família o menu é o da família e o bloco da conta diz qual; trocar pra Pessoal volta ao menu pessoal", async () => {
    renderizar("/familias/f1")
    const conta = await screen.findByRole("button", { name: "Gabriel Dev" })
    await waitFor(() => expect(conta).toHaveTextContent("Casa Dev"))
    expect(within(menu()).getByRole("link", { name: "Membros" })).toHaveAttribute("href", "/familias/f1/membros")
    // As Transações do menu são as da família (as pessoais não aparecem aqui).
    expect(within(menu()).getByRole("link", { name: "Transações" })).toHaveAttribute("href", "/familias/f1/transacoes")
    expect(within(menu()).queryByRole("link", { name: "Famílias" })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1, name: "Visão geral" })).toBeInTheDocument()

    await userEvent.click(conta)
    const seletor = screen.getByRole("menu", { name: "Conta e espaços" })
    expect(within(seletor).getByRole("menuitem", { name: "Configurações" })).toBeInTheDocument()
    expect(within(seletor).getByRole("menuitemradio", { name: /Casa Dev/ })).toHaveAttribute("aria-checked", "true")
    expect(within(seletor).getByRole("menuitem", { name: /Convites pra você/ })).toHaveTextContent("1")
    // A própria conta é o espaço pessoal: clicar nela sai da família.
    await userEvent.click(within(seletor).getByRole("menuitemradio", { name: /Gabriel Dev/ }))
    expect(await screen.findByText("painel pessoal")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Gabriel Dev" })).toHaveTextContent("Pessoal")
    expect(within(menu()).getByRole("link", { name: "Transações" })).toBeInTheDocument()
    expect(within(menu()).queryByRole("link", { name: "Membros" })).not.toBeInTheDocument()
  })

  it("convites e nova família saem do menu da conta; a lista de famílias não está no menu lateral", async () => {
    renderizar("/dashboard")
    await userEvent.click(await screen.findByRole("button", { name: "Gabriel Dev" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: /Convites pra você/ }))
    expect(await screen.findByText("lista de famílias")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1, name: "Famílias" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Gabriel Dev" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /Nova família/ }))
    expect(await screen.findByText("nova família")).toBeInTheDocument()
  })

  it("as outras contas conectadas ficam em Contas: trocar chama o servidor e volta pro painel; adicionar leva ao login", async () => {
    renderizar("/familias/f1")
    await userEvent.click(await screen.findByRole("button", { name: "Gabriel Dev" }))
    const menu = screen.getByRole("menu", { name: "Conta e espaços" })
    expect(menu).toHaveTextContent("Famílias")
    expect(menu).toHaveTextContent("Contas")
    expect(within(menu).queryByText("Pessoal")).not.toBeInTheDocument()
    expect(within(menu).queryByRole("menuitem", { name: /Gabriel Dev/ })).not.toBeInTheDocument()
    await userEvent.click(within(menu).getByRole("menuitem", { name: /Marina Dev/ }))
    expect(trocarConta).toHaveBeenCalledWith("u2")
    expect(await screen.findByText("painel pessoal")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Gabriel Dev" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /Adicionar conta/ }))
    expect(await screen.findByText("entrar")).toBeInTheDocument()
  })

  it("tela interna da família (convidar) mostra a seta de voltar pra página do menu a que pertence", async () => {
    renderizar("/familias/f1/convidar")
    expect(await screen.findByRole("heading", { level: 1, name: "Membros" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }))
    expect(await screen.findByText("membros da família")).toBeInTheDocument()
  })
})

describe("Dica do selo Beta", () => {
  beforeEach(() => { localStorage.clear() })

  it("aparece uma vez; o × some com ela e ela não volta", async () => {
    const { unmount } = renderizar("/dashboard")
    expect(await screen.findByRole("note")).toHaveTextContent("Achou algo estranho? Toque em Beta.")
    await userEvent.click(screen.getByRole("button", { name: "Fechar a dica" }))
    expect(screen.queryByRole("note")).not.toBeInTheDocument()
    unmount()
    renderizar("/dashboard")
    await screen.findByRole("button", { name: "Gabriel Dev" })
    expect(screen.queryByRole("note")).not.toBeInTheDocument()
  })

  it("abrir o Beta também dispensa a dica", async () => {
    renderizar("/dashboard")
    await screen.findByRole("note")
    await userEvent.click(screen.getByRole("button", { name: /^Beta:/ }))
    expect(screen.queryByRole("note")).not.toBeInTheDocument()
    expect(Object.keys(localStorage).some(k => k.startsWith("v2:dicaBeta:") && localStorage.getItem(k) === "1")).toBe(true)
  })
})
