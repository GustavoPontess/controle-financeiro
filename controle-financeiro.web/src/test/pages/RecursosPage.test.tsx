import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { PontesThemeProvider } from "../../components/pontes"
import SiteLayout from "../../pages/Site/SiteLayout"
import RecursosPage from "../../pages/Site/RecursosPage"

vi.mock("overlayscrollbars", () => ({ OverlayScrollbars: () => ({ destroy: () => {} }) }))
vi.mock("overlayscrollbars-react", () => ({
  OverlayScrollbarsComponent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

function renderRecursos() {
  return render(
    <PontesThemeProvider>
      <MemoryRouter initialEntries={["/recursos"]}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/recursos" element={<RecursosPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </PontesThemeProvider>
  )
}

describe("RecursosPage (#79)", () => {
  it("renderiza headline do hero", () => {
    renderRecursos()
    expect(screen.getByText("Um app de finanças")).toBeInTheDocument()
    expect(screen.getByText("de verdade completo.")).toBeInTheDocument()
  })

  it("mostra as 8 categorias por tag", () => {
    renderRecursos()
    for (const tag of ["Tracking", "Orçamento", "Família", "Cartão", "Metas", "Importação", "Open Finance", "Notificações"]) {
      expect(screen.getAllByText(tag).length).toBeGreaterThan(0)
    }
  })

  it("mostra comparativo Pontes vs concorrentes", () => {
    renderRecursos()
    expect(screen.getByText("Comparativo")).toBeInTheDocument()
    expect(screen.getByText("Mobills")).toBeInTheDocument()
  })

  it("CTA com botão criar conta", () => {
    renderRecursos()
    expect(screen.getAllByText(/Criar conta grátis/i).length).toBeGreaterThan(0)
  })

  it("usa o shell do SiteLayout (navbar + footer)", () => {
    renderRecursos()
    expect(screen.getByText("🎨 BRAND PREVIEW")).toBeInTheDocument()
    expect(screen.getByText("App Store")).toBeInTheDocument()
  })
})
