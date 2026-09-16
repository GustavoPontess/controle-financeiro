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

function Harness() {
  const ctx = useContext(AuthContext)!
  return (
    <div>
      <span data-testid="user">{ctx.currentUser?.nome ?? "—"}</span>
      <button onClick={() => { ctx.switchAccount("b").catch(() => {}) }}>switch</button>
      <button onClick={() => ctx.logoutAll()}>logoutAll</button>
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
})
