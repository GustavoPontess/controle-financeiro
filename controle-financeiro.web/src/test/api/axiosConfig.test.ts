import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios"
import { api } from "../../api/axiosConfig"

// Servidor falso no nível do ADAPTER do axios: os interceptors reais (request + response) rodam de
// verdade, só a rede é trocada. Modela o backend: sem sessão válida → 401; POST /auth/refresh renova
// (ou falha) e, a partir daí, as rotas respondem 200 (ou o status forçado em `statusAposRenovar`).
let chamadas: string[] = []
let sessaoValida = false
let refreshOk = true
let segurarRefresh: Promise<void> = Promise.resolve()
let statusAposRenovar: Record<string, number> = {}

function resposta(config: InternalAxiosRequestConfig, status: number, data: unknown = {}): AxiosResponse {
  return { data, status, statusText: String(status), headers: {}, config }
}

function erroHttp(config: InternalAxiosRequestConfig, status: number): AxiosError {
  return new AxiosError(`HTTP ${status}`, AxiosError.ERR_BAD_REQUEST, config, null, resposta(config, status))
}

async function adapterFalso(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const url = config.url ?? ""
  chamadas.push(`${(config.method ?? "get").toUpperCase()} ${url}`)
  if (url === "/auth/refresh") {
    await segurarRefresh
    if (!refreshOk) throw erroHttp(config, 401)
    sessaoValida = true
    return resposta(config, 200)
  }
  if (!sessaoValida) throw erroHttp(config, 401)
  const status = statusAposRenovar[url] ?? 200
  if (status >= 400) throw erroHttp(config, status)
  return resposta(config, status, { url })
}

const contar = (chave: string) => chamadas.filter((c) => c === chave).length

// Rotas que uma tela autenticada dispara juntas no mount (ex.: a de transações).
const ROTAS_DA_TELA = ["/transacoes", "/contas", "/cartoes", "/categorias", "/dashboard/resumo"]

describe("axiosConfig — silent refresh single-flight", () => {
  const adapterOriginal = api.defaults.adapter

  beforeEach(() => {
    chamadas = []
    sessaoValida = false
    refreshOk = true
    segurarRefresh = Promise.resolve()
    statusAposRenovar = {}
    api.defaults.adapter = adapterFalso
    // jsdom não navega; um location simples deixa ler o path e conferir o redirect pro login.
    vi.stubGlobal("location", { pathname: "/transacoes", href: "http://localhost/transacoes" })
  })

  afterEach(() => {
    api.defaults.adapter = adapterOriginal
    vi.unstubAllGlobals()
  })

  it("N 401 em paralelo → exatamente 1 POST /auth/refresh e todas as requests refeitas", async () => {
    // Segura o refresh até TODOS os 401 chegarem — é a corrida real (jwt vencido + GETs do mount).
    let liberar!: () => void
    segurarRefresh = new Promise<void>((r) => { liberar = r })

    const pendentes = Promise.all(ROTAS_DA_TELA.map((u) => api.get(u)))
    await vi.waitFor(() => {
      expect(chamadas.filter((c) => c.startsWith("GET ")).length).toBe(ROTAS_DA_TELA.length)
    })
    await new Promise((r) => setTimeout(r, 0)) // deixa os handlers de 401 entrarem na fila do refresh
    liberar()
    const respostas = await pendentes

    expect(contar("POST /auth/refresh")).toBe(1)
    for (const [i, url] of ROTAS_DA_TELA.entries()) {
      expect(respostas[i].status).toBe(200)
      expect(respostas[i].data).toEqual({ url })
      expect(contar(`GET ${url}`)).toBe(2) // o 401 original + UMA re-tentativa
    }
    expect(window.location.href).toBe("http://localhost/transacoes") // ninguém foi pro login
  })

  it("refresh falhou → nada é refeito, todas rejeitam com o 401 e redireciona pro login (fluxo de hoje)", async () => {
    refreshOk = false

    const resultados = await Promise.allSettled(ROTAS_DA_TELA.map((u) => api.get(u)))

    expect(contar("POST /auth/refresh")).toBe(1)
    for (const [i, url] of ROTAS_DA_TELA.entries()) {
      const r = resultados[i]
      expect(r.status).toBe("rejected")
      expect((r as PromiseRejectedResult).reason.response.status).toBe(401)
      expect(contar(`GET ${url}`)).toBe(1) // sem re-tentativa
    }
    expect(window.location.href).toBe("/auth/login")
  })

  it("refresh falhou numa página pública → rejeita sem redirecionar", async () => {
    refreshOk = false
    vi.stubGlobal("location", { pathname: "/casais", href: "http://localhost/casais" })

    await expect(api.get("/transacoes")).rejects.toMatchObject({ response: { status: 401 } })

    expect(window.location.href).toBe("http://localhost/casais")
  })

  it("401 de endpoint de auth (ex.: login com senha errada) não dispara refresh nem redireciona", async () => {
    await expect(api.post("/auth/login", {})).rejects.toMatchObject({ response: { status: 401 } })

    expect(contar("POST /auth/refresh")).toBe(0)
    expect(window.location.href).toBe("http://localhost/transacoes")
  })

  it("/auth/me (probe de sessão) pode disparar o refresh e é refeito", async () => {
    const r = await api.get("/auth/me")

    expect(r.status).toBe(200)
    expect(contar("POST /auth/refresh")).toBe(1)
    expect(contar("GET /auth/me")).toBe(2)
  })

  it("/auth/me com refresh falho rejeita sem redirecionar (a tela decide)", async () => {
    refreshOk = false

    await expect(api.get("/auth/me")).rejects.toMatchObject({ response: { status: 401 } })

    expect(window.location.href).toBe("http://localhost/transacoes")
  })

  it("depois que o refresh termina, um 401 NOVO dispara outro refresh (não reaproveita o velho)", async () => {
    await api.get("/transacoes")
    sessaoValida = false // jwt venceu de novo mais tarde

    await api.get("/contas")

    expect(contar("POST /auth/refresh")).toBe(2)
  })

  it("re-tentativa que falha com erro não-401 propaga o erro dela e NÃO manda pro login", async () => {
    statusAposRenovar = { "/transacoes": 500 }
    const toast = vi.fn()
    window.addEventListener("apiError", toast)

    await expect(api.get("/transacoes")).rejects.toMatchObject({ response: { status: 500 } })

    window.removeEventListener("apiError", toast)
    expect(contar("POST /auth/refresh")).toBe(1)
    expect(toast).toHaveBeenCalledTimes(1) // o erro da re-tentativa ainda vira toast
    expect(window.location.href).toBe("http://localhost/transacoes")
  })
})
