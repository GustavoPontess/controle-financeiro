import { createContext, ReactNode, useEffect, useState } from 'react'

export interface Usuario {
  id: string
  email: string
  nome: string
  dataNascimento?: string
  ativo: boolean
  criadoEm: string
}

export interface AuthContextType {
  currentUser: Usuario | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, nome: string, dataNascimento: string | null, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<Usuario | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken')
    if (savedToken) {
      setToken(savedToken)
      // Try to fetch current user
      validateToken(savedToken)
    } else {
      setIsLoading(false)
    }
  }, [])

  const validateToken = async (authToken: string) => {
    try {
      const response = await fetch('http://localhost:5296/api/auth/me', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })
      if (response.ok) {
        const usuario = await response.json()
        setCurrentUser(usuario)
      } else {
        // Token is invalid, clear it
        localStorage.removeItem('authToken')
        setToken(null)
      }
    } catch (error) {
      console.error('Error validating token:', error)
      localStorage.removeItem('authToken')
      setToken(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('http://localhost:5296/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erro ao fazer login')
      }

      const data = await response.json()
      localStorage.setItem('authToken', data.token)
      setToken(data.token)

      // Fetch full user data
      await validateToken(data.token)
    } catch (error) {
      throw error
    }
  }

  const register = async (email: string, nome: string, dataNascimento: string | null, password: string) => {
    try {
      const response = await fetch('http://localhost:5296/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, nome, dataNascimento, password, confirmPassword: password }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erro ao registrar')
      }

      const data = await response.json()
      localStorage.setItem('authToken', data.token)
      setToken(data.token)

      // Set user data
      setCurrentUser({
        id: data.usuarioId,
        email: data.email,
        nome: data.nome,
        ativo: true,
        criadoEm: new Date().toISOString(),
      })
    } catch (error) {
      throw error
    }
  }

  const logout = () => {
    localStorage.removeItem('authToken')
    setToken(null)
    setCurrentUser(null)
  }

  const refreshUser = async () => {
    if (token) {
      await validateToken(token)
    }
  }

  const value: AuthContextType = {
    currentUser,
    token,
    isAuthenticated: !!token && !!currentUser,
    isLoading,
    login,
    register,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
