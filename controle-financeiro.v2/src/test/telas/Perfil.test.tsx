import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const recarregar = vi.fn(async () => {})
vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ usuario: { id: "u1", nome: "Ana Teste", email: "ana@teste.com", dataNascimento: "1990-05-10T00:00:00" }, recarregar }) }))
vi.mock("../../services/minhaContaService", () => ({ default: { atualizarPerfil: vi.fn(async () => ({})), enviarFoto: vi.fn(async () => "2026-10-18T19:00:00"), removerFoto: vi.fn(async () => {}) } }))
import contaService from "../../services/minhaContaService"
import Perfil from "../../telas/Perfil"

describe("Perfil (Configurações)", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("mostra os dados; editar valida nome vazio e data futura; salvar manda nome e nascimento e recarrega a conta", async () => {
    render(<Perfil />)
    expect(screen.getByText("ana@teste.com")).toBeInTheDocument()
    expect(screen.getByText("10/05/1990")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /Editar/ }))
    const nome = screen.getByRole("textbox", { name: "Nome" })
    expect(nome).toHaveValue("Ana Teste")
    await userEvent.clear(nome)
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(screen.getByText("Diga como quer ser chamado.")).toBeInTheDocument()
    expect(contaService.atualizarPerfil).not.toHaveBeenCalled()

    await userEvent.type(nome, "  Ana Silva ")
    const nascimento = screen.getByLabelText("Data de nascimento")
    fireEvent.change(nascimento, { target: { value: "2999-01-01" } })
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(screen.getByText("Não pode ser no futuro.")).toBeInTheDocument()
    expect(contaService.atualizarPerfil).not.toHaveBeenCalled()

    fireEvent.change(nascimento, { target: { value: "2000-01-02" } })
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(contaService.atualizarPerfil).toHaveBeenCalledWith("Ana Silva", "2000-01-02")
    expect(recarregar).toHaveBeenCalled()
    expect(await screen.findByText("Dados salvos.")).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Nome" })).not.toBeInTheDocument()
  })

  it("foto: só JPG/PNG/WebP até 8 MB (erro na hora, sem chamar o servidor); foto válida sobe e recarrega a conta", async () => {
    render(<Perfil />)
    const seletor = screen.getByLabelText("Escolher foto de perfil") as HTMLInputElement
    const enviar = (f: File) => fireEvent.change(seletor, { target: { files: [f] } })

    enviar(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }))
    expect(await screen.findByText("Use uma foto em JPG, PNG ou WebP.")).toBeInTheDocument()
    const grande = new File(["x"], "g.jpg", { type: "image/jpeg" })
    Object.defineProperty(grande, "size", { value: 9 * 1024 * 1024 })
    enviar(grande)
    expect(await screen.findByText("A foto pode ter até 8 MB.")).toBeInTheDocument()
    expect(contaService.enviarFoto).not.toHaveBeenCalled()

    const boa = new File(["jpg"], "eu.jpg", { type: "image/jpeg" })
    enviar(boa)
    await vi.waitFor(() => expect(contaService.enviarFoto).toHaveBeenCalledWith(boa))
    await vi.waitFor(() => expect(recarregar).toHaveBeenCalled())
    expect(await screen.findByRole("button", { name: "Adicionar foto" })).toBeInTheDocument()
  })

  it("cancelar fecha sem salvar; data vazia vai como nula", async () => {
    render(<Perfil />)
    await userEvent.click(screen.getByRole("button", { name: /Editar/ }))
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(screen.queryByRole("textbox", { name: "Nome" })).not.toBeInTheDocument()
    expect(contaService.atualizarPerfil).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("button", { name: /Editar/ }))
    fireEvent.change(screen.getByLabelText("Data de nascimento"), { target: { value: "" } })
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(contaService.atualizarPerfil).toHaveBeenCalledWith("Ana Teste", null)
  })
})
