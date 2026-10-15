export interface EvolucaoMensal {
  ano: number
  mes: number
  mesLabel: string
  receitas: number
  despesas: number
  /** Resultado do mês no caixa (entrou − saiu da conta naquele mês). */
  saldo: number
  /** Saldo real de todas as contas no fim do mês. */
  saldoFimDoMes: number
}

export interface GastoPorCategoria {
  descricao: string
  valor: number
  percentual: number
}

export interface ComparacaoMes {
  mesLabel: string
  receitas: number
  despesas: number
}

export interface RelatorioData {
  evolucaoMensal: EvolucaoMensal[]
  gastosPorCategoria: GastoPorCategoria[]
  comparacaoUltimosMeses: ComparacaoMes[]
}
