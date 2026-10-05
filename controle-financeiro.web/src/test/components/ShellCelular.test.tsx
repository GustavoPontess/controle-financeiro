import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { PontesDrawer, PontesThemeProvider } from "../../components/pontes"
import Navbar from "../../components/Navbar/Navbar"
import DefaultLayout from "../../layouts/Default/DefaultLayout"
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
vi.mock("../../pages/Transactions/components/NewTransactionDialog/NewTransactionDialog", () => ({ default: () => null }))
vi.mock("../../services/categoryService", () => ({ getCategories: vi.fn().mockResolvedValue([]) }))

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

  it("no desktop continua a barra lateral fixa (sem gaveta, com recolher/expandir)", () => {
    renderShell()
    expect(screen.queryByLabelText("Menu", { selector: "aside" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Recolher menu" })).toBeInTheDocument()
  })
})
