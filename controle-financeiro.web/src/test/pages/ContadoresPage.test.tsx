import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { PontesThemeProvider } from "../../components/pontes"
import SiteLayout from "../../pages/Site/SiteLayout"
import ContadoresPage from "../../pages/Site/ContadoresPage"

vi.mock("overlayscrollbars", () => ({ OverlayScrollbars: () => ({ destroy: () => {} }) }))
vi.mock("overlayscrollbars-react", () => ({
  OverlayScrollbarsComponent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

function renderContadores() {
  return render(
    <PontesThemeProvider>
      <MemoryRouter initialEntries={["/contadores"]}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/contadores" element={<ContadoresPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </PontesThemeProvider>
  )
}

describe("ContadoresPage (#78)", () => {
  it("renderiza headline do hero", () => {
    renderContadores()
    expect(screen.getByText("Todos os clientes")).toBeInTheDocument()
    expect(screen.getByText("numa tela só.")).toBeInTheDocument()
  })

  it("mostra as sections por tag", () => {
    renderContadores()
    expect(screen.getByText("Visão multi-cliente")).toBeInTheDocument()
    expect(screen.getByText("Convite")).toBeInTheDocument()
    expect(screen.getByText("Honorários")).toBeInTheDocument()
    expect(screen.getByText("Relatórios")).toBeInTheDocument()
  })

  it("CTA Contador com botão criar conta", () => {
    renderContadores()
    expect(screen.getAllByText(/Criar conta grátis/i).length).toBeGreaterThan(0)
  })

  it("usa o shell do SiteLayout (navbar + footer)", () => {
    renderContadores()
    expect(screen.getByText("🎨 BRAND PREVIEW")).toBeInTheDocument()
    expect(screen.getByText("App Store")).toBeInTheDocument()
  })
})
