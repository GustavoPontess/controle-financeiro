import axios from "axios"

// Permite um request optar por NÃO disparar o toast global de erro (quando a própria tela já
// mostra o erro mapeado no campo). Default: toast global ligado (rede de segurança).
declare module "axios" {
  export interface AxiosRequestConfig {
    skipErrorToast?: boolean
  }
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5293/api/v1",
  withCredentials: true, // Include cookies in requests
})

// Conta que ESTA aba considera ativa (multi-conta). Vai no header X-Active-Account pra o backend
// barrar escrita quando a aba está defasada de uma troca feita em outra aba (guarda multi-aba).
// O AuthContext atualiza isso a cada login/switch/refresh/logout.
let activeAccountId: string | null = null
export function setActiveAccountId(id: string | null) {
  activeAccountId = id
}

/**
 * Extrai uma mensagem amigável do erro do backend pra mostrar ao usuário.
 * - 400 com `errors` (ModelState do [ApiController]) → mensagem genérica (os detalhes técnicos
 *   em inglês não servem pro usuário; o mapeamento por campo é feito na própria tela).
 * - Corpo com `message`/`detail`/`title` (nossos erros de negócio) → mostra a mensagem real.
 */
export function mensagemDeErro(error: unknown): string {
  const resp = (error as { response?: { status?: number; data?: unknown } })?.response
  const data = resp?.data as { message?: string; detail?: string; title?: string; errors?: unknown } | undefined
  if (data?.errors && resp?.status === 400)
    return "Há campos inválidos no formulário. Verifique os destaques e tente de novo."
  if (typeof data?.message === "string" && data.message) return data.message
  if (typeof data?.detail === "string" && data.detail) return data.detail
  if (typeof data?.title === "string" && data.title) return data.title
  if (resp?.status && resp.status >= 500) return "Algo deu errado do nosso lado. Tente de novo em instantes."
  return "Não foi possível concluir a ação. Tente de novo."
}

// Request interceptor to add CSRF token
api.interceptors.request.use(
  (config) => {
    // JWT is now in httpOnly cookie, automatically sent
    // Add CSRF token from non-httpOnly cookie for mutating requests
    if (['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase() || '')) {
      const csrfToken = getCookie('X-CSRF-Token')
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken
      }
    }
    // Guarda multi-aba: informa qual conta ESTA aba acha ativa; o backend barra (409) se divergir
    // do dono do jwt (troca feita em outra aba) — evita gravar na conta errada.
    if (activeAccountId) {
      config.headers['X-Active-Account'] = activeAccountId
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

function getCookie(name: string): string | null {
  const nameEQ = name + '='
  const cookies = document.cookie.split(';')
  for (let cookie of cookies) {
    cookie = cookie.trim()
    if (cookie.indexOf(nameEQ) === 0) {
      return decodeURIComponent(cookie.substring(nameEQ.length))
    }
  }
  return null
}

// Refresh SINGLE-FLIGHT: no máximo UMA renovação em voo, compartilhada por todos os 401 que chegam
// enquanto ela não termina. Por quê: o backend rotaciona o refresh a cada uso e trata a reapresentação
// de um refresh já rotacionado como roubo (reuse-detection → derruba a sessão inteira e alerta o
// admin). Quando o jwt de 15min expira, uma tela que dispara vários GETs no mount (a de transações faz
// ~5) recebe vários 401 juntos; sem isto cada um mandava o MESMO refresh e, do 2º em diante, o backend
// via "replay" → usuário deslogado + alerta falso de roubo de sessão.
let refreshEmVoo: Promise<unknown> | null = null

function renovarSessao(): Promise<unknown> {
  if (!refreshEmVoo) {
    // Solta ao terminar (sucesso OU falha): um 401 que chegar DEPOIS é expiração nova e merece um
    // refresh novo (com o cookie já rotacionado), não o resultado velho em cache.
    refreshEmVoo = api.post("/auth/refresh").finally(() => {
      refreshEmVoo = null
    })
  }
  return refreshEmVoo
}

// Response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined
    const url = typeof original?.url === "string" ? original.url : ""
    const isAuthEndpoint = url.includes("/auth/")
    // /auth/me é o PROBE de sessão no reabrir o site: precisa poder disparar o silent refresh, senão
    // depois dos 15min do jwt o usuário cai no login mesmo com refresh de 7d vivo (o "manter conectado"
    // não funcionava no reabrir). Os demais /auth/* seguem bloqueados (recursão do /refresh, ou 401 do
    // login = senha errada, não sessão expirada).
    const podeSilentRefresh = !isAuthEndpoint || url.includes("/auth/me")

    // Silent refresh: o access token (jwt) expira em 15min, o refresh vive 7d. Num 401, renova via
    // /auth/refresh (rotaciona os cookies httpOnly — single-flight, ver renovarSessao) e refaz a
    // request original UMA vez — sem isso, o refresh de 7d era inútil e o usuário caía no login quando
    // o jwt vencia. Não tenta pra endpoints de auth (evita recursão) nem repete (_retry).
    if (status === 401 && original && !original._retry && podeSilentRefresh) {
      original._retry = true
      let renovou = false
      try {
        await renovarSessao()
        renovou = true
      } catch {
        // Refresh falhou (refresh expirado/revogado) → segue pro fluxo de redirect abaixo.
      }
      // Renovou → o que vale é o resultado da re-tentativa. Se ELA falhar, o erro já passou por este
      // interceptor na própria volta (toast, ou redirect se for 401 de novo) e só propaga — antes, um
      // 404/409/500 na re-tentativa caía no redirect abaixo e jogava o usuário no login à toa.
      if (renovou) return api(original)
    }

    if (status === 401) {
      // Token expired or invalid (cookie will be cleared by backend).
      // Não redirecionar quando já estamos em uma página de auth (/auth/login,
      // /auth/register): nessas páginas o 401 do probe de sessão é esperado e
      // redirecionar quebraria o acesso à tela de cadastro.
      // Páginas públicas (sem auth): auth, design-system, e verticais do site
      // institucional (URLs limpas, sem prefixo /site).
      const publicPaths = [
        '/auth/', '/design-system', '/convite',
        '/casais', '/contadores', '/recursos', '/sobre', '/precos',
        '/blog', '/contato', '/ajuda', '/status', '/api', '/termos', '/privacidade', '/lgpd',
      ]
      const path = window.location.pathname
      // `/` é público (RootRoute decide). Strict equal pra não bater em /dashboard etc.
      const isPublic = path === '/' || publicPaths.some((p) => path.startsWith(p))
      // NÃO redireciona quando o 401 veio de um endpoint de auth (login/switch/refresh/me): esses
      // são tratados pelo caller (a tela de login, o switchAccount) — um /auth/switch que falha não
      // pode derrubar a sessão boa da conta atual pro login.
      if (!isPublic && !isAuthEndpoint) {
        window.location.href = '/auth/login'
      }
      return Promise.reject(error)
    }

    // Rede de segurança: qualquer erro de API que não seja 401 dispara um toast global com a
    // mensagem amigável — garante que NENHUM erro passe silencioso, mesmo se a tela esquecer de
    // tratar. Inclui o 409 da guarda multi-aba ("A conta ativa mudou em outra aba..."). A tela
    // pode optar por não disparar (quando já mostra o erro no campo) via `skipErrorToast: true`.
    // O DefaultLayout escuta "apiError".
    if (!error.config?.skipErrorToast) {
      window.dispatchEvent(new CustomEvent("apiError", { detail: { message: mensagemDeErro(error) } }))
    }
    return Promise.reject(error)
  }
)