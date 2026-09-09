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

// Response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
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
      if (!isPublic) {
        window.location.href = '/auth/login'
      }
      return Promise.reject(error)
    }

    // Rede de segurança: qualquer erro de API que não seja 401 dispara um toast global com a
    // mensagem amigável — garante que NENHUM erro passe silencioso, mesmo se a tela esquecer de
    // tratar. A tela pode optar por não disparar (quando já mostra o erro no campo) via
    // `skipErrorToast: true` no config do request. O DefaultLayout escuta "apiError".
    if (!error.config?.skipErrorToast) {
      window.dispatchEvent(new CustomEvent("apiError", { detail: { message: mensagemDeErro(error) } }))
    }
    return Promise.reject(error)
  }
)