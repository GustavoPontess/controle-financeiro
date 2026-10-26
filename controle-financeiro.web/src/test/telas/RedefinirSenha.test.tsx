import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

vi.mock("../../services/senhaService", () => ({ redefinirSenha: vi.fn(async () => {}), pedirLinkDeSenha: vi.fn() }))
import { redefinirSenha } from "../../services/senhaService"
import RedefinirSenha from "../../telas/RedefinirSenha"
import { Privacidade, TermosDeUso } from "../../telas/Legal"

const renderizar = (rota: string) => render(
  <MemoryRouter initialEntries={[rota]}>
    <Routes>
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route path="/entrar" element={<p>tela de entrar</p>} />
      <Route path="/termos-de-uso" element={<TermosDeUso />} />
      <Route path="/privacidade" element={<Privacidade />} />
    </Routes>
  </MemoryRouter>,
)
const SENHA = "uma frase longa e boa"
const salvar = () => screen.getByRole("button", { name: "Salvar senha nova" })

describe("RedefinirSenha", () => {
  beforeEach(() => vi.mocked(redefinirSenha).mockReset().mockResolvedValue())

  it("sem token na URL: avisa e oferece pedir outro link", () => {
    renderizar("/redefinir-senha")
    expect(screen.getByRole("heading", { name: "Link inválido" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Pedir outro link/ })).toBeInTheDocument()
    expect(screen.queryByLabelText("Senha nova")).not.toBeInTheDocument()
  })

  it("submit vazio bloqueia; senha curta e senhas diferentes também", async () => {
    renderizar("/redefinir-senha?token=abc")
    await userEvent.click(salvar())
    expect(screen.getByText("Crie uma senha.")).toBeInTheDocument()
    expect(screen.getByText("Repita a senha.")).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("Senha nova"), "curta")
    await userEvent.type(screen.getByLabelText("Confirmar senha"), "curta")
    await userEvent.click(salvar())
    expect(screen.getByText("A senha precisa ter pelo menos 15 caracteres.")).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText("Senha nova")); await userEvent.type(screen.getByLabelText("Senha nova"), SENHA)
    await userEvent.click(salvar())
    expect(screen.getByText("As senhas não conferem.")).toBeInTheDocument()
    expect(redefinirSenha).not.toHaveBeenCalled()
  })

  it("fluxo feliz: manda token + senhas, mostra 'Senha alterada' e leva pro login", async () => {
    renderizar("/redefinir-senha?token=abc%2Bdef")
    await userEvent.type(screen.getByLabelText("Senha nova"), SENHA)
    await userEvent.type(screen.getByLabelText("Confirmar senha"), SENHA)
    await userEvent.click(salvar())
    expect(redefinirSenha).toHaveBeenCalledWith("abc+def", SENHA, SENHA)
    expect(await screen.findByRole("heading", { name: "Senha alterada" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("link", { name: "Entrar →" }))
    expect(await screen.findByText("tela de entrar")).toBeInTheDocument()
  })

  it("token vencido: erro do servidor no topo com atalho pra pedir outro", async () => {
    vi.mocked(redefinirSenha).mockRejectedValueOnce({ response: { status: 400, data: { message: "Token inválido ou expirado." } } })
    renderizar("/redefinir-senha?token=velho")
    await userEvent.type(screen.getByLabelText("Senha nova"), SENHA)
    await userEvent.type(screen.getByLabelText("Confirmar senha"), SENHA)
    await userEvent.click(salvar())
    const alerta = await screen.findByRole("alert")
    expect(alerta).toHaveTextContent(/Token inválido ou expirado/)
    expect(screen.getByRole("link", { name: "Pedir outro link" })).toBeInTheDocument()
  })
})

describe("páginas legais", () => {
  it("Termos de Uso e Política de Privacidade abrem com o conteúdo", () => {
    renderizar("/termos-de-uso")
    expect(screen.getByRole("heading", { level: 1, name: "Termos de Uso" })).toBeInTheDocument()
    expect(screen.getByText("Lei aplicável")).toBeInTheDocument()
  })
  it("Privacidade traz base legal e direitos", () => {
    renderizar("/privacidade")
    expect(screen.getByRole("heading", { level: 1, name: "Política de Privacidade" })).toBeInTheDocument()
    expect(screen.getByText("Seus direitos")).toBeInTheDocument()
  })
})
