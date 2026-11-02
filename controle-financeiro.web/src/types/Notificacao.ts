export type TipoNotificacao = 1 | 2 | 3 | 4 | 5 | 14 | 15 | 99

export interface Notificacao {
  id: string
  tipo: TipoNotificacao
  titulo: string
  mensagem: string
  linkRelativo: string | null
  lida: boolean
  criadoEm: string
}

export interface ContagemNotificacao {
  naoLidas: number
}
