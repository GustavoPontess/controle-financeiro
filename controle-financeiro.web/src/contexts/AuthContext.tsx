import { createContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

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
  token: string
}

export interface AuthContextType {
  currentUser: Usuario | null
  token: string | null
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

const ACTIVE_TOKEN_KEY = 'authToken'
const SAVED_ACCOUNTS_KEY = 'savedAccounts'
const API_BASE = 'http://localhost:5296/api'

function loadSavedAccounts(): StoredAccount[] {
  try {
    const data = localStorage.getItem(SAVED_ACCOUNTS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function persistSavedAccounts(accounts: StoredAccount[]) {
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts))
}

async function fetchUserByToken(authToken: string): Promise<Usuario | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Usuario | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [savedAccounts, setSavedAccounts] = useState<StoredAccount[]>(loadSavedAccounts)
  const [accountKey, setAccountKey] = useState(0)

  const upsertSavedAccount = (account: StoredAccount) => {
    setSavedAccounts(prev => {
      const updated = [...prev.filter(a => a.id !== account.id), account]
      persistSavedAccounts(updated)
      return updated
    })
  }

  useEffect(() => {
    const savedToken = localStorage.getItem(ACTIVE_TOKEN_KEY)
    if (!savedToken) {
      setIsLoading(false)
      return
    }
    setToken(savedToken)
    fetchUserByToken(savedToken).then(usuario => {
      if (usuario) {
        setCurrentUser(usuario)
        upsertSavedAccount({ id: usuario.id, email: usuario.email, nome: usuario.nome, token: savedToken })
      } else {
        localStorage.removeItem(ACTIVE_TOKEN_KEY)
        setToken(null)
      }
      setIsLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message || 'Erro ao fazer login')
    }
    const data = await res.json()
    localStorage.setItem(ACTIVE_TOKEN_KEY, data.token)
    setToken(data.token)

    const usuario = await fetchUserByToken(data.token)
    if (usuario) {
      setCurrentUser(usuario)
      upsertSavedAccount({ id: usuario.id, email: usuario.email, nome: usuario.nome, token: data.token })
    }
  }

  const register = async (email: string, nome: string, dataNascimento: string | null, password: string) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, nome, dataNascimento, password, confirmPassword: password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message || 'Erro ao registrar')
    }
    const data = await res.json()
    localStorage.setItem(ACTIVE_TOKEN_KEY, data.token)
    setToken(data.token)

    const usuario: Usuario = {
      id: data.usuarioId,
      email: data.email,
      nome: data.nome,
      ativo: true,
      criadoEm: new Date().toISOString(),
    }
    setCurrentUser(usuario)
    upsertSavedAccount({ id: usuario.id, email: usuario.email, nome: usuario.nome, token: data.token })
  }

  const logout = () => {
    if (currentUser) {
      setSavedAccounts(prev => {
        const updated = prev.filter(a => a.id !== currentUser.id)
        persistSavedAccounts(updated)
        return updated
      })
    }
    localStorage.removeItem(ACTIVE_TOKEN_KEY)
    setToken(null)
    setCurrentUser(null)
  }

  const refreshUser = async () => {
    if (!token) return
    const usuario = await fetchUserByToken(token)
    if (usuario) setCurrentUser(usuario)
  }

  const addAccount = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message || 'Credenciais inválidas')
    }
    const data = await res.json()

    const usuario = await fetchUserByToken(data.token)
    if (!usuario) throw new Error('Erro ao buscar dados da conta')

    if (savedAccounts.some(a => a.id === usuario.id)) {
      throw new Error('Esta conta já está conectada')
    }

    upsertSavedAccount({ id: usuario.id, email: usuario.email, nome: usuario.nome, token: data.token })
  }

  const switchAccount = async (accountId: string) => {
    const account = savedAccounts.find(a => a.id === accountId)
    if (!account || account.id === currentUser?.id) return

    localStorage.setItem(ACTIVE_TOKEN_KEY, account.token)
    setToken(account.token)
    setCurrentUser({ id: account.id, email: account.email, nome: account.nome, ativo: true, criadoEm: '' })
    setAccountKey(k => k + 1)

    // Validate in background and update with full data
    fetchUserByToken(account.token).then(usuario => {
      if (usuario) {
        setCurrentUser(usuario)
        upsertSavedAccount({ ...account, token: account.token })
      } else {
        // Token expired — remove from saved
        setSavedAccounts(prev => {
          const updated = prev.filter(a => a.id !== accountId)
          persistSavedAccounts(updated)
          return updated
        })
        localStorage.removeItem(ACTIVE_TOKEN_KEY)
        setToken(null)
        setCurrentUser(null)
      }
    })
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
        token,
        isAuthenticated: !!token && !!currentUser,
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
