/** Sessão ativa do usuário (um dispositivo/refresh token) — tela de Sessões em Configurações. */
export interface Sessao {
  id: string
  criadoEm: string
  ultimoUsoEm?: string | null
  dispositivo?: string | null
  ip?: string | null
  /** É a sessão deste dispositivo/aba (a conta ativa agora). */
  atual: boolean
}
