// Solicitações do beta (espelho de DTOs/Solicitacao no back).
export type TipoSolicitacao = 1 | 2 // 1 algo errado · 2 melhoria
export type StatusSolicitacao = 0 | 1 | 2 | 3 // recebida · no backlog · feita · não vamos fazer
export type TipoAnexo = 1 | 2 // 1 print · 2 bloco apontado

export const TIPOS_SOLICITACAO: Record<TipoSolicitacao, string> = { 1: "Algo errado", 2: "Melhoria" }
export const STATUS_SOLICITACAO: Record<StatusSolicitacao, string> = { 0: "Recebida", 1: "No backlog", 2: "Feita", 3: "Não vamos fazer" }

export interface AnexoNovo {
  tipo: TipoAnexo
  tela: string
  bloco: string | null
  textoDoBloco: string | null
  mostrarValores: boolean
  imagemBase64: string
}

export interface NovaSolicitacao {
  tipo: TipoSolicitacao
  titulo: string
  descricao: string | null
  tela: string
  janela: string | null
  anexos: AnexoNovo[]
}

export interface MinhaSolicitacao {
  id: string
  tipo: TipoSolicitacao
  titulo: string
  descricao: string | null
  tela: string
  status: StatusSolicitacao
  anexos: number
  criadoEm: string
}

export interface AnexoAdmin {
  id: string
  tipo: TipoAnexo
  tela: string
  bloco: string | null
  textoDoBloco: string | null
  mostrarValores: boolean
}

export interface SolicitacaoAdmin {
  id: string
  tipo: TipoSolicitacao
  titulo: string
  descricao: string | null
  tela: string
  janela: string | null
  status: StatusSolicitacao
  prioridade: number | null
  notaAdmin: string | null
  nomeUsuario: string
  emailUsuario: string
  criadoEm: string
  atualizadoEm: string | null
  mostrarValores: boolean
  anexos: AnexoAdmin[]
}
