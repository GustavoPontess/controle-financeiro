import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { PontesDrawer, PontesNavbar, PontesThemeProvider } from "../../components/pontes"
import Navbar from "../../components/Navbar/Navbar"
import DefaultLayout from "../../layouts/Default/DefaultLayout"
import AdminLayout from "../../layouts/Admin/AdminLayout"
import { CELULAR, useMediaQuery } from "../../hooks/useMediaQuery"

// Responsivo P0 (2026-10-05): no celular a barra lateral ficava fixa em 208px e o conteúdo com ~150px.
// Agora vira gaveta por cima (fechada por padrão), aberta pelo ☰ do topo e fechada ao trocar de tela.

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: { id: "u1", nome: "Gabriel Dev", email: "dev@controle.test" },
    savedAccounts: [], logout: vi.fn(), switchAccount: vi.fn(), accountKey: "u1",
  }),
}))
vi.mock("../../components/Notificacoes/NotificationBell", () => ({ default: () => null }))
vi.mock("../../components/AddAccountDialog/AddAccountDialog", () => ({ default: () => null }))
vi.mock("../../components/Pwa/InstallPrompt", () => ({ default: () => null }))
vi.mock("../../services/categoryService", () => ({ getCategories: vi.fn().mockResolvedValue([]) }))
vi.mock("../../pages/Admin/AdminNotificationBell", () => ({ default: () => null }))

// matchMedia controlável: `largura` decide se a query de celular casa; `mudar` avisa os ouvintes.
let celular = false
const ouvintes = new Set<() => void>()
function instalarMatchMedia() {
  window.matchMedia = vi.fn((query: string) => ({
    get matches() { return query === CELULAR && celular },
    media: query, onchange: null,
    addEventListener: (_: string, fn: () => void) => ouvintes.add(fn),
    removeEventListener: (_: string, fn: () => void) => ouvintes.delete(fn),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}
function mudar(ehCelular: boolean) {
  celular = ehCelular
  act(() => ouvintes.forEach((fn) => fn()))
}

const original = window.matchMedia
beforeEach(() => { celular = false; ouvintes.clear(); instalarMatchMedia() })
afterEach(() => { window.matchMedia = original })

describe("useMediaQuery", () => {
  it("diz se a query casa e acompanha a mudança de tamanho", () => {
    const { result } = renderHook(() => useMediaQuery(CELULAR))
    expect(result.current).toBe(false)
    mudar(true)
    expect(result.current).toBe(true)
  })

  it("sem matchMedia (ambiente sem suporte) trata como desktop", () => {
    // @ts-expect-error — simula navegador/ambiente sem matchMedia
    window.matchMedia = undefined
    const { result } = renderHook(() => useMediaQuery(CELULAR))
    expect(result.current).toBe(false)
  })
})

describe("PontesDrawer bare", () => {
  it("sem cabeçalho nem botão de fechar, com nome acessível; fechada fica fora do leitor de tela", () => {
    const { rerender } = render(
      <PontesDrawer bare open={false} onClose={() => {}} ariaLabel="Menu"><span>conteúdo</span></PontesDrawer>,
    )
    const painel = screen.getByLabelText("Menu", { selector: "aside" })
    expect(painel).toHaveAttribute("aria-hidden", "true")
    expect(screen.queryByRole("button", { name: "Fechar" })).not.toBeInTheDocument()

    rerender(<PontesDrawer bare open onClose={() => {}} ariaLabel="Menu"><span>conteúdo</span></PontesDrawer>)
    expect(painel).not.toHaveAttribute("aria-hidden")
    expect(painel).toHaveAttribute("data-open", "true")
  })
})

describe("Navbar no celular", () => {
  it("mostra ☰ 'Abrir menu' (não o recolher/expandir do desktop) e chama o toggle", () => {
    const toggle = vi.fn()
    render(
      <PontesThemeProvider>
        <MemoryRouter initialEntries={["/transactions"]}>
          <Navbar toggleDrawer={toggle} sidebarOpen={false} celular openTransaction={() => {}} canCreateTransaction />
        </MemoryRouter>
      </PontesThemeProvider>,
    )
    expect(screen.queryByRole("button", { name: /Recolher menu|Expandir menu/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }))
    expect(toggle).toHaveBeenCalledOnce()
  })

  it("compacta: sem caminho, busca e Nova transação só com ícone (nome acessível mantido)", () => {
    const busca = vi.fn(); const nova = vi.fn()
    render(
      <PontesThemeProvider>
        <MemoryRouter initialEntries={["/credit-cards/parcelamentos"]}>
          <Navbar toggleDrawer={() => {}} sidebarOpen={false} celular openTransaction={nova} canCreateTransaction
            openCommandPalette={busca} />
        </MemoryRouter>
      </PontesThemeProvider>,
    )
    expect(screen.getByRole("heading", { name: "Parcelamentos" })).toBeInTheDocument()
    expect(screen.queryByText("Cartões de Crédito")).not.toBeInTheDocument() // caminho some
    // Busca só com a lupa e "+" sem texto: é CSS (< 1024px), o jsdom não aplica — aqui só o nome acessível.
    fireEvent.click(screen.getByRole("button", { name: "Nova transação" }))
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }))
    expect(nova).toHaveBeenCalledOnce()
    expect(busca).toHaveBeenCalledOnce()
  })
})

describe("DefaultLayout no celular", () => {
  function renderShell() {
    return render(
      <PontesThemeProvider>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route element={<DefaultLayout />}>
              <Route path="/dashboard" element={<p>tela dashboard</p>} />
              <Route path="/transactions" element={<p>tela transações</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </PontesThemeProvider>,
    )
  }
  const gaveta = () => screen.getByLabelText("Menu", { selector: "aside" })

  it("a barra lateral vira gaveta FECHADA; ☰ abre; tocar num item navega e fecha", () => {
    celular = true
    renderShell()
    expect(gaveta()).not.toHaveAttribute("data-open")

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }))
    expect(gaveta()).toHaveAttribute("data-open", "true")

    fireEvent.click(screen.getByText("Transações"))
    expect(screen.getByText("tela transações")).toBeInTheDocument()
    expect(gaveta()).not.toHaveAttribute("data-open")
  })

  it("Esc fecha a gaveta", () => {
    celular = true
    renderShell()
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }))
    fireEvent.keyDown(document, { key: "Escape" })
    expect(gaveta()).not.toHaveAttribute("data-open")
  })

  it("no tablet a barra lateral começa RECOLHIDA (trilho), sem gaveta", () => {
    const original2 = window.matchMedia
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === "(max-width: 1023px)", media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
    renderShell()
    expect(screen.queryByLabelText("Menu", { selector: "aside" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Expandir menu" })).toBeInTheDocument()
    window.matchMedia = original2
  })

  it("no desktop continua a barra lateral fixa (sem gaveta, com recolher/expandir)", () => {
    renderShell()
    expect(screen.queryByLabelText("Menu", { selector: "aside" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Recolher menu" })).toBeInTheDocument()
  })
})

describe("PontesNavbar (site) no celular", () => {
  it("☰ abre o painel com links e login/cadastro; tocar num link navega e fecha", () => {
    const ir = vi.fn()
    render(<PontesNavbar onNavigate={ir} activePath="/sobre" />)
    expect(screen.queryByRole("button", { name: "Criar conta", hidden: false })).toBeInTheDocument() // barra (desktop)

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }))
    // Painel: os 4 links + Entrar/Criar conta de novo (a barra continua no DOM; o CSS esconde no celular).
    expect(screen.getAllByText("Para Casais")).toHaveLength(2)
    expect(screen.getAllByRole("button", { name: "Criar conta" })).toHaveLength(2)

    fireEvent.click(screen.getAllByText("Para Casais")[1])
    expect(ir).toHaveBeenCalledWith("/casais")
    expect(screen.getAllByText("Para Casais")).toHaveLength(1)                 // painel fechou
    expect(screen.getByRole("button", { name: "Abrir menu" })).toBeInTheDocument()
  })
})

describe("AdminLayout no celular", () => {
  it("mesma gaveta do app: fechada, ☰ abre, tocar num item navega e fecha", () => {
    celular = true
    render(
      <PontesThemeProvider>
        <MemoryRouter initialEntries={["/admin/pendentes"]}>
          <Routes>
            <Route element={<AdminLayout />}>
              <Route path="/admin/pendentes" element={<p>fila</p>} />
              <Route path="/admin/usuarios" element={<p>tela usuários</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </PontesThemeProvider>,
    )
    const gaveta = () => screen.getByLabelText("Menu", { selector: "aside" })
    expect(gaveta()).not.toHaveAttribute("data-open")
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }))
    expect(gaveta()).toHaveAttribute("data-open", "true")
    fireEvent.click(screen.getByText("Usuários"))
    expect(screen.getByText("tela usuários")).toBeInTheDocument()
    expect(gaveta()).not.toHaveAttribute("data-open")
  })
})
