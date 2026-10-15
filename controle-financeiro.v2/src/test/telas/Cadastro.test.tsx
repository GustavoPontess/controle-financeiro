import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

vi.mock("../../services/cadastroService", () => ({ cadastrar: vi.fn() }))
vi.mock("../../auth/useAuth", () => ({ useAuth: () => ({ autenticado: false, carregando: false }) }))
import { cadastrar } from "../../services/cadastroService"
import Cadastro from "../../telas/Cadastro"

const renderizar = () => render(
  <MemoryRouter initialEntries={["/cadastro"]}>
    <Routes>
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/entrar" element={<p>tela de entrar</p>} />
    </Routes>
  </MemoryRouter>,
)
const botao = () => screen.getByRole("button", { name: "Criar conta grátis" })
const campo = (rotulo: string | RegExp) => screen.getByLabelText(rotulo)
const SENHA = "uma frase longa e boa"

const preencher = async (senha = SENHA, confirmar = senha) => {
  await userEvent.type(campo("Nome completo"), "Ana Teste")
  await userEvent.type(campo("E-mail"), "ana@teste.com")
  await userEvent.type(campo("Data de nascimento"), "1990-05-20")
  await userEvent.type(campo("Senha"), senha)
  await userEvent.type(campo("Confirmar senha"), confirmar)
}

describe("Cadastro", () => {
  beforeEach(() => vi.mocked(cadastrar).mockReset().mockResolvedValue({ status: 0, mensagem: "Cadastro recebido. Avisamos por e-mail quando a conta for aprovada." }))

  it("submit vazio bloqueia e mostra erro em cada campo (inclusive o aceite)", async () => {
    renderizar()
    await userEvent.click(botao())
    for (const m of ["Informe seu nome.", "Informe o e-mail.", "Informe a data de nascimento.", "Crie uma senha.", "Repita a senha."]) {
      expect(screen.getByText(m)).toBeInTheDocument()
    }
    expect(screen.getByText(/aceitar a Política de Privacidade/)).toBeInTheDocument()
    expect(cadastrar).not.toHaveBeenCalled()
  })

  it("senha curta (regra NIST: 15+) e senhas diferentes não passam", async () => {
    renderizar()
    await preencher("curta12345", "curta12345")
    await userEvent.click(campo(/Li e aceito/))
    await userEvent.click(botao())
    expect(screen.getByText("A senha precisa ter pelo menos 15 caracteres.")).toBeInTheDocument()
    expect(cadastrar).not.toHaveBeenCalled()

    await userEvent.clear(campo("Senha")); await userEvent.type(campo("Senha"), SENHA)
    await userEvent.clear(campo("Confirmar senha")); await userEvent.type(campo("Confirmar senha"), SENHA + "x")
    await userEvent.click(botao())
    expect(screen.getByText("As senhas não conferem.")).toBeInTheDocument()
    expect(cadastrar).not.toHaveBeenCalled()
  })

  it("aceite da privacidade nunca vem marcado e é obrigatório", async () => {
    renderizar()
    expect(campo(/Li e aceito/)).not.toBeChecked()
    await preencher()
    await userEvent.click(botao())
    expect(screen.getByText(/aceitar a Política de Privacidade/)).toBeInTheDocument()
    expect(cadastrar).not.toHaveBeenCalled()
  })

  it("fluxo feliz: manda os dados e mostra a confirmação (sem logar)", async () => {
    renderizar()
    await preencher()
    await userEvent.click(campo(/Li e aceito/))
    await userEvent.click(botao())
    expect(cadastrar).toHaveBeenCalledWith({ nome: "Ana Teste", email: "ana@teste.com", dataNascimento: "1990-05-20", password: SENHA, confirmPassword: SENHA })
    expect(await screen.findByText("Cadastro enviado!")).toBeInTheDocument()
    expect(screen.getByText(/Cadastro recebido/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Ir para o login" }))
    expect(await screen.findByText("tela de entrar")).toBeInTheDocument()
  })

  it("erro do servidor aparece no topo e o formulário continua", async () => {
    vi.mocked(cadastrar).mockRejectedValueOnce({ response: { status: 400, data: { message: "Senha não atende aos requisitos: Senha muito comum, escolha outra" } } })
    renderizar()
    await preencher()
    await userEvent.click(campo(/Li e aceito/))
    await userEvent.click(botao())
    expect(await screen.findByRole("alert")).toHaveTextContent(/muito comum/)
    expect(botao()).toBeInTheDocument()
  })
})
