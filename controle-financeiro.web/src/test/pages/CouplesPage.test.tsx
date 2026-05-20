import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import CouplesPage from "../../pages/Site/CouplesPage"

function renderCouples() {
  return render(
    <MemoryRouter initialEntries={["/site/casais"]}>
      <CouplesPage />
    </MemoryRouter>
  )
}

describe("CouplesPage (#77)", () => {
  it("renderiza headline principal do hero", () => {
    renderCouples()
    expect(screen.getByText("Dinheiro de casal")).toBeInTheDocument()
    expect(screen.getByText("sem briga.")).toBeInTheDocument()
  })

  it("mostra todas as 4 sections principais por tag", () => {
    renderCouples()
    expect(screen.getByText("Rateio")).toBeInTheDocument()
    expect(screen.getByText("Aprovação")).toBeInTheDocument()
    expect(screen.getByText("Acerto do mês")).toBeInTheDocument()
    expect(screen.getByText("Privacidade")).toBeInTheDocument()
  })

  it("renderiza CTA do plano Família com botão", () => {
    renderCouples()
    const ctas = screen.getAllByText(/Criar conta grátis/i)
    expect(ctas.length).toBeGreaterThan(0)
  })

  it("inclui SiteNavbar com botões de auth", () => {
    renderCouples()
    // "Entrar" aparece tanto no navbar quanto no footer
    expect(screen.getAllByText("Entrar").length).toBeGreaterThan(0)
    expect(screen.getByText("Criar conta")).toBeInTheDocument()
  })
})
