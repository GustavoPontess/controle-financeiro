import { describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

const entrar = vi.hoisted(() => vi.fn())
const reativar = vi.hoisted(() => vi.fn())
vi.mock("../../auth/useAuth", () => ({
  useAuth: () => ({ autenticado: false, carregando: false, entrar, verificarMfa: vi.fn(), reativar, adicionarConta: vi.fn() }),
}))
const chave = vi.hoisted(() => ({ valor: null as string | null }))
vi.mock("../../services/verificacaoService", () => ({ chaveDaVerificacao: () => Promise.resolve(chave.valor) }))
vi.mock("../../services/rosterService", () => ({ default: { listar: vi.fn().mockResolvedValue([]), remover: vi.fn() } }))
vi.mock("../../api/cliente", async (orig) => ({
  ...(await orig<typeof import("../../api/cliente")>()),
  api: { get: vi.fn().mockResolvedValue({ data: [] }), post: vi.fn() },
}))
import Entrar from "../../telas/Entrar"
import { api } from "../../api/cliente"

// Turnstile de mentira: desenha a caixinha e já entrega um token (como a Cloudflare faz quase sempre); o reset (token
// gasto) entrega o próximo um pouco depois, como a chave de produção.
const turnstileFalso = () => {
  let n = 0
  let cb: ((t: string) => void) | null = null
  window.turnstile = {
    render: (el: HTMLElement, op: Record<string, unknown>) => { n++; el.textContent = "verificado"; cb = op.callback as (t: string) => void; cb(`tk-${n}`); return `w${n}` },
    reset: vi.fn(() => { setTimeout(() => { n++; cb?.(`tk-${n}`) }, 80) }),
    remove: vi.fn(),
  }
}

describe("Entrar (beta fechado)", () => {
  it("Pedir acesso abre o cadastro do app (o admin aprova em /admin); sem cadastro livre", async () => {
    render(<MemoryRouter initialEntries={["/entrar"]}><Routes><Route path="/entrar" element={<Entrar />} /></Routes></MemoryRouter>)
    expect(await screen.findByRole("link", { name: "Pedir acesso" })).toHaveAttribute("href", "/cadastro")
    expect(screen.queryByRole("link", { name: /Criar conta/ })).not.toBeInTheDocument()
    expect(screen.getByText("Pontes · o dinheiro da casa")).toBeInTheDocument()
  })

  it("submit vazio bloqueia e mostra o erro embaixo de cada campo (visual do rascunho: .com-erro + .erro)", async () => {
    render(<MemoryRouter initialEntries={["/entrar"]}><Routes><Route path="/entrar" element={<Entrar />} /></Routes></MemoryRouter>)
    await userEvent.click(await screen.findByRole("button", { name: /Entrar/ }))
    expect(screen.getByText("Informe o e-mail")).toHaveClass("erro")
    expect(screen.getByText("Informe a senha")).toHaveClass("erro")
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByLabelText("E-mail").closest("label")).toHaveClass("campo", "com-erro")
  })

  it("Esqueci a senha abre o pedido do link e volta ao login", async () => {
    render(<MemoryRouter initialEntries={["/entrar"]}><Routes><Route path="/entrar" element={<Entrar />} /></Routes></MemoryRouter>)
    await userEvent.click(await screen.findByRole("button", { name: "Esqueci a senha" }))
    expect(screen.getByRole("heading", { name: "Recuperar senha" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Voltar ao login/ }))
    expect(screen.getByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument()
  })

  it("DEV: a barra de estados abre cada passo direto pelo endereço, sem login nem API", async () => {
    render(<MemoryRouter initialEntries={["/entrar#duas-etapas"]}><Routes><Route path="/entrar" element={<Entrar />} /></Routes></MemoryRouter>)
    expect(await screen.findByRole("heading", { name: "Verificação em duas etapas" })).toBeInTheDocument()
    const painel = await screen.findByRole("region", { name: /Painel de dev/ })
    const seletor = screen.getByRole("combobox", { name: "Estado da tela" })
    expect(seletor).toHaveValue("/entrar#duas-etapas")
    await userEvent.selectOptions(seletor, "/entrar#reativar")
    expect(await screen.findByRole("heading", { name: "Reativar conta" })).toBeInTheDocument()
    expect(screen.getByText(/Faltam 23 dias/)).toBeInTheDocument()
    expect(painel).toBeInTheDocument()
  })

  it("muitas tentativas (429): trava o Entrar com o contador e libera quando acaba", async () => {
    entrar.mockRejectedValueOnce(Object.assign(new Error("Muitas tentativas."), { esperarSegundos: 3 }))
    render(<MemoryRouter initialEntries={["/entrar"]}><Routes><Route path="/entrar" element={<Entrar />} /></Routes></MemoryRouter>)
    await userEvent.type(await screen.findByLabelText("E-mail"), "ana@teste.com")
    await userEvent.type(screen.getByLabelText("Senha"), "uma senha qualquer")
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      await userEvent.click(screen.getByRole("button", { name: /Entrar/ }))
      expect(await screen.findByRole("alert")).toHaveTextContent("Muitas tentativas")
      expect(screen.getByRole("button", { name: "Tente de novo em 0:03" })).toBeDisabled()
      for (let i = 0; i < 3; i++) await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      expect(screen.getByRole("button", { name: /Entrar/ })).toBeEnabled()
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    } finally { vi.useRealTimers() }
  })

  it("1ª tentativa sem verificação; depois de errar, aparece o 'não sou robô' e o token vai junto", async () => {
    chave.valor = "chave-do-site"
    turnstileFalso()
    try {
      entrar.mockReset()
      entrar.mockRejectedValueOnce(new Error("E-mail ou senha incorretos.")).mockResolvedValueOnce({ tipo: "mfa", challengeToken: "c" })
      render(<MemoryRouter initialEntries={["/entrar"]}><Routes><Route path="/entrar" element={<Entrar />} /></Routes></MemoryRouter>)
      await userEvent.type(await screen.findByLabelText("E-mail"), "ana@teste.com")
      await userEvent.type(screen.getByLabelText("Senha"), "uma senha errada")
      expect(screen.queryByTestId("verificacao-humana")).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole("button", { name: /Entrar/ }))
      expect(entrar).toHaveBeenLastCalledWith("ana@teste.com", "uma senha errada", false, null)
      expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha incorretos.")
      expect(await screen.findByTestId("verificacao-humana")).toHaveTextContent("verificado")

      await userEvent.click(screen.getByRole("button", { name: /Entrar/ }))
      expect(entrar).toHaveBeenLastCalledWith("ana@teste.com", "uma senha errada", false, "tk-1")
    } finally { chave.valor = null; delete window.turnstile }
  })

  it("errou de novo: a caixinha renova e o envio espera o token novo (não trava em 'Confirme que você não é um robô')", async () => {
    chave.valor = "chave-do-site"
    turnstileFalso()
    try {
      entrar.mockReset()
      entrar.mockRejectedValueOnce(new Error("E-mail ou senha incorretos."))
        .mockRejectedValueOnce(new Error("E-mail ou senha incorretos."))
        .mockResolvedValueOnce({ tipo: "mfa", challengeToken: "c" })
      render(<MemoryRouter initialEntries={["/entrar"]}><Routes><Route path="/entrar" element={<Entrar />} /></Routes></MemoryRouter>)
      await userEvent.type(await screen.findByLabelText("E-mail"), "ana@teste.com")
      await userEvent.type(screen.getByLabelText("Senha"), "uma senha errada")
      await userEvent.click(screen.getByRole("button", { name: /Entrar/ }))
      await screen.findByTestId("verificacao-humana")
      await userEvent.click(screen.getByRole("button", { name: /Entrar/ }))
      await waitFor(() => expect(entrar).toHaveBeenCalledTimes(2))
      expect(entrar).toHaveBeenLastCalledWith("ana@teste.com", "uma senha errada", false, "tk-1")
      expect(window.turnstile!.reset).toHaveBeenCalledWith("w1") // renova a mesma caixinha, não desenha outra

      // Tenta logo de novo, antes do token novo chegar: espera ele e manda (nada de "Confirme que você não é um robô").
      await userEvent.click(screen.getByRole("button", { name: /Entrar/ }))
      await waitFor(() => expect(entrar).toHaveBeenCalledTimes(3))
      expect(entrar).toHaveBeenLastCalledWith("ana@teste.com", "uma senha errada", false, "tk-2")
      expect(screen.queryByText("Confirme que você não é um robô.")).not.toBeInTheDocument()
    } finally { chave.valor = null; delete window.turnstile }
  })

  it("Esqueci a senha: com a verificação ligada, manda o token junto", async () => {
    chave.valor = "chave-do-site"
    turnstileFalso()
    try {
      vi.mocked(api.post).mockResolvedValueOnce({ data: {} })
      render(<MemoryRouter initialEntries={["/entrar"]}><Routes><Route path="/entrar" element={<Entrar />} /></Routes></MemoryRouter>)
      await userEvent.click(await screen.findByRole("button", { name: "Esqueci a senha" }))
      await userEvent.type(screen.getByLabelText("E-mail"), "ana@teste.com")
      expect(await screen.findByTestId("verificacao-humana")).toBeInTheDocument()
      await userEvent.click(screen.getByRole("button", { name: "Enviar link" }))
      expect(api.post).toHaveBeenCalledWith("/auth/forgot-password", { email: "ana@teste.com", turnstileToken: "tk-1" }, { skipErrorToast: true })
      expect(await screen.findByRole("heading", { name: "Confira o seu e-mail" })).toBeInTheDocument()
    } finally { chave.valor = null; delete window.turnstile }
  })

  it("conta em exclusão: o Reativar manda só o passe que o login devolveu (nunca e-mail e senha)", async () => {
    entrar.mockReset()
    entrar.mockResolvedValueOnce({ tipo: "exclusao", diasRestantes: 20, reativacaoToken: "passe-curto" })
      .mockResolvedValueOnce({ tipo: "mfa", challengeToken: "c" })
    reativar.mockReset().mockResolvedValue(undefined)
    render(<MemoryRouter initialEntries={["/entrar"]}><Routes><Route path="/entrar" element={<Entrar />} /></Routes></MemoryRouter>)
    await userEvent.type(await screen.findByLabelText("E-mail"), "ana@teste.com")
    await userEvent.type(screen.getByLabelText("Senha"), "a senha certa dela")
    await userEvent.click(screen.getByRole("button", { name: /Entrar/ }))
    await userEvent.click(await screen.findByRole("button", { name: "Reativar conta" }))
    expect(reativar).toHaveBeenCalledWith("passe-curto")
  })
})
