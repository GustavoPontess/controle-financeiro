// Cliente HTTP do v2 — a mesma API do app atual, pelo proxy do Vite (/api → :5293). Cookies httpOnly
// (jwt + refresh), CSRF no header, refresh single-flight no 401 e redirect pro login quando a sessão
// morre. Versão enxuta do axiosConfig do app atual (sem multi-conta).
import axios from "axios"

declare module "axios" {
  export interface AxiosRequestConfig { skipErrorToast?: boolean }
}

export const api = axios.create({ baseURL: "/api/v1", withCredentials: true })

function cookie(nome: string): string | null {
  const prefixo = nome + "="
  for (const c of document.cookie.split(";")) {
    const t = c.trim()
    if (t.startsWith(prefixo)) return decodeURIComponent(t.slice(prefixo.length))
  }
  return null
}

api.interceptors.request.use((config) => {
  if (["post", "put", "delete", "patch"].includes(config.method?.toLowerCase() ?? "")) {
    const csrf = cookie("X-CSRF-Token")
    if (csrf) config.headers["X-CSRF-Token"] = csrf
  }
  return config
})

/** Mensagem amigável do erro da API. */
export function mensagemDeErro(erro: unknown): string {
  const resp = (erro as { response?: { status?: number; data?: unknown } })?.response
  const data = resp?.data as { message?: string; detail?: string; title?: string; errors?: unknown } | undefined
  if (data?.errors && resp?.status === 400) return "Há campos inválidos. Confira e tente de novo."
  if (typeof data?.message === "string" && data.message) return data.message
  if (typeof data?.detail === "string" && data.detail) return data.detail
  if (typeof data?.title === "string" && data.title) return data.title
  if (resp?.status && resp.status >= 500) return "Algo deu errado do nosso lado. Tente de novo em instantes."
  return "Não foi possível concluir a ação. Tente de novo."
}

// Refresh single-flight: o backend rotaciona o refresh a cada uso e trata reapresentação como roubo —
// N 401 juntos têm que virar UM /auth/refresh.
let refreshEmVoo: Promise<unknown> | null = null
const renovarSessao = () => (refreshEmVoo ??= api.post("/auth/refresh").finally(() => { refreshEmVoo = null }))
const REFRESH_EM_CORRIDA = "REFRESH_EM_CORRIDA"
const codigo = (e: unknown) => (e as { response?: { data?: { code?: unknown } } })?.response?.data?.code

api.interceptors.response.use(
  (r) => r,
  async (erro) => {
    const status = erro.response?.status
    const original = erro.config as (typeof erro.config & { _retry?: boolean }) | undefined
    const url = typeof original?.url === "string" ? original.url : ""
    const ehAuth = url.includes("/auth/")
    const podeRenovar = !ehAuth || url.includes("/auth/me")

    if (status === 401 && original && !original._retry && podeRenovar) {
      original._retry = true
      let renovada = false
      try { await renovarSessao(); renovada = true }
      catch (e) { renovada = codigo(e) === REFRESH_EM_CORRIDA }
      if (renovada) return api(original)
    }
    if (status === 401) {
      if (!window.location.pathname.startsWith("/entrar") && !ehAuth) window.location.href = "/entrar"
      return Promise.reject(erro)
    }
    if (!erro.config?.skipErrorToast)
      window.dispatchEvent(new CustomEvent("apiError", { detail: { message: mensagemDeErro(erro) } }))
    return Promise.reject(erro)
  },
)
