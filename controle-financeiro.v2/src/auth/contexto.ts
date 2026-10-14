import { createContext } from "react"

export interface Usuario {
  id: string
  email: string
  nome: string
  isAdmin?: boolean
}

/** "ok" = entrou; "mfa" = a conta pede 2º fator (o v2 ainda não tem a tela); "exclusao" = conta em carência de exclusão. */
export type ResultadoEntrar = "ok" | "mfa" | "exclusao"

export interface AuthContexto {
  usuario: Usuario | null
  carregando: boolean
  autenticado: boolean
  entrar: (email: string, senha: string, manterConectado: boolean) => Promise<ResultadoEntrar>
  sair: () => Promise<void>
  recarregar: () => Promise<void>
}

export const AuthContext = createContext<AuthContexto | undefined>(undefined)
