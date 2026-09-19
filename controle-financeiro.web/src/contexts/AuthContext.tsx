/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, setActiveAccountId } from '@/api/axiosConfig'

export interface Usuario {
  id: string
  email: string
  nome: string
  dataNascimento?: string
  criadoEm: string
  /** Admin global (vem do /auth/me). Comum recebe false. Só decide UI/rota no front —
   *  a fronteira real é a policy IsAdmin no backend. */
  isAdmin?: boolean
}

export interface StoredAccount {
  id: string
  email: string
  nome: string
}

/** Resultado do passo 1 do login: terminou, pede o 2º fator (MFA), ou a conta está na carência de
 *  exclusão (senha certa, sem sessão — o front oferece reativar). */
export type LoginResult =
  | { mfaRequerido: false; contaMarcadaExclusao: false }
  | { mfaRequerido: true; challengeToken: string }
  | { mfaRequerido: false; contaMarcadaExclusao: true; diasRestantes: number | null }

export interface AuthContextType {
  currentUser: Usuario | null
  isAuthenticated: boolean
  isLoading: boolean
  accountKey: number
  savedAccounts: StoredAccount[]
  login: (email: string, password: string) => Promise<LoginResult>
  verificarMfaLogin: (challengeToken: string, codigo: string) => Promise<void>
  register: (email: string, nome: string, dataNascimento: string | null, password: string) => Promise<string>
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
  refreshUser: () => Promise<void>
  addAccount: (email: string, password: string) => Promise<void>
  switchAccount: (accountId: string) => Promise<void>
  removeAccount: (accountId: string) => void
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

const SAVED_ACCOUNTS_KEY = 'savedAccounts'

const normEmail = (e: string) => e.trim().toLowerCase()

/** Remove contas duplicadas pelo mesmo e-mail, mantendo a última (id mais recente). */
function dedupeByEmail(accounts: StoredAccount[]): StoredAccount[] {
  const byEmail = new Map<string, StoredAccount>()
  for (const a of accounts) byEmail.set(normEmail(a.email), a)
  return [...byEmail.values()]
}

function loadSavedAccounts(): StoredAccount[] {
  try {
    const data = localStorage.getItem(SAVED_ACCOUNTS_KEY)
    return data ? dedupeByEmail(JSON.parse(data)) : []
  } catch {
    return []
  }
}

function persistSavedAccounts(accounts: StoredAccount[]) {
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts))
}

async function fetchCurrentUser(): Promise<Usuario | null> {
  try {
    const res = await api.get('/auth/me')
    return res.data
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Usuario | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [savedAccounts, setSavedAccounts] = useState<StoredAccount[]>(loadSavedAccounts)
  const [accountKey, setAccountKey] = useState(0)

  const upsertSavedAccount = (account: StoredAccount) => {
    setSavedAccounts(prev => {
      // Dedupe por e-mail (identidade real) E por id — relogin do mesmo e-mail
      // (ex.: id mudou) substitui a entrada antiga em vez de duplicar.
      const updated = [...prev.filter(a => a.id !== account.id && normEmail(a.email) !== normEmail(account.email)), account]
      persistSavedAccounts(updated)
      return updated
    })
  }

  useEffect(() => {
    fetchCurrentUser().then(usuario => {
      if (usuario) {
        setCurrentUser(usuario)
        setActiveAccountId(usuario.id) // guarda multi-aba: esta aba está nesta conta
        upsertSavedAccount({ id: usuario.id, email: usuario.email, nome: usuario.nome })
      }
      setIsLoading(false)
    })
  }, [])

  const carregarSessao = async (resetLista = false) => {
    const usuario = await fetchCurrentUser()
    if (usuario) {
      setCurrentUser(usuario)
      setActiveAccountId(usuario.id)
      if (resetLista) {
        // Login FRIO (tela de login): a lista começa só com esta conta. Não herda as contas de
        // quem usou o navegador antes — o backend já revogou os cookies rt_ delas. Fecha o
        // vazamento de conta em dispositivo compartilhado.
        const only = [{ id: usuario.id, email: usuario.email, nome: usuario.nome }]
        setSavedAccounts(only)
        persistSavedAccounts(only)
      } else {
        upsertSavedAccount({ id: usuario.id, email: usuario.email, nome: usuario.nome })
      }
    } else {
      throw new Error('Falha ao carregar dados do usuário')
    }
  }

  const login = async (email: string, password: string): Promise<LoginResult> => {
    try {
      const res = await api.post('/auth/login', { email, password })
      // MFA ativo — backend não emitiu sessão, pede o 2º fator.
      if (res.data?.mfaRequerido) {
        return { mfaRequerido: true, challengeToken: res.data.mfaChallengeToken }
      }
      // Conta na carência de exclusão — senha certa, sem sessão; o front oferece reativar.
      if (res.data?.contaMarcadaExclusao) {
        return { mfaRequerido: false, contaMarcadaExclusao: true, diasRestantes: res.data.diasRestantes ?? null }
      }
      await carregarSessao(true) // login frio → reseta a lista de contas
      return { mfaRequerido: false, contaMarcadaExclusao: false }
    } catch (error) {
      throw new Error((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Erro ao fazer login')
    }
  }

  const verificarMfaLogin = async (challengeToken: string, codigo: string) => {
    try {
      await api.post('/auth/mfa/verificar-login', { challengeToken, codigo })
      await carregarSessao(true) // login frio com MFA → reseta a lista de contas
    } catch (error) {
      throw new Error((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Código inválido')
    }
  }

  // GATE DO BETA: o cadastro NÃO cria sessão — a conta nasce "aguardando aprovação" e só loga
  // depois que o admin aprova. Por isso aqui não buscamos /auth/me nem setamos currentUser; só
  // devolvemos a mensagem de confirmação pra tela mostrar "cadastro enviado, aguarde aprovação".
  const register = async (email: string, nome: string, dataNascimento: string | null, password: string): Promise<string> => {
    try {
      const res = await api.post('/auth/register', { email, nome, dataNascimento, password, confirmPassword: password })
      return res.data?.mensagem
        ?? 'Cadastro enviado! Sua conta está aguardando aprovação.'
    } catch (error) {
      throw new Error((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Erro ao registrar')
    }
  }

  // "Sair" encerra TODAS as contas parqueadas no navegador — revoga todos os refresh no servidor
  // e limpa a lista local. Em dispositivo compartilhado, sair não pode deixar conta acessível pro
  // próximo. (Trocar entre contas continua livre enquanto logado; só o "Sair" é que zera tudo.)
  const logout = async () => {
    // Revoga no SERVIDOR primeiro (await) — logout tem que invalidar a sessão no servidor, não só
    // apagar cookie local (OWASP). Só limpamos o estado local DEPOIS da confirmação; se a request
    // falha, propaga o erro pro caller avisar (não afirmar "saiu" com a sessão ainda viva).
    await api.post('/auth/logout-all')
    setSavedAccounts([])
    persistSavedAccounts([])
    setCurrentUser(null)
    setActiveAccountId(null)
  }

  // Alias explícito de "sair de todas" (usado por telas que oferecem a ação nominalmente).
  const logoutAll = logout

  const refreshUser = async () => {
    const usuario = await fetchCurrentUser()
    if (usuario) {
      setCurrentUser(usuario)
      setActiveAccountId(usuario.id)
    }
  }

  const addAccount = async (email: string, password: string) => {
    try {
      // Endpoint DEDICADO de adicionar conta ([Authorize]): parqueia a nova sem matar as outras e a
      // torna ATIVA. NÃO é o /auth/login (esse sempre começa limpo — senão adicionar mataria as
      // demais). Após adicionar, esta aba passa a operar na conta nova — sincronizamos
      // currentUser/activeAccountId (guarda multi-aba).
      await api.post('/auth/add-account', { email, password })
      const usuario = await fetchCurrentUser()
      if (!usuario) throw new Error('Erro ao buscar dados da conta')

      upsertSavedAccount({ id: usuario.id, email: usuario.email, nome: usuario.nome })
      setCurrentUser(usuario)
      setActiveAccountId(usuario.id)
      setAccountKey(k => k + 1)
    } catch (error) {
      throw new Error((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Credenciais inválidas')
    }
  }

  const switchAccount = async (accountId: string) => {
    const account = savedAccounts.find(a => a.id === accountId)
    if (!account || account.id === currentUser?.id) return

    // Troca REAL no servidor: /auth/switch reaponta o cookie jwt pra conta destino (autoridade = o
    // refresh httpOnly dela, validado no backend). Só DEPOIS recarregamos o usuário — nada de UI
    // otimista mentindo enquanto as requests ainda saem pela conta antiga.
    try {
      await api.post('/auth/switch', { accountId })
    } catch {
      // Sessão daquela conta expirou/foi revogada → tira da lista e pede relogar.
      setSavedAccounts(prev => {
        const updated = prev.filter(a => a.id !== accountId)
        persistSavedAccounts(updated)
        return updated
      })
      throw new Error('Sua sessão nessa conta expirou. Entre nela de novo.')
    }

    const usuario = await fetchCurrentUser()
    if (usuario) {
      setCurrentUser(usuario)
      setActiveAccountId(usuario.id)
      upsertSavedAccount({ id: usuario.id, email: usuario.email, nome: usuario.nome })
      setAccountKey(k => k + 1) // remonta a subtree e dropa o cache/estado da conta anterior
    } else {
      throw new Error('Não foi possível carregar a conta após a troca.')
    }
  }

  const removeAccount = (accountId: string) => {
    setSavedAccounts(prev => {
      const updated = prev.filter(a => a.id !== accountId)
      persistSavedAccounts(updated)
      return updated
    })
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        accountKey,
        savedAccounts,
        login,
        verificarMfaLogin,
        register,
        logout,
        logoutAll,
        refreshUser,
        addAccount,
        switchAccount,
        removeAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
