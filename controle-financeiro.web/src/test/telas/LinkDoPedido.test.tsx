import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"

vi.mock("../../services/cadastroService", () => ({ confirmarEmailDoCadastro: vi.fn(), naoFuiEuNoCadastro: vi.fn() }))
import { confirmarEmailDoCadastro, naoFuiEuNoCadastro } from "../../services/cadastroService"
vi.mock("../../services/senhaService", () => ({ cancelarLinkDeSenha: vi.fn(async () => {}) }))
import { cancelarLinkDeSenha } from "../../services/senhaService"
import { ConfirmarEmail, NaoFuiEu, NaoPediSenha } from "../../telas/LinkDoPedido"

function Endereco() {
  const l = useLocation()
  return <output data-testid="endereco">{l.pathname + l.search + l.hash}</output>
}

const renderizar = (rota: string) => render(
  <MemoryRouter initialEntries={[rota]}>
    <Endereco />
    <Routes>
      <Route path="/confirmar-email" element={<ConfirmarEmail />} />
      <Route path="/nao-fui-eu" element={<NaoFuiEu />} />
      <Route path="/nao-pedi-senha" element={<NaoPediSenha />} />
      <Route path="/" element={<p>site</p>} />
    </Routes>
  </MemoryRouter>,
)

describe("Links do e-mail de pedido recebido", () => {
  beforeEach(() => {
    vi.mocked(confirmarEmailDoCadastro).mockReset().mockResolvedValue()
    vi.mocked(naoFuiEuNoCadastro).mockReset().mockResolvedValue()
  })

  it("sem token: avisa e não oferece botão", () => {
    renderizar("/nao-fui-eu")
    expect(screen.getByRole("heading", { name: "Link inválido" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Apagar o pedido" })).not.toBeInTheDocument()
  })

  it("abrir o link não faz nada sozinho: só o botão chama a API", () => {
    renderizar("/nao-fui-eu?token=abc")
    expect(screen.getByRole("heading", { name: "Não pediu acesso?" })).toBeInTheDocument()
    expect(naoFuiEuNoCadastro).not.toHaveBeenCalled()
    expect(confirmarEmailDoCadastro).not.toHaveBeenCalled()
  })

  it("confirmar: manda o token e mostra que seguiu pra aprovação", async () => {
    renderizar("/confirmar-email?token=ab%2Bc")
    await userEvent.click(screen.getByRole("button", { name: "Confirmar meu e-mail" }))
    expect(confirmarEmailDoCadastro).toHaveBeenCalledWith("ab+c")
    expect(await screen.findByRole("heading", { name: "E-mail confirmado" })).toBeInTheDocument()
  })

  it("não fui eu: apaga e confirma que foi apagado", async () => {
    renderizar("/nao-fui-eu?token=abc")
    await userEvent.click(screen.getByRole("button", { name: "Apagar o pedido" }))
    expect(naoFuiEuNoCadastro).toHaveBeenCalledWith("abc")
    expect(await screen.findByRole("heading", { name: "Pedido apagado" })).toBeInTheDocument()
  })

  it("link vencido: mostra o erro do servidor e continua na tela", async () => {
    vi.mocked(naoFuiEuNoCadastro).mockRejectedValue({ response: { status: 400, data: { message: "Este link venceu ou já foi usado." } } })
    renderizar("/nao-fui-eu?token=abc")
    await userEvent.click(screen.getByRole("button", { name: "Apagar o pedido" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Este link venceu ou já foi usado.")
    expect(screen.queryByRole("heading", { name: "Pedido apagado" })).not.toBeInTheDocument()
  })

  it("não pedi senha nova: cancela o link do e-mail", async () => {
    renderizar("/nao-pedi-senha?token=abc")
    expect(cancelarLinkDeSenha).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Cancelar o link" }))
    expect(cancelarLinkDeSenha).toHaveBeenCalledWith("abc")
    expect(await screen.findByRole("heading", { name: "Link cancelado" })).toBeInTheDocument()
  })

  it("código depois do #: funciona e sai da barra de endereço", async () => {
    renderizar("/confirmar-email#token=segredo123")
    expect(screen.getByTestId("endereco")).toHaveTextContent(/^\/confirmar-email$/)
    await userEvent.click(screen.getByRole("button", { name: "Confirmar meu e-mail" }))
    expect(confirmarEmailDoCadastro).toHaveBeenCalledWith("segredo123")
  })

  it("link antigo com ?token= também funciona e também sai do endereço", async () => {
    renderizar("/nao-fui-eu?token=antigo")
    expect(screen.getByTestId("endereco")).toHaveTextContent(/^\/nao-fui-eu$/)
    await userEvent.click(screen.getByRole("button", { name: "Apagar o pedido" }))
    expect(naoFuiEuNoCadastro).toHaveBeenCalledWith("antigo")
  })
})
