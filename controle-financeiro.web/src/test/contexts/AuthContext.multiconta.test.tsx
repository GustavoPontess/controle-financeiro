import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, act } from "@testing-library/react"
import { useContext } from "react"
import { AuthContext, AuthProvider } from "../../contexts/AuthContext"

// Mocka a camada axios: switchAccount/logoutAll batem em /auth/switch e /auth/logout-all.
const { apiMock, setActiveAccountIdMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn() },
  setActiveAccountIdMock: vi.fn(),
}))
vi.mock("@/api/axiosConfig", () => ({ api: apiMock, setActiveAccountId: setActiveAccountIdMock }))

const A = { id: "a", email: "a@t.com", nome: "Ana", criadoEm: "" }
const B = { id: "b", email: "b@t.com", nome: "Bia", criadoEm: "" }
const C = { id: "c", email: "c@t.com", nome: "Caio", criadoEm: "" }

function Harness() {
  const ctx = useContext(AuthContext)!
  return (
    <div>
      <span data-testid="user">{ctx.currentUser?.nome ?? "—"}</span>
      <span data-testid="saved">{ctx.savedAccounts.map(a => a.id).join(",")}</span>
      <button onClick={() => { ctx.switchAccount("b").catch(() => {}) }}>switch</button>
      <button onClick={() => ctx.logout()}>logout</button>
      <button onClick={() => ctx.logoutAll()}>logoutAll</button>
      <button onClick={() => { ctx.login(C.email, "SenhaForte!2026").catch(() => {}) }}>login</button>
    </div>
  )
}

describe("AuthContext multi-conta", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it("switchAccount chama /auth/switch (server-authoritative) e recarrega o usuário real", async () => {
    localStorage.setItem("savedAccounts", JSON.stringify([
      { id: A.id, email: A.email, nome: A.nome },
      { id: B.id, email: B.email, nome: B.nome },
    ]))
    apiMock.get.mockResolvedValueOnce({ data: A })   // /auth/me inicial → Ana
    apiMock.post.mockResolvedValueOnce({ data: {} }) // /auth/switch OK
    apiMock.get.mockResolvedValueOnce({ data: B })   // /auth/me pós-switch → Bia

    render(<AuthProvider><Harness /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("Ana"))

    await act(async () => { screen.getByText("switch").click() })

    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith("/auth/switch", { accountId: "b" }))
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("Bia"))
    // marca a conta ativa desta aba (guarda multi-aba)
    expect(setActiveAccountIdMock).toHaveBeenCalledWith("b")
  })

  it("switchAccount que falha remove a conta e não troca", async () => {
    localStorage.setItem("savedAccounts", JSON.stringify([
      { id: A.id, email: A.email, nome: A.nome },
      { id: B.id, email: B.email, nome: B.nome },
    ]))
    apiMock.get.mockResolvedValueOnce({ data: A })            // /auth/me inicial
    apiMock.post.mockRejectedValueOnce(new Error("401"))      // /auth/switch falha

    render(<AuthProvider><Harness /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("Ana"))

    await act(async () => { screen.getByText("switch").click() })

    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith("/auth/switch", { accountId: "b" }))
    // continua na Ana; B removida da lista salva
    expect(screen.getByTestId("user").textContent).toBe("Ana")
    const salvas = JSON.parse(localStorage.getItem("savedAccounts") ?? "[]")
    expect(salvas.some((x: { id: string }) => x.id === "b")).toBe(false)
  })

  it("logoutAll chama /auth/logout-all e limpa as contas salvas", async () => {
    localStorage.setItem("savedAccounts", JSON.stringify([{ id: A.id, email: A.email, nome: A.nome }]))
    apiMock.get.mockResolvedValueOnce({ data: A })
    apiMock.post.mockResolvedValue({ data: {} })

    render(<AuthProvider><Harness /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("Ana"))

    await act(async () => { screen.getByText("logoutAll").click() })

    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith("/auth/logout-all"))
    expect(screen.getByTestId("user").textContent).toBe("—")
    expect(localStorage.getItem("savedAccounts")).toBe("[]")
    expect(setActiveAccountIdMock).toHaveBeenCalledWith(null)
  })

  // Fix do vazamento multi-conta (navegador compartilhado): "Sair" (logout) deixou de encerrar só a
  // conta ativa e agora é alias de "sair de todas" — senão a próxima pessoa a usar o PC herdava as
  // contas parqueadas (A, B) de quem saiu e conseguia entrar nelas pelo switcher.
  it("logout() (Sair) agora encerra TODAS as contas — chama /auth/logout-all, não /auth/logout, e zera savedAccounts", async () => {
    localStorage.setItem("savedAccounts", JSON.stringify([
      { id: A.id, email: A.email, nome: A.nome },
      { id: B.id, email: B.email, nome: B.nome },
    ]))
    apiMock.get.mockResolvedValueOnce({ data: A }) // /auth/me inicial → Ana é a conta ativa
    apiMock.post.mockResolvedValue({ data: {} })

    render(<AuthProvider><Harness /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("Ana"))
    // A e B parqueadas antes do logout (ordem não importa — upsert do /auth/me reordena)
    expect(screen.getByTestId("saved").textContent.split(",").sort()).toEqual(["a", "b"])

    await act(async () => { screen.getByText("logout").click() })

    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith("/auth/logout-all"))
    expect(apiMock.post).not.toHaveBeenCalledWith("/auth/logout") // NUNCA o endpoint de sessão única
    // comportamento antigo removia só a conta ativa (ficaria "b"); agora zera tudo.
    expect(screen.getByTestId("saved").textContent).toBe("")
    expect(screen.getByTestId("user").textContent).toBe("—")
    expect(localStorage.getItem("savedAccounts")).toBe("[]")
    expect(setActiveAccountIdMock).toHaveBeenCalledWith(null)
  })

  // Login "frio" (tela de login) fecha o mesmo vazamento pelo outro lado: quem loga num navegador
  // compartilhado não pode herdar as contas (A, B) que já estavam parqueadas ali por outra pessoa.
  it("login() (frio) reseta savedAccounts para conter só a conta que acabou de logar", async () => {
    localStorage.setItem("savedAccounts", JSON.stringify([
      { id: A.id, email: A.email, nome: A.nome },
      { id: B.id, email: B.email, nome: B.nome },
    ]))
    apiMock.get.mockResolvedValueOnce({ data: null })           // /auth/me inicial: sem sessão (navegador "frio")
    apiMock.post.mockResolvedValueOnce({ data: {} })             // /auth/login OK, sem mfa/exclusão
    apiMock.get.mockResolvedValueOnce({ data: C })               // /auth/me pós-login → Caio

    render(<AuthProvider><Harness /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("—"))
    // antes do login, a lista local ainda carrega A e B (quem usou o navegador antes)
    expect(screen.getByTestId("saved").textContent).toBe("a,b")

    await act(async () => { screen.getByText("login").click() })

    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith("/auth/login", { email: C.email, password: "SenhaForte!2026", manterConectado: false }))
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("Caio"))
    // login frio: NÃO herda A/B — a lista fica só com a conta recém-logada
    expect(screen.getByTestId("saved").textContent).toBe("c")
    const salvas = JSON.parse(localStorage.getItem("savedAccounts") ?? "[]")
    expect(salvas).toEqual([{ id: C.id, email: C.email, nome: C.nome }])
  })
})
