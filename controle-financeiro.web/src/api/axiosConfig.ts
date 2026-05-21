import axios from "axios"

export const api = axios.create({
  baseURL: "http://localhost:5293/api/v1",
  withCredentials: true, // Include cookies in requests
})

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
        '/auth/', '/logo-concepts', '/design-system',
        '/casais', '/contadores', '/recursos', '/sobre', '/precos',
        '/blog', '/contato', '/ajuda', '/status', '/api', '/termos', '/privacidade', '/lgpd',
      ]
      const path = window.location.pathname
      // `/` é público (RootRoute decide). Strict equal pra não bater em /dashboard etc.
      const isPublic = path === '/' || publicPaths.some((p) => path.startsWith(p))
      if (!isPublic) {
        window.location.href = '/auth/login'
      }
    }
    return Promise.reject(error)
  }
)