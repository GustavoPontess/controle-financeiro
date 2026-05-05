export interface Emprestimo {
  id: string
  descricao: string
  pessoa: string
  valorTotal: number
  valorPago: number
  valorRestante: number
  percentualPago: number
  tipo: number
  tipoDescricao: string
  dataInicio: string
  dataVencimento?: string
  quitado: boolean
  vencido: boolean
  observacao?: string
}

export interface CriarEmprestimo {
  descricao: string
  pessoa: string
  valorTotal: number
  tipo: number
  dataInicio: string
  dataVencimento?: string
  observacao?: string
}
