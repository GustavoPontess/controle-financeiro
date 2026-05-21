import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { PontesThemeProvider } from "../../components/pontes"
import SiteLayout from "../../pages/Site/SiteLayout"
import CouplesPage from "../../pages/Site/CouplesPage"

vi.mock("overlayscrollbars", () => ({ OverlayScrollbars: () => ({ destroy: () => {} }) }))
vi.mock("overlayscrollbars-react", () => ({
  OverlayScrollbarsComponent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

function renderCasais() {
  return render(
    <PontesThemeProvider>
      <MemoryRouter initialEntries={["/casais"]}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/casais" element={<CouplesPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </PontesThemeProvider>
  )
}

describe("CouplesPage (#77)", () => {
  it("renderiza headline do hero", () => {
    renderCasais()
    expect(screen.getByText("Dinheiro de casal")).toBeInTheDocument()
    expect(screen.getByText("sem briga.")).toBeInTheDocument()
  })

  it("mostra as 4 sections por tag", () => {
    renderCasais()
    expect(screen.getByText("Rateio")).toBeInTheDocument()
    expect(screen.getByText("Aprovação")).toBeInTheDocument()
    expect(screen.getByText("Acerto do mês")).toBeInTheDocument()
    // "Privacidade" também aparece no footer — checa pelo menos 1
    expect(screen.getAllByText("Privacidade").length).toBeGreaterThan(0)
  })

  it("CTA Família com botão criar conta", () => {
    renderCasais()
    expect(screen.getAllByText(/Criar conta grátis/i).length).toBeGreaterThan(0)
  })

  it("usa o shell do SiteLayout (navbar + footer)", () => {
    renderCasais()
    expect(screen.getByText("🎨 BRAND PREVIEW")).toBeInTheDocument()
    expect(screen.getByText("App Store")).toBeInTheDocument()
  })
})
