// Guarda multi-aba: cada escrita leva a conta que a aba acha ativa (X-Active-Account), e o 409
// conta_desatualizada sempre avisa, mesmo em tela que mostra o erro no campo.
import { afterEach, describe, expect, it, vi } from "vitest"
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios"
import { api, definirContaDaAba, esperaDoLimite, mensagemDeErro } from "../../api/cliente"

const original = api.defaults.adapter
let enviados: InternalAxiosRequestConfig[] = []

function responder(status = 200, data: unknown = {}) {
  const adapter: AxiosAdapter = async (config) => {
    enviados.push(config)
    const resposta = { data, status, statusText: "", headers: {}, config }
    if (status >= 400) throw Object.assign(new Error("erro"), { config, response: resposta, isAxiosError: true })
    return resposta
  }
  api.defaults.adapter = adapter
}

afterEach(() => {
  api.defaults.adapter = original
  enviados = []
  definirContaDaAba(null)
})

describe("cliente: conta da aba", () => {
  it("escrita leva X-Active-Account com a conta da aba", async () => {
    responder()
    definirContaDaAba("conta-a")
    await api.post("/transacoes", {})
    expect(enviados[0].headers["X-Active-Account"]).toBe("conta-a")
  })

  it("leitura não leva, e sem conta (deslogado) a escrita também não", async () => {
    responder()
    definirContaDaAba("conta-a")
    await api.get("/transacoes")
    definirContaDaAba(null)
    await api.post("/auth/login", {})
    expect(enviados[0].headers["X-Active-Account"]).toBeUndefined()
    expect(enviados[1].headers["X-Active-Account"]).toBeUndefined()
  })

  it("409 conta_desatualizada avisa mesmo com skipErrorToast", async () => {
    responder(409, { code: "conta_desatualizada", message: "A conta ativa mudou em outra aba. Recarregue a página para continuar." })
    definirContaDaAba("conta-a")
    const aviso = vi.fn()
    window.addEventListener("apiError", aviso)
    await expect(api.post("/transacoes", {}, { skipErrorToast: true })).rejects.toBeTruthy()
    window.removeEventListener("apiError", aviso)
    expect(aviso).toHaveBeenCalledTimes(1)
    expect((aviso.mock.calls[0][0] as CustomEvent).detail.message).toContain("outra aba")
  })
})

describe("cliente: mensagem de erro", () => {
  it("429 da Cloudflare (página HTML, sem a nossa mensagem) vira 'Muitas tentativas'", () => {
    const erro = { response: { status: 429, data: "<!DOCTYPE html><html>Rate limited</html>" } }
    expect(mensagemDeErro(erro)).toBe("Muitas tentativas. Espere um pouco e tente de novo.")
  })

  it("429 da API mantém a mensagem dela", () => {
    const erro = { response: { status: 429, data: { message: "Muitas tentativas de login. Tente em 5 minutos." } } }
    expect(mensagemDeErro(erro)).toBe("Muitas tentativas de login. Tente em 5 minutos.")
  })
})

describe("cliente: espera do limite", () => {
  it("usa o Retry-After da API; sem ele (Cloudflare), 10s; fora do 429, nada", () => {
    expect(esperaDoLimite({ response: { status: 429, headers: { "retry-after": "187" } } })).toBe(187)
    expect(esperaDoLimite({ response: { status: 429, headers: {} } })).toBe(10)
    expect(esperaDoLimite({ response: { status: 401, headers: {} } })).toBeNull()
  })
})
