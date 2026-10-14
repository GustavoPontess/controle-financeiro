export interface Meta {
  id: string
  nome: string
  descricao: string | null
  valorAlvo: number
  valorAtual: number
  percentualConcluido: number
  concluida: boolean
  dataLimite: string | null
  usuarioId: string
  familiaId: string | null
  categoriaId: string | null
  ativo: boolean
  criadoEm: string
  atualizadoEm: string
}

export interface CriarMetaDto {
  nome: string
  descricao?: string | null
  valorAlvo: number
  dataLimite?: string | null
  familiaId?: string | null
  categoriaId?: string | null
}

export interface ContribuirMetaDto {
  valor: number
}
