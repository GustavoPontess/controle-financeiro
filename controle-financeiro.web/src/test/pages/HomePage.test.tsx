import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { PontesThemeProvider } from "../../components/pontes"
import SiteLayout from "../../pages/Site/SiteLayout"
import HomePage from "../../pages/Site/HomePage"

// overlayscrollbars não roda em jsdom — mock no-op.
vi.mock("overlayscrollbars", () => ({
  OverlayScrollbars: () => ({ destroy: () => {} }),
}))
vi.mock("overlayscrollbars-react", () => ({
  OverlayScrollbarsComponent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Renderiza HomePage dentro do SiteLayout (Outlet context fornece p/font).
function renderSite(path = "/site") {
  return render(
    <PontesThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/site" element={<HomePage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </PontesThemeProvider>
  )
}

describe("SiteLayout + HomePage (#108)", () => {
  it("layout renderiza navbar com links do site", () => {
    renderSite()
    expect(screen.getAllByText("Recursos").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Para Casais").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Para Contadores").length).toBeGreaterThan(0)
  })

  it("layout mostra botões de auth", () => {
    renderSite()
    expect(screen.getAllByText("Entrar").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Criar conta").length).toBeGreaterThan(0)
  })

  it("layout tem control bar BRAND PREVIEW + paletas", () => {
    renderSite()
    expect(screen.getByText("🎨 BRAND PREVIEW")).toBeInTheDocument()
    expect(screen.getByTitle(/Cobalto/)).toBeInTheDocument()
  })

  it("recolhe e reabre o brand preview", () => {
    renderSite()
    fireEvent.click(screen.getByLabelText("Esconder brand preview"))
    expect(screen.getByLabelText("Mostrar brand preview")).toBeInTheDocument()
  })

  it("layout tem footer com app badges", () => {
    renderSite()
    expect(screen.getByText("App Store")).toBeInTheDocument()
    expect(screen.getByText("Google Play")).toBeInTheDocument()
  })

  it("HomePage renderiza conteúdo do hero (topbar promo)", () => {
    renderSite()
    expect(screen.getAllByText(/Beta aberto/).length).toBeGreaterThan(0)
  })
})
