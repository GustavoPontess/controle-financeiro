import { beforeAll, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

const auth = vi.hoisted(() => ({ autenticado: false }))
vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ autenticado: auth.autenticado, carregando: false }) }))
import PaginaSite from "../../site/PaginaSite"

// jsdom não tem IntersectionObserver (o site anima blocos e a ponte ao entrar na tela).
beforeAll(() => {
  window.scrollTo = (() => {}) as typeof window.scrollTo
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } } as unknown as typeof IntersectionObserver
})

const renderizar = (rota: string) => render(
  <MemoryRouter initialEntries={[rota]}>
    <Routes>
      <Route path="/" element={<PaginaSite nome="home" />} />
      <Route path="/planos" element={<PaginaSite nome="planos" />} />
      <Route path="/casa" element={<PaginaSite nome="casa" />} />
      <Route path="/entrar" element={<p>tela de entrar</p>} />
      <Route path="/dashboard" element={<p>visão geral</p>} />
    </Routes>
  </MemoryRouter>,
)

describe("site público (HTML do rascunho aprovado)", () => {
  it("home abre pra quem não entrou, com a folha do site e o título da aba", () => {
    auth.autenticado = false
    renderizar("/")
    expect(document.querySelector(".topo")).toBeInTheDocument()
    expect(document.getElementById("pontes-site-css")).toBeInTheDocument()
    expect(document.title).toMatch(/Pontes/)
  })

  it("quem já entrou e abre / vai direto pra Visão geral", () => {
    auth.autenticado = true
    renderizar("/")
    expect(screen.getByText("visão geral")).toBeInTheDocument()
  })

  it("as outras páginas abrem mesmo logado", () => {
    auth.autenticado = true
    renderizar("/planos")
    expect(document.querySelector(".topo")).toBeInTheDocument()
  })

  it("link interno navega pelo app (sem recarregar)", async () => {
    auth.autenticado = false
    renderizar("/")
    const entrar = document.querySelector<HTMLAnchorElement>('a[href="/entrar"]')!
    await userEvent.click(entrar)
    expect(await screen.findByText("tela de entrar")).toBeInTheDocument()
  })

  it("seletor da /casa liga sem duplicar a barra presa no topo", () => {
    auth.autenticado = false
    renderizar("/casa")
    expect(document.querySelectorAll(".seletor-fixo")).toHaveLength(1)
  })
})
