export interface EvolucaoMensal {
  ano: number
  mes: number
  mesLabel: string
  receitas: number
  despesas: number
  saldo: number
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
