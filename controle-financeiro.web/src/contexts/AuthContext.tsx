/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '@/api/axiosConfig'

export interface Usuario {
  id: string
  email: string
  nome: string
  dataNascimento?: string
  ativo: boolean
  criadoEm: string
}

export interface StoredAccount {
  id: string
  email: string
  nome: string
}

export interface AuthContextType {
  currentUser: Usuario | null
  isAuthenticated: boolean
  isLoading: boolean
  accountKey: number
  savedAccounts: StoredAccount[]
  login: (email: string, password: string) => Promise<void>
  register: (email: string, nome: string, dataNascimento: string | null, password: string) => Promise<void>
  logout: () => void
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
        upsertSavedAccount({ id: usuario.id, email: usuario.email, nome: usuario.nome })
      }
      setIsLoading(false)
    })
  }, [])

  const login = async (email: string, password: string) => {
    try {
      await api.post('/auth/login', { email, password })
      const usuario = await fetchCurrentUser()
      if (usuario) {
        setCurrentUser(usuario)
        upsertSavedAccount({ id: usuario.id, email: usuario.email, nome: usuario.nome })
      } else {
        throw new Error('Falha ao carregar dados do usuário')
      }
    } catch (error) {
      throw new Error((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Erro ao fazer login')
    }
  }

  const register = async (email: string, nome: string, dataNascimento: string | null, password: string) => {
    try {
      await api.post('/auth/register', { email, nome, dataNascimento, password, confirmPassword: password })
      const usuario = await fetchCurrentUser()
      if (usuario) {
        setCurrentUser(usuario)
        upsertSavedAccount({ id: usuario.id, email: usuario.email, nome: usuario.nome })
      } else {
        throw new Error('Falha ao carregar dados do usuário')
      }
    } catch (error) {
      throw new Error((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Erro ao registrar')
    }
  }

  const logout = () => {
    if (currentUser) {
      setSavedAccounts(prev => {
        const updated = prev.filter(a => a.id !== currentUser.id)
        persistSavedAccounts(updated)
        return updated
      })
    }
    setCurrentUser(null)
    api.post('/auth/logout').catch(() => {})
  }

  const refreshUser = async () => {
    const usuario = await fetchCurrentUser()
    if (usuario) setCurrentUser(usuario)
  }

  const addAccount = async (email: string, password: string) => {
    try {
      await api.post('/auth/login', { email, password })
      const usuario = await fetchCurrentUser()
      if (!usuario) throw new Error('Erro ao buscar dados da conta')

      if (savedAccounts.some(a => a.id === usuario.id || normEmail(a.email) === normEmail(usuario.email))) {
        throw new Error('Esta conta já está conectada')
      }

      upsertSavedAccount({ id: usuario.id, email: usuario.email, nome: usuario.nome })
    } catch (error) {
      throw new Error((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Credenciais inválidas')
    }
  }

  const switchAccount = async (accountId: string) => {
    const account = savedAccounts.find(a => a.id === accountId)
    if (!account || account.id === currentUser?.id) return

    setCurrentUser({ id: account.id, email: account.email, nome: account.nome, ativo: true, criadoEm: '' })
    setAccountKey(k => k + 1)

    const usuario = await fetchCurrentUser()
    if (usuario) {
      setCurrentUser(usuario)
      upsertSavedAccount(account)
    } else {
      setSavedAccounts(prev => {
        const updated = prev.filter(a => a.id !== accountId)
        persistSavedAccounts(updated)
        return updated
      })
      setCurrentUser(null)
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
        register,
        logout,
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
