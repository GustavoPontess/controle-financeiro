import { createContext } from "react"

export interface Usuario {
  id: string
  email: string
  nome: string
  isAdmin?: boolean
}

/** Resultado do 1º passo do login: entrou; pede o 2º fator; ou a conta está na carência de exclusão. */
export type ResultadoEntrar =
  | { tipo: "ok" }
  | { tipo: "mfa"; challengeToken: string }
  | { tipo: "exclusao"; diasRestantes: number | null }

/** Conta conectada neste navegador (multi-conta): a lista mora no navegador; a autoridade é o cookie `rt_` dela. */
export interface ContaConectada {
  id: string
  nome: string
  email: string
}

export interface AuthContexto {
  usuario: Usuario | null
  carregando: boolean
  autenticado: boolean
  /** As contas conectadas neste navegador (a ativa inclusa). */
  contas: ContaConectada[]
  /** Conecta OUTRA conta sem sair desta (POST /auth/add-account) e a torna ativa. Lança Error com a mensagem. */
  adicionarConta: (email: string, senha: string) => Promise<void>
  /** Torna ativa uma conta já conectada (POST /auth/switch). Se a sessão dela caiu, tira da lista e lança Error. */
  trocarConta: (id: string) => Promise<void>
  /** Lança Error com a mensagem do servidor (senha errada, bloqueio…). */
  entrar: (email: string, senha: string, manterConectado: boolean) => Promise<ResultadoEntrar>
  /** 2º passo do login (código do autenticador ou de recuperação). */
  verificarMfa: (challengeToken: string, codigo: string, confiarDispositivo: boolean, manterConectado: boolean) => Promise<void>
  /** Conta na carência de exclusão: reativa (senha certa) — depois é só entrar de novo. */
  reativar: (email: string, senha: string) => Promise<void>
  sair: () => Promise<void>
  recarregar: () => Promise<void>
}

export const AuthContext = createContext<AuthContexto | undefined>(undefined)
