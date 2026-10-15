// Notificações do painel admin — stream SEPARADO do financeiro (types/Notificacao.ts). Não misturar.

// Enum serializado como número no JSON (sem JsonStringEnumConverter global no backend).
export const TipoNotificacaoAdmin = {
  NovoCadastro: 0,
  ExclusaoLgpd: 1,
  Seguranca: 2,
} as const
export type TipoNotificacaoAdmin = (typeof TipoNotificacaoAdmin)[keyof typeof TipoNotificacaoAdmin]

export interface NotificacaoAdmin {
  id: string
  tipo: TipoNotificacaoAdmin
  titulo: string
  mensagem: string
  linkRelativo: string | null
  lida: boolean
  criadoEm: string
}

export interface ContagemNotificacaoAdmin {
  naoLidas: number
}
