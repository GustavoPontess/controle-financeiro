import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { PontesThemeProvider } from "../../components/pontes"
import SiteLayout from "../../pages/Site/SiteLayout"
import SobrePage from "../../pages/Site/SobrePage"

vi.mock("overlayscrollbars", () => ({ OverlayScrollbars: () => ({ destroy: () => {} }) }))
vi.mock("overlayscrollbars-react", () => ({
  OverlayScrollbarsComponent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

function renderSobre() {
  return render(
    <PontesThemeProvider>
      <MemoryRouter initialEntries={["/sobre"]}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/sobre" element={<SobrePage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </PontesThemeProvider>
  )
}

describe("SobrePage (#80)", () => {
  it("renderiza headline do manifesto", () => {
    renderSobre()
    expect(screen.getByText(/Dinheiro é coisa de/)).toBeInTheDocument()
    expect(screen.getByText("duas pessoas")).toBeInTheDocument()
  })

  it("mostra as sections institucionais", () => {
    renderSobre()
    expect(screen.getByText("Por que existimos")).toBeInTheDocument()
    expect(screen.getByText("No que acreditamos")).toBeInTheDocument()
    expect(screen.getByText("Quem faz")).toBeInTheDocument()
    expect(screen.getByText("Onde estamos")).toBeInTheDocument()
  })

  it("mostra o fundador", () => {
    renderSobre()
    expect(screen.getByText("Gustavo Pontes")).toBeInTheDocument()
    expect(screen.getByText("Fundador · Produto & Engenharia")).toBeInTheDocument()
  })

  it("CTA de contato com criar conta", () => {
    renderSobre()
    expect(screen.getAllByText(/Criar conta grátis/i).length).toBeGreaterThan(0)
  })

  it("usa o shell do SiteLayout (navbar + footer)", () => {
    renderSobre()
    expect(screen.getByText("🎨 BRAND PREVIEW")).toBeInTheDocument()
    expect(screen.getByText("App Store")).toBeInTheDocument()
  })
})
