import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("../../api/cliente", () => ({ api: { put: vi.fn(async () => ({ data: null })) } }))
import { api } from "../../api/cliente"
import AvisoDeFuso, { deslocamento, nomeDoFuso } from "../../componentes/AvisoDeFuso"

// Nos testes o aparelho está em Brasília (setup.ts).
describe("AvisoDeFuso", () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })

  it("aparelho num horário diferente do da conta: pergunta; \"Usar\" grava o fuso do aparelho e recarrega", async () => {
    const aoMudar = vi.fn()
    render(<AvisoDeFuso usuarioId="u1" fusoDaConta="America/Rio_Branco" aoMudar={aoMudar} />)

    const aviso = screen.getByRole("status")
    expect(aviso.textContent).toMatch(/2h depois do horário do Acre, o da sua conta/)
    await userEvent.click(screen.getByRole("button", { name: "Usar este horário" }))
    expect(api.put).toHaveBeenCalledWith("/usuarios/me/fuso", { fuso: "America/Sao_Paulo" }, { skipErrorToast: true })
    expect(aoMudar).toHaveBeenCalled()
  })

  it("\"Manter o da conta\" some e não pergunta de novo neste aparelho", async () => {
    const { unmount } = render(<AvisoDeFuso usuarioId="u1" fusoDaConta="America/Rio_Branco" aoMudar={vi.fn()} />)
    await userEvent.click(screen.getByRole("button", { name: "Manter o da conta" }))
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(api.put).not.toHaveBeenCalled()
    unmount()

    render(<AvisoDeFuso usuarioId="u1" fusoDaConta="America/Rio_Branco" aoMudar={vi.fn()} />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("mesmo horário com outro nome, ou conta sem fuso: nada a perguntar", () => {
    render(<AvisoDeFuso usuarioId="u1" fusoDaConta="America/Bahia" aoMudar={vi.fn()} />)
    render(<AvisoDeFuso usuarioId="u1" fusoDaConta={null} aoMudar={vi.fn()} />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("deslocamento e nome do fuso", () => {
    expect(deslocamento("America/Rio_Branco")).toBe(-300)
    expect(deslocamento("America/Noronha")).toBe(-120)
    expect(nomeDoFuso("America/Sao_Paulo")).toBe("Horário de Brasília")
  })
})
