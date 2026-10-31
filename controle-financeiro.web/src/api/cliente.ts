// Cliente HTTP do v2 — a mesma API do app atual, pelo proxy do Vite (/api → :5293). Cookies httpOnly
// (jwt + refresh), CSRF no header, refresh single-flight no 401 e redirect pro login quando a sessão
// morre. Multi-conta: cada aba diz qual conta ela acha ativa (X-Active-Account).
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

// Em HTTPS (produção) os cookies do app têm o prefixo __Host- (o navegador só aceita vindo deste host, sem
// Domain: outro site do mesmo domínio não planta um CSRF falso). Em HTTP (dev no localhost) o nome é o puro.
// Mesma regra do servidor (CookiesDoApp).
export function nomeCookieCsrf(protocolo: string = location.protocol): string {
  return (protocolo === "https:" ? "__Host-" : "") + "X-CSRF-Token"
}

// Conta que ESTA aba acha ativa. O cookie da sessão é um só pra todas as abas: depois de trocar de conta
// numa aba, outra aba aberta antes gravaria na conta nova achando que é a antiga. Com o header, a API
// recusa a escrita (409 conta_desatualizada) quando a conta da aba não bate com a da sessão.
// O AuthProvider atualiza a cada /auth/me (login, MFA, troca de conta, abrir o app) e limpa no sair.
let contaDaAba: string | null = null
export function definirContaDaAba(id: string | null) { contaDaAba = id }

api.interceptors.request.use((config) => {
  if (["post", "put", "delete", "patch"].includes(config.method?.toLowerCase() ?? "")) {
    const csrf = cookie(nomeCookieCsrf())
    if (csrf) config.headers["X-CSRF-Token"] = csrf
    if (contaDaAba) config.headers["X-Active-Account"] = contaDaAba
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
  // 429 sem a nossa mensagem: veio da borda (Cloudflare devolve uma página HTML, não o JSON da API).
  if (resp?.status === 429) return "Muitas tentativas. Espere um pouco e tente de novo."
  if (resp?.status && resp.status >= 500) return "Algo deu errado do nosso lado. Tente de novo em instantes."
  return "Não foi possível concluir a ação. Tente de novo."
}

/** Segundos até poder tentar de novo depois de um 429 (null se não for 429). Lê o Retry-After (a API manda
 *  o tempo que falta da janela); sem ele, 10s, o bloqueio da regra da Cloudflare no login. */
export function esperaDoLimite(erro: unknown): number | null {
  const resp = (erro as { response?: { status?: number; headers?: Record<string, unknown> } })?.response
  if (resp?.status !== 429) return null
  const valor = Number(String(resp.headers?.["retry-after"] ?? ""))
  return Number.isFinite(valor) && valor > 0 ? Math.min(Math.ceil(valor), 3600) : 10
}

// Refresh single-flight: o backend rotaciona o refresh a cada uso e trata reapresentação como roubo —
// N 401 juntos têm que virar UM /auth/refresh.
let refreshEmVoo: Promise<unknown> | null = null
const renovarSessao = () => (refreshEmVoo ??= api.post("/auth/refresh").finally(() => { refreshEmVoo = null }))
const REFRESH_EM_CORRIDA = "REFRESH_EM_CORRIDA"
const CONTA_DESATUALIZADA = "conta_desatualizada"
const codigo = (e: unknown) => (e as { response?: { data?: { code?: unknown } } })?.response?.data?.code
/** Code do erro da API (ex.: "VERIFICACAO_HUMANA"), ou null. */
export const codigoDoErro = (e: unknown): string | null => { const c = codigo(e); return typeof c === "string" ? c : null }

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
    // Aba defasada (trocou de conta em outra aba): avisa sempre, mesmo em tela que mostra o erro no campo.
    if (!erro.config?.skipErrorToast || codigo(erro) === CONTA_DESATUALIZADA)
      window.dispatchEvent(new CustomEvent("apiError", { detail: { message: mensagemDeErro(erro) } }))
    return Promise.reject(erro)
  },
)
