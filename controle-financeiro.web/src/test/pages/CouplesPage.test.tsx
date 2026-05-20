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

describe("CouplesPage (#77) — usando biblioteca Pontes", () => {
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
    // "Privacidade" aparece também no footer — checa que tem pelo menos 1
    expect(screen.getAllByText("Privacidade").length).toBeGreaterThan(0)
  })

  it("renderiza CTAs (Hero + CtaFamilia) com botão de começar", () => {
    renderCouples()
    expect(screen.getByText("Começar grátis")).toBeInTheDocument()
    expect(screen.getByText("Criar conta grátis")).toBeInTheDocument()
  })

  it("PontesNavbar carregada com botões de auth", () => {
    renderCouples()
    expect(screen.getAllByText("Entrar").length).toBeGreaterThan(0)
    expect(screen.getByText("Criar conta")).toBeInTheDocument()
  })

  it("PontesFooter carregado com colunas principais", () => {
    renderCouples()
    expect(screen.getByText("Produto")).toBeInTheDocument()
    expect(screen.getByText("Empresa")).toBeInTheDocument()
    expect(screen.getByText("Legal")).toBeInTheDocument()
  })
})
