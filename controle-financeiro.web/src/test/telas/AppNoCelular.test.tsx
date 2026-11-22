// Configurações › App no celular (2026-11-17): o passo a passo do iPhone (lá não existe botão de instalar), o aviso de
// instalado e o botão do Android.
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import AppNoCelular from "../../telas/AppNoCelular"

const renderizar = () => render(<MemoryRouter><AppNoCelular /></MemoryRouter>)
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1"

describe("App no celular", () => {
  afterEach(() => { vi.restoreAllMocks() })

  it("no iPhone mostra o caminho do Safari, com os botões como aparecem lá", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE)
    renderizar()
    const passos = screen.getAllByRole("listitem")
    expect(passos).toHaveLength(3)
    expect(passos[0]).toHaveTextContent("No Safari, toque em Compartilhar")
    expect(passos[1]).toHaveTextContent("Adicionar à Tela de Início")
    expect(screen.queryByRole("button", { name: "Instalar" })).not.toBeInTheDocument()
  })

  it("aberto como app, diz que já está instalado", () => {
    // O jsdom não tem matchMedia: põe um que responde "aberto como app".
    const original = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: q === "(display-mode: standalone)" })) as never
    try {
      renderizar()
      expect(screen.getByText("Instalado neste aparelho")).toBeInTheDocument()
      expect(screen.queryByRole("listitem")).not.toBeInTheDocument()
    } finally {
      window.matchMedia = original
    }
  })
})
