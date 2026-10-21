import type { RespostaDoMes } from "./DinheiroDoMes"

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

// ── Check-up do mês (Relatórios do v2; espelha CheckUpDto) ──

export interface CategoriaDoCheckUp {
  categoriaId: string | null
  nome: string
  valor: number
  percentualDoGasto: number
  /** Média dos meses anteriores com gasto (até 3); null sem histórico. */
  normal: number | null
  /** Quanto veio acima (+) ou abaixo (−) do normal, em %. */
  variacaoPercentual: number | null
}

export interface MesDoCheckUp {
  ano: number
  mes: number
  entrou: number
  saiu: number
  sobrou: number
}

export interface CheckUp {
  ano: number
  mes: number
  /** Mês em andamento: os números são "até agora". */
  mesAtual: boolean
  entrou: number
  saiu: number
  sobrou: number
  percentualQueSobrou: number | null
  contasFixasPorMes: number
  parcelasDoMes: number
  percentualComprometido: number | null
  praOndeFoi: CategoriaDoCheckUp[]
  mesAMes: MesDoCheckUp[]
  dinheiroGuardado: number
  gastoNormal: number | null
  mesesDeReserva: number | null
  resposta: RespostaDoMes
}
