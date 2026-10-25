import { describe, expect, it, vi } from "vitest"
import { lazy, Suspense } from "react"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

const auth = vi.hoisted(() => ({ isAdmin: false }))
vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ usuario: { id: "u", nome: "Ana", email: "a@b.c", isAdmin: auth.isAdmin } }) }))
import SoAdmin from "../../auth/SoAdmin"

// Igual ao App: o porteiro decide ANTES do lazy. Quem não é admin nunca baixa a tela de admin.
const renderizar = (carregar: () => Promise<{ default: () => React.JSX.Element }>) => {
  const Tela = lazy(carregar)
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<SoAdmin><Suspense fallback={null}><Tela /></Suspense></SoAdmin>} />
        <Route path="/dashboard" element={<p>visão geral</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("SoAdmin (porteiro do admin)", () => {
  it("quem não é admin vai pra Visão geral e a tela de admin nem é baixada", () => {
    auth.isAdmin = false
    const carregar = vi.fn(() => Promise.resolve({ default: () => <p>tela admin</p> }))
    renderizar(carregar)
    expect(screen.getByText("visão geral")).toBeInTheDocument()
    expect(carregar).not.toHaveBeenCalled()
  })

  it("admin baixa e vê a tela", async () => {
    auth.isAdmin = true
    const carregar = vi.fn(() => Promise.resolve({ default: () => <p>tela admin</p> }))
    renderizar(carregar)
    expect(await screen.findByText("tela admin")).toBeInTheDocument()
    expect(carregar).toHaveBeenCalledTimes(1)
  })
})
