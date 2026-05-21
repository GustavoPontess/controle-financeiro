import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import HomePage from "../../pages/Site/HomePage"

// overlayscrollbars não roda em jsdom — mock no-op.
vi.mock("overlayscrollbars", () => ({
  OverlayScrollbars: () => ({ destroy: () => {} }),
}))
vi.mock("overlayscrollbars-react", () => ({
  OverlayScrollbarsComponent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/site"]}>
      <HomePage />
    </MemoryRouter>
  )
}

describe("HomePage (#108)", () => {
  it("renderiza navbar com links do site", () => {
    renderHome()
    expect(screen.getAllByText("Recursos").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Para Casais").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Para Contadores").length).toBeGreaterThan(0)
  })

  it("mostra botões de auth (Entrar / Criar conta)", () => {
    renderHome()
    expect(screen.getAllByText("Entrar").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Criar conta").length).toBeGreaterThan(0)
  })

  it("renderiza control bar BRAND PREVIEW com paletas", () => {
    renderHome()
    expect(screen.getByText("🎨 BRAND PREVIEW")).toBeInTheDocument()
    // botão de paleta "A" presente
    expect(screen.getByTitle(/Cobalto/)).toBeInTheDocument()
  })

  it("recolhe e reabre o brand preview", () => {
    renderHome()
    // recolher
    fireEvent.click(screen.getByLabelText("Esconder brand preview"))
    // pontinha de reabrir aparece
    expect(screen.getByLabelText("Mostrar brand preview")).toBeInTheDocument()
  })

  it("renderiza footer com app badges", () => {
    renderHome()
    expect(screen.getByText("App Store")).toBeInTheDocument()
    expect(screen.getByText("Google Play")).toBeInTheDocument()
  })
})
