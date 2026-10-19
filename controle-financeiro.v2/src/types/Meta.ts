/** "concluida" · "sem-prazo" · "prazo-passou" · "no-ritmo" · "atras" (calculado no servidor). */
export type SituacaoMeta = "concluida" | "sem-prazo" | "prazo-passou" | "no-ritmo" | "atras"

/** Quanto de uma conta está reservado pra meta (o dinheiro continua na conta). */
export interface MetaReserva {
  contaId: string
  contaNome: string
  bancoNome: string | null
  bancoCor: string | null
  valor: number
}

export interface Meta {
  id: string
  nome: string
  descricao: string | null
  valorAlvo: number
  /** Σ reservas: o que já está guardado (reservado em contas). */
  guardado: number
  falta: number
  percentualConcluido: number
  concluida: boolean
  /** Mês do prazo (dia 1, ISO) ou null. */
  dataLimite: string | null
  /** Meses até o prazo contando o atual; null sem prazo/concluída. */
  mesesRestantes: number | null
  /** Quanto guardar por mês pra chegar no prazo; null sem prazo, concluída ou prazo passado. */
  porMes: number | null
  situacao: SituacaoMeta
  reservas: MetaReserva[]
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
  /** "YYYY-MM-01" (o mês do prazo) ou null. */
  dataLimite?: string | null
  familiaId?: string | null
  categoriaId?: string | null
}

/** Conta aberta com o que já está reservado em metas e o que sobra livre. */
export interface ContaLivre {
  contaId: string
  nome: string
  bancoNome: string | null
  bancoCor: string | null
  saldo: number
  reservado: number
  livre: number
}
